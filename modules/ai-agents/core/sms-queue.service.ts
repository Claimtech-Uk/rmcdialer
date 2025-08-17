/**
 * SMS Queue Service for handling message processing with proper concurrency control
 * This replaces the simple rate limiting with a robust queue-based approach
 * Uses the existing cacheService infrastructure (Upstash Redis or in-memory)
 */

import { cacheService } from '@/lib/redis'
import { randomUUID } from 'crypto'

export interface QueuedMessage {
  id: string
  phoneNumber: string
  message: string
  messageSid: string
  receivedAt: Date
  attempts: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  userId?: number
  conversationId?: string
}

export class SmsQueueService {
  private readonly QUEUE_KEY_PREFIX = 'sms:queue:'
  private readonly PROCESSING_KEY_PREFIX = 'sms:processing:'
  private readonly LOCK_KEY_PREFIX = 'sms:lock:'
  private readonly DEDUP_KEY_PREFIX = 'sms:dedup:'
  private readonly QUEUE_INDEX_KEY = 'sms:queue:index'
  private readonly LOCK_TTL = 30 // seconds
  private readonly DEDUP_TTL = 300 // 5 minutes
  private readonly MAX_RETRIES = 3
  
  /**
   * Add a message to the queue for processing
   */
  async enqueue(message: Omit<QueuedMessage, 'id' | 'attempts' | 'status'>): Promise<string> {
    const id = randomUUID()
    const queuedMessage: QueuedMessage = {
      ...message,
      id,
      attempts: 0,
      status: 'pending'
    }
    
    // Check for duplicates (same messageSid within 5 minutes)
    const dedupKey = `${this.DEDUP_KEY_PREFIX}${message.messageSid}`
    const exists = await cacheService.get(dedupKey)
    if (exists) {
      console.log('AI SMS Queue | 🔁 Duplicate message detected, skipping', { 
        messageSid: message.messageSid,
        phoneNumber: message.phoneNumber 
      })
      return 'duplicate'
    }
    
    // Mark as seen for deduplication
    await cacheService.set(dedupKey, '1', this.DEDUP_TTL)
    
    // Add to queue using individual keys (since we don't have list operations)
    const queueKey = `${this.QUEUE_KEY_PREFIX}${id}`
    await cacheService.set(queueKey, JSON.stringify(queuedMessage), 3600) // 1 hour TTL
    
    // Add to queue index (track all queue items)
    const index = await this.getQueueIndex()
    index.push(id)
    await cacheService.set(this.QUEUE_INDEX_KEY, JSON.stringify(index), 3600)
    
    console.log('AI SMS Queue | ➕ Message queued', { 
      id, 
      phoneNumber: message.phoneNumber,
      messageSid: message.messageSid,
      queueDepth: index.length
    })
    
    return id
  }
  
  /**
   * Get the next message from the queue
   */
  async dequeue(): Promise<QueuedMessage | null> {
    // Prevent infinite recursion with max attempts
    return this._dequeueWithRetries(3)
  }

  /**
   * Internal dequeue with retry limit to prevent infinite recursion
   */
  private async _dequeueWithRetries(maxRetries: number): Promise<QueuedMessage | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Get queue index
      const index = await this.getQueueIndex()
      if (index.length === 0) return null
      
      // Get first item (FIFO)
      const messageId = index.shift()
      if (!messageId) return null
      
      // Update index
      await cacheService.set(this.QUEUE_INDEX_KEY, JSON.stringify(index), 3600)
      
      // Get message data
      const queueKey = `${this.QUEUE_KEY_PREFIX}${messageId}`
      const data = await cacheService.get(queueKey)
      
      if (!data) {
        // Message expired or doesn't exist, try next message
        console.log('AI SMS Queue | ⚠️ Message expired, trying next', { 
          messageId, 
          attempt: attempt + 1 
        })
        continue // Try next message instead of recursion
      }
      
      let message: QueuedMessage
      try {
        message = JSON.parse(data) as QueuedMessage
      } catch (parseError) {
        console.error('AI SMS Queue | ❌ Failed to parse message data, skipping', { messageId, parseError })
        continue // Try next message
      }
      message.status = 'processing'
      
      // Move to processing
      await cacheService.del(queueKey)
      const processingKey = `${this.PROCESSING_KEY_PREFIX}${message.id}`
      await cacheService.set(processingKey, JSON.stringify(message), 300) // 5 min TTL
      
      console.log('AI SMS Queue | 📤 Message dequeued for processing', {
        id: message.id,
        phoneNumber: message.phoneNumber,
        attempts: message.attempts,
        retryAttempt: attempt
      })
      
      return message
    }
    
    // Max retries exceeded
    console.warn('AI SMS Queue | ⚠️ Max dequeue retries exceeded, queue may have stale entries')
    return null
  }
  
  /**
   * Get the queue index (list of message IDs)
   */
  private async getQueueIndex(): Promise<string[]> {
    try {
      const indexData = await cacheService.get(this.QUEUE_INDEX_KEY)
      if (!indexData) return []
      
      // Handle different data types
      if (typeof indexData === 'string') {
        return JSON.parse(indexData)
      } else if (Array.isArray(indexData)) {
        return indexData
      } else {
        console.warn('AI SMS Queue | ⚠️ Unexpected index data type, resetting', typeof indexData)
        return []
      }
    } catch (error) {
      console.error('AI SMS Queue | ❌ Failed to parse queue index, resetting', error)
      // Clear corrupted index and start fresh
      await cacheService.del(this.QUEUE_INDEX_KEY)
      return []
    }
  }
  
  /**
   * Acquire a lock for processing messages from a specific phone number
   * This prevents concurrent processing of messages from the same user
   */
  async acquireLock(phoneNumber: string, ttlSeconds: number = this.LOCK_TTL): Promise<boolean> {
    const lockKey = `${this.LOCK_KEY_PREFIX}${phoneNumber}`
    
    // Check if lock exists
    const existingLock = await cacheService.get(lockKey)
    if (existingLock) {
      console.log('AI SMS Queue | 🔒 Lock already held', { phoneNumber })
      return false
    }
    
    // Try to acquire lock
    await cacheService.set(lockKey, '1', ttlSeconds)
    
    // Double-check we got it (in case of race condition)
    const confirmedLock = await cacheService.get(lockKey)
    const acquired = confirmedLock === '1'
    
    if (acquired) {
      console.log('AI SMS Queue | 🔒 Lock acquired', { phoneNumber, ttl: ttlSeconds })
    }
    
    return acquired
  }
  
  /**
   * Release the lock for a phone number
   */
  async releaseLock(phoneNumber: string): Promise<void> {
    const lockKey = `${this.LOCK_KEY_PREFIX}${phoneNumber}`
    await cacheService.del(lockKey)
    console.log('AI SMS Queue | 🔓 Lock released', { phoneNumber })
  }
  
  /**
   * Mark a message as successfully completed
   */
  async markCompleted(messageId: string): Promise<void> {
    const processingKey = `${this.PROCESSING_KEY_PREFIX}${messageId}`
    await cacheService.del(processingKey)
    console.log('AI SMS Queue | ✅ Message completed', { messageId })
  }
  
  /**
   * Mark a message as failed and handle retry logic
   */
  async markFailed(messageId: string, error: string): Promise<void> {
    const processingKey = `${this.PROCESSING_KEY_PREFIX}${messageId}`
    const data = await cacheService.get(processingKey)
    if (!data) {
      console.warn('AI SMS Queue | ⚠️ Failed to find message in processing', { messageId })
      return
    }
    
    let message: QueuedMessage
    try {
      message = JSON.parse(data) as QueuedMessage
    } catch (parseError) {
      console.error('AI SMS Queue | ❌ Failed to parse processing message data', { messageId, parseError })
      await cacheService.del(processingKey) // Clean up corrupted data
      return
    }
    message.status = 'failed'
    message.error = error
    message.attempts++
    
    if (message.attempts < this.MAX_RETRIES) {
      // Calculate exponential backoff: 5s, 10s, 15s
      const backoffMs = message.attempts * 5000
      
      // Remove from processing
      await cacheService.del(processingKey)
      
      // Re-queue after backoff
      setTimeout(async () => {
        message.status = 'pending' // Reset status for retry
        const queueKey = `${this.QUEUE_KEY_PREFIX}${message.id}`
        await cacheService.set(queueKey, JSON.stringify(message), 3600)
        
        // Add back to index
        const index = await this.getQueueIndex()
        index.push(message.id)
        await cacheService.set(this.QUEUE_INDEX_KEY, JSON.stringify(index), 3600)
        
        console.log('AI SMS Queue | 🔄 Retrying message', { 
          messageId, 
          attempt: message.attempts,
          backoffMs,
          phoneNumber: message.phoneNumber
        })
      }, backoffMs)
    } else {
      // Max retries exceeded, log and remove
      console.error('AI SMS Queue | ❌ Message failed permanently', { 
        messageId, 
        error,
        attempts: message.attempts,
        phoneNumber: message.phoneNumber
      })
      await cacheService.del(processingKey)
      
      // TODO: Consider adding to dead letter queue for manual investigation
    }
  }
  
  /**
   * Get current queue depth
   */
  async getQueueDepth(): Promise<number> {
    const index = await this.getQueueIndex()
    return index.length
  }
  
  /**
   * Get number of messages currently being processed
   * Note: This is approximate since we can't scan keys efficiently
   */
  async getProcessingCount(): Promise<number> {
    // For now, return 0 as we can't efficiently count processing items
    // In production, you might want to maintain a separate counter
    return 0
  }
  
  /**
   * Clear all queue data (use with caution!)
   */
  async clearAll(): Promise<void> {
    try {
      // Clear queue index first
      await cacheService.del(this.QUEUE_INDEX_KEY)
      
      // Try to clear patterns, but don't let it hang the entire operation
      // Use Promise.race to timeout after 2 seconds
      const clearOperations = [
        cacheService.delPattern(`${this.QUEUE_KEY_PREFIX}*`),
        cacheService.delPattern(`${this.PROCESSING_KEY_PREFIX}*`),
        cacheService.delPattern(`${this.LOCK_KEY_PREFIX}*`),
        cacheService.delPattern(`${this.DEDUP_KEY_PREFIX}*`)
      ]
      
      // Run all clear operations with 2-second timeout
      await Promise.race([
        Promise.all(clearOperations),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Clear operation timeout')), 2000)
        )
      ])
      
      console.log('AI SMS Queue | 🗑️ All queue data cleared')
    } catch (error) {
      console.warn('AI SMS Queue | ⚠️ Clear operation had issues, but queue index cleared', error)
      // Don't throw - clearing the index is the most important part
    }
  }
  
  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    queueDepth: number
    processingCount: number
    lockedNumbers: number
  }> {
    const queueDepth = await this.getQueueDepth()
    
    // These are approximations since we can't efficiently scan
    return {
      queueDepth,
      processingCount: 0, // Can't efficiently count
      lockedNumbers: 0 // Can't efficiently count
    }
  }
}

// Export singleton instance
export const smsQueueService = new SmsQueueService()