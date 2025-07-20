// CDC Processor Service
// Handles change data capture events from SQS and triggers appropriate cache invalidation

import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs'
import { UserService } from '@/modules/users'
import { cacheService } from '@/lib/redis'
import type { QueueType } from '@/modules/queue/types/queue.types'

interface CDCEvent {
  eventName: 'INSERT' | 'UPDATE' | 'DELETE'
  eventSource: string
  awsRegion: string
  dynamodb: {
    Keys?: Record<string, any>
    NewImage?: Record<string, any>
    OldImage?: Record<string, any>
    SequenceNumber: string
    SizeBytes: number
    StreamViewType: string
  }
  eventSourceARN?: string
  tableName?: string
}

interface ProcessingStats {
  messagesProcessed: number
  cacheInvalidations: number
  queueTransitions: number
  errors: number
  lastProcessedAt: Date
}

export class CDCProcessor {
  private sqsClient: SQSClient
  private userService: UserService
  private isRunning: boolean = false
  private stats: ProcessingStats = {
    messagesProcessed: 0,
    cacheInvalidations: 0,
    queueTransitions: 0,
    errors: 0,
    lastProcessedAt: new Date()
  }

  private readonly logger = {
    info: (message: string, meta?: any) => console.log(`[CDC] ${message}`, meta || ''),
    error: (message: string, error?: any) => console.error(`[CDC ERROR] ${message}`, error || ''),
    warn: (message: string, meta?: any) => console.warn(`[CDC WARN] ${message}`, meta || ''),
    debug: (message: string, meta?: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CDC DEBUG] ${message}`, meta || '')
      }
    }
  }

  constructor() {
    if (!process.env.AWS_REGION || !process.env.SQS_QUEUE_URL) {
      throw new Error('CDC Processor requires AWS_REGION and SQS_QUEUE_URL environment variables')
    }

    this.sqsClient = new SQSClient({ 
      region: process.env.AWS_REGION,
      maxAttempts: 3,
      retryMode: 'adaptive'
    })
    
    this.userService = new UserService()
    
    this.logger.info('CDC Processor initialized', {
      region: process.env.AWS_REGION,
      queueUrl: process.env.SQS_QUEUE_URL?.substring(0, 50) + '...'
    })
  }

  /**
   * Start the CDC processing loop
   */
  async startProcessing(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('CDC Processor already running')
      return
    }

    this.isRunning = true
    this.logger.info('🚀 Starting CDC processing loop')

    while (this.isRunning) {
      try {
        const messages = await this.receiveMessages()
        
        if (messages.length > 0) {
          this.logger.debug(`Received ${messages.length} CDC messages`)
          await this.processMessages(messages)
        }
        
        // Short polling interval - long polling configured in SQS
        await this.sleep(1000)
        
      } catch (error) {
        this.stats.errors++
        this.logger.error('CDC processing error:', error)
        
        // Exponential backoff on errors
        await this.sleep(Math.min(5000 * Math.pow(2, this.stats.errors), 30000))
      }
    }
  }

  /**
   * Stop the CDC processing loop
   */
  async stopProcessing(): Promise<void> {
    this.logger.info('🛑 Stopping CDC processing loop')
    this.isRunning = false
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats }
  }

  /**
   * Receive messages from SQS queue
   */
  private async receiveMessages(): Promise<Message[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL!,
      MaxNumberOfMessages: 10, // Process up to 10 messages at once
      WaitTimeSeconds: 20,     // Long polling - wait up to 20 seconds
      VisibilityTimeout: 300, // 5 minutes to process messages
      MessageAttributeNames: ['All'],
      AttributeNames: ['All']
    })

    const response = await this.sqsClient.send(command)
    return response.Messages || []
  }

  /**
   * Process multiple messages in parallel
   */
  private async processMessages(messages: Message[]): Promise<void> {
    // Process messages in parallel for better throughput
    const results = await Promise.allSettled(
      messages.map(message => this.processMessage(message))
    )

    // Log any processing failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(`Failed to process message ${index}:`, result.reason)
      }
    })

    this.stats.messagesProcessed += messages.length
    this.stats.lastProcessedAt = new Date()
  }

  /**
   * Process a single CDC message
   */
  private async processMessage(message: Message): Promise<void> {
    if (!message.Body) {
      this.logger.warn('Received message without body')
      return
    }

    try {
      // Parse the CDC event
      const cdcEvent: CDCEvent = JSON.parse(message.Body)
      
      this.logger.debug('Processing CDC event', {
        eventName: cdcEvent.eventName,
        tableName: cdcEvent.tableName
      })

      // Handle the specific change event
      await this.handleChangeEvent(cdcEvent)

      // Delete message after successful processing
      if (message.ReceiptHandle) {
        await this.deleteMessage(message.ReceiptHandle)
      }

    } catch (error) {
      this.logger.error('Failed to process CDC message:', error)
      this.stats.errors++
      
      // Don't delete message on error - let it return to queue for retry
      // After max retries, it will go to DLQ automatically
      throw error
    }
  }

  /**
   * Handle different types of change events
   */
  private async handleChangeEvent(event: CDCEvent): Promise<void> {
    const { eventName, tableName, dynamodb } = event

    if (!tableName || !dynamodb) {
      this.logger.warn('CDC event missing required fields', { eventName, tableName })
      return
    }

    switch (tableName.toLowerCase()) {
      case 'users':
        await this.handleUserTableChange(eventName, dynamodb)
        break
      
      case 'claims':
        await this.handleClaimTableChange(eventName, dynamodb)
        break
      
      case 'claim_requirements':
        await this.handleRequirementTableChange(eventName, dynamodb)
        break
      
      case 'user_addresses':
        await this.handleAddressTableChange(eventName, dynamodb)
        break
      
      default:
        this.logger.debug(`Ignoring change to table: ${tableName}`)
    }
  }

  /**
   * Handle changes to users table
   */
  private async handleUserTableChange(eventName: string, data: any): Promise<void> {
    const userId = this.extractUserId(data)
    if (!userId) return

    this.logger.info(`User change detected: ${eventName} for user ${userId}`)

    // Check if signature status changed (most important for queue transitions)
    if (eventName === 'UPDATE' && this.hasSignatureStatusChanged(data)) {
      await this.handleSignatureStatusChange(userId, data)
    }

    // Always invalidate user cache on any user change
    await this.invalidateUserCache(userId)
  }

  /**
   * Handle changes to claims table
   */
  private async handleClaimTableChange(eventName: string, data: any): Promise<void> {
    const userId = this.extractUserIdFromClaim(data)
    if (!userId) return

    this.logger.info(`Claim change detected: ${eventName} for user ${userId}`)
    
    // Invalidate user cache as claims affect queue eligibility
    await this.invalidateUserCache(userId)
  }

  /**
   * Handle changes to claim requirements table
   */
  private async handleRequirementTableChange(eventName: string, data: any): Promise<void> {
    // Requirements changes are critical for queue transitions
    const claimId = this.extractClaimIdFromRequirement(data)
    if (!claimId) return

    // Need to find which user this requirement belongs to
    // This requires a database lookup, but it's necessary for cache invalidation
    try {
      const claim = await this.userService.getClaimOwner(claimId)
      if (claim?.userId) {
        this.logger.info(`Requirement change detected: ${eventName} for user ${claim.userId}`)
        await this.invalidateUserCache(claim.userId)
        
        // Check if this requirement change affects queue eligibility
        await this.checkQueueTransition(claim.userId)
      }
    } catch (error) {
      this.logger.error(`Failed to process requirement change for claim ${claimId}:`, error)
    }
  }

  /**
   * Handle changes to user addresses table
   */
  private async handleAddressTableChange(eventName: string, data: any): Promise<void> {
    const userId = this.extractUserIdFromAddress(data)
    if (!userId) return

    this.logger.debug(`Address change detected: ${eventName} for user ${userId}`)
    
    // Address changes are less critical, but still invalidate cache
    await this.invalidateUserCache(userId)
  }

  /**
   * Check if signature status changed (critical for queue transitions)
   */
  private hasSignatureStatusChanged(data: any): boolean {
    const oldSignature = data.OldImage?.current_signature_file_id?.S
    const newSignature = data.NewImage?.current_signature_file_id?.S
    
    return oldSignature !== newSignature
  }

  /**
   * Handle signature status change (moves user between queues)
   */
  private async handleSignatureStatusChange(userId: number, data: any): Promise<void> {
    const oldSignature = data.OldImage?.current_signature_file_id?.S
    const newSignature = data.NewImage?.current_signature_file_id?.S

    let transition = ''
    if (!oldSignature && newSignature) {
      transition = 'unsigned_users → outstanding_requests'
    } else if (oldSignature && !newSignature) {
      transition = 'outstanding_requests → unsigned_users'
    }

    if (transition) {
      this.logger.info(`🔄 Queue transition detected for user ${userId}: ${transition}`)
      this.stats.queueTransitions++
      
      // Invalidate queue caches to trigger refresh
      await this.invalidateQueueCaches()
    }
  }

  /**
   * Check if user should transition between queues
   */
  private async checkQueueTransition(userId: number): Promise<void> {
    try {
      const oldQueueType = await this.getCachedUserQueueType(userId)
      const newQueueType = await this.userService.determineUserQueueType(userId)
      
      if (oldQueueType !== newQueueType) {
        this.logger.info(`🔄 Queue transition for user ${userId}: ${oldQueueType} → ${newQueueType}`)
        this.stats.queueTransitions++
        
        // Invalidate queue caches
        await this.invalidateQueueCaches()
      }
    } catch (error) {
      this.logger.error(`Failed to check queue transition for user ${userId}:`, error)
    }
  }

  /**
   * Invalidate all user-related caches
   */
  private async invalidateUserCache(userId: number): Promise<void> {
    try {
      await this.userService.invalidateUserCache(userId)
      this.stats.cacheInvalidations++
      
      this.logger.debug(`Cache invalidated for user ${userId}`)
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for user ${userId}:`, error)
    }
  }

  /**
   * Invalidate queue caches to trigger refresh
   */
  private async invalidateQueueCaches(): Promise<void> {
    try {
      await cacheService.delPattern('eligible_users:*')
      await cacheService.delPattern('queue:*')
      
      this.logger.debug('Queue caches invalidated')
    } catch (error) {
      this.logger.error('Failed to invalidate queue caches:', error)
    }
  }

  /**
   * Get cached user queue type (for transition detection)
   */
  private async getCachedUserQueueType(userId: number): Promise<QueueType | null> {
    // This would need to be implemented to store/retrieve queue type
    // For now, return null to always trigger transition check
    return null
  }

  /**
   * Delete processed message from SQS
   */
  private async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL!,
      ReceiptHandle: receiptHandle
    })

    await this.sqsClient.send(command)
  }

  /**
   * Utility: Extract user ID from DynamoDB record
   */
  private extractUserId(data: any): number | null {
    const userIdData = data.NewImage?.id || data.OldImage?.id || data.Keys?.id
    if (!userIdData) return null
    
    // Handle different DynamoDB data types
    if (userIdData.N) return parseInt(userIdData.N)
    if (userIdData.S) return parseInt(userIdData.S)
    
    return null
  }

  /**
   * Utility: Extract user ID from claim record
   */
  private extractUserIdFromClaim(data: any): number | null {
    const userIdData = data.NewImage?.user_id || data.OldImage?.user_id
    if (!userIdData) return null
    
    if (userIdData.N) return parseInt(userIdData.N)
    if (userIdData.S) return parseInt(userIdData.S)
    
    return null
  }

  /**
   * Utility: Extract claim ID from requirement record
   */
  private extractClaimIdFromRequirement(data: any): number | null {
    const claimIdData = data.NewImage?.claim_id || data.OldImage?.claim_id
    if (!claimIdData) return null
    
    if (claimIdData.N) return parseInt(claimIdData.N)
    if (claimIdData.S) return parseInt(claimIdData.S)
    
    return null
  }

  /**
   * Utility: Extract user ID from address record
   */
  private extractUserIdFromAddress(data: any): number | null {
    const userIdData = data.NewImage?.user_id || data.OldImage?.user_id
    if (!userIdData) return null
    
    if (userIdData.N) return parseInt(userIdData.N)
    if (userIdData.S) return parseInt(userIdData.S)
    
    return null
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
} 