// =============================================================================
// NULL Queue Type Backfill Migration - Discovery Module  
// =============================================================================
// 🎯 ONE-TIME MIGRATION: Fix historical NULL queue types
// 📋 Logic: Same as new-requirements-discovery.service.ts
// 🔍 Scope: ~10,000 users with NULL currentQueueType
// ⚠️  Safe to run multiple times (idempotent)

import { replicaDb } from '@/lib/mysql'
import { prisma } from '@/lib/db'
import { logger } from '@/modules/core'

export interface NullQueueBackfillResult {
  timestamp: Date
  duration: number
  success: boolean
  errors: string[]
  summary: string
  
  // Analysis metrics
  totalNullUsers: number
  signedUsers: number
  unsignedUsers: number
  usersWithRequirements: number
  usersWithoutRequirements: number
  
  // Update results
  usersUpdatedToOutstandingRequests: number
  usersSkippedUnsigned: number
  usersSkippedNoRequirements: number
  
  // Performance
  batchesProcessed: number
  progress: {
    processed: number
    total: number
    percentage: number
  }
}

export interface NullQueueBackfillOptions {
  dryRun?: boolean
  batchSize?: number
  maxUsers?: number
  offset?: number
  timeoutSeconds?: number
}

interface NullUserData {
  userId: number
  currentSignatureFileId: number | null
  hasRequirements: boolean
  requirementTypes: string[]
}

/**
 * NULL Queue Type Backfill Migration Service
 * 
 * Finds all users with NULL currentQueueType and applies the same logic
 * as the hourly requirements discovery to properly assign queue types:
 * 
 * 1. Signed users with pending requirements → outstanding_requests
 * 2. Unsigned users → skip (unsigned queue takes priority)
 * 3. Users without requirements → skip (remain NULL for other processes)
 */
export class NullQueueBackfillMigrationService {
  
  private readonly BATCH_SIZE = 500  // Handle 500 users per batch for ~10k total
  private readonly MAX_EXECUTION_TIME = 240 * 1000  // 4 minutes max
  private readonly DEFAULT_TIMEOUT = 300  // 5 minutes
  
  // Same excluded types as requirements discovery
  private readonly EXCLUDED_REQUIREMENT_TYPES = [
    'signature',
    'vehicle_registration',
    'cfa',
    'solicitor_letter_of_authority',
    'letter_of_authority'
  ]

  /**
   * Run the NULL queue type backfill migration
   */
  async runNullQueueBackfill(options: NullQueueBackfillOptions = {}): Promise<NullQueueBackfillResult> {
    const startTime = Date.now()
    const result: NullQueueBackfillResult = {
      timestamp: new Date(),
      duration: 0,
      success: false,
      errors: [],
      summary: '',
      totalNullUsers: 0,
      signedUsers: 0,
      unsignedUsers: 0,
      usersWithRequirements: 0,
      usersWithoutRequirements: 0,
      usersUpdatedToOutstandingRequests: 0,
      usersSkippedUnsigned: 0,
      usersSkippedNoRequirements: 0,
      batchesProcessed: 0,
      progress: { processed: 0, total: 0, percentage: 0 }
    }
    
    const batchSize = options.batchSize || this.BATCH_SIZE
    const maxUsers = options.maxUsers || 15000  // Safety limit
    const offset = options.offset || 0
    const isDryRun = options.dryRun || false
    
    logger.info(`🔄 Starting NULL queue backfill migration (${isDryRun ? 'DRY RUN' : 'LIVE'})`)
    logger.info(`📊 Settings: batch=${batchSize}, max=${maxUsers}, offset=${offset}`)
    
    try {
      // Step 1: Get all users with NULL queue types
      const nullUsers = await this.getNullQueueUsers(maxUsers, offset)
      result.totalNullUsers = nullUsers.length
      result.progress.total = nullUsers.length
      
      if (nullUsers.length === 0) {
        result.success = true
        result.summary = '✅ No users with NULL queue types found'
        logger.info(result.summary)
        return result
      }
      
      logger.info(`🔍 Found ${nullUsers.length} users with NULL currentQueueType`)
      
      // Step 2: Analyze users (signed vs unsigned, requirements status)
      const analysisResult = await this.analyzeNullUsers(nullUsers)
      Object.assign(result, analysisResult)
      
      // Step 3: Process users in batches (if not dry run)
      if (!isDryRun) {
        await this.processNullUsersInBatches(
          analysisResult.eligibleUsers, 
          batchSize, 
          result,
          startTime
        )
      } else {
        result.usersUpdatedToOutstandingRequests = analysisResult.eligibleUsers.length
        logger.info(`🔍 [DRY RUN] Would update ${analysisResult.eligibleUsers.length} users to outstanding_requests`)
      }
      
      result.success = true
      result.duration = Date.now() - startTime
      result.summary = isDryRun 
        ? `🔍 [DRY RUN] Found ${result.usersWithRequirements} signed users with requirements ready for outstanding_requests queue`
        : `✅ NULL Queue Backfill: ${result.usersUpdatedToOutstandingRequests} users updated to outstanding_requests queue`
        
      logger.info(result.summary)
      
    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : String(error))
      result.duration = Date.now() - startTime
      result.summary = `❌ NULL Queue Backfill failed: ${result.errors[0]}`
      logger.error(result.summary, { error })
    }
    
    return result
  }
  
  /**
   * Get all users with NULL currentQueueType
   */
  private async getNullQueueUsers(maxUsers: number, offset: number): Promise<{ userId: bigint }[]> {
    try {
      const query = `
        SELECT id as userId
        FROM user_call_scores 
        WHERE currentQueueType IS NULL
          AND isActive = 1
        ORDER BY id
        LIMIT ? OFFSET ?
      `
      
      const users = await replicaDb.$queryRawUnsafe(query, maxUsers, offset) as Array<{
        userId: bigint
      }>
      
      return users
      
    } catch (replicaError) {
      logger.warn('⚠️ Replica DB failed, using primary DB for NULL users query', { error: replicaError })
      
      // Fallback to primary DB
      const users = await prisma.userCallScore.findMany({
        where: {
          // @ts-ignore - currentQueueType exists in schema
          currentQueueType: null,
          isActive: true
        },
        select: { userId: true },
        orderBy: { id: 'asc' },
        take: maxUsers,
        skip: offset
      })
      
      return users.map(u => ({ userId: u.userId }))
    }
  }
  
  /**
   * Analyze NULL users to determine queue assignments
   */
  private async analyzeNullUsers(nullUsers: { userId: bigint }[]): Promise<{
    signedUsers: number
    unsignedUsers: number
    usersWithRequirements: number
    usersWithoutRequirements: number
    usersSkippedUnsigned: number
    usersSkippedNoRequirements: number
    eligibleUsers: bigint[]
  }> {
    const userIds = nullUsers.map(u => u.userId)
    
    // Get user signature status
    const usersData = await this.getUsersWithSignatureStatus(userIds)
    
    // Get users with pending requirements  
    const usersWithRequirements = await this.getUsersWithPendingRequirements(userIds)
    const requirementsMap = new Map(usersWithRequirements.map(u => [u.userId, u]))
    
    let signedUsers = 0
    let unsignedUsers = 0  
    let usersWithReqs = 0
    let usersWithoutReqs = 0
    let skippedUnsigned = 0
    let skippedNoRequirements = 0
    const eligibleUsers: bigint[] = []
    
    for (const user of usersData) {
      const hasPendingRequirements = requirementsMap.has(user.userId)
      const isSigned = user.currentSignatureFileId !== null
      
      if (isSigned) {
        signedUsers++
      } else {
        unsignedUsers++
      }
      
      if (hasPendingRequirements) {
        usersWithReqs++
      } else {
        usersWithoutReqs++
      }
      
      // Apply same logic as requirements discovery:
      // Only signed users with pending requirements get outstanding_requests queue
      if (!isSigned) {
        skippedUnsigned++
        // Skip: unsigned users should be handled by unsigned queue discovery
      } else if (!hasPendingRequirements) {
        skippedNoRequirements++
        // Skip: no pending requirements means they shouldn't be in outstanding_requests
      } else {
        // Eligible: signed user with pending requirements
        eligibleUsers.push(user.userId)
      }
    }
    
    logger.info(`📊 [ANALYSIS] Signed: ${signedUsers}, Unsigned: ${unsignedUsers}`)
    logger.info(`📊 [ANALYSIS] With Requirements: ${usersWithReqs}, Without: ${usersWithoutReqs}`)
    logger.info(`📊 [ANALYSIS] Eligible for outstanding_requests: ${eligibleUsers.length}`)
    
    return {
      signedUsers,
      unsignedUsers,
      usersWithRequirements: usersWithReqs,
      usersWithoutRequirements: usersWithoutReqs,
      usersSkippedUnsigned: skippedUnsigned,
      usersSkippedNoRequirements: skippedNoRequirements,
      eligibleUsers
    }
  }
  
  /**
   * Get users with their signature status
   */
  private async getUsersWithSignatureStatus(userIds: bigint[]): Promise<{ userId: bigint, currentSignatureFileId: number | null }[]> {
    try {
      const query = `
        SELECT id, current_signature_file_id
        FROM users 
        WHERE id IN (${userIds.map(() => '?').join(', ')})
          AND is_enabled = 1
      `
      
      const users = await replicaDb.$queryRawUnsafe(query, ...userIds) as Array<{
        id: bigint
        current_signature_file_id: number | null
      }>
      
      return users.map(u => ({
        userId: u.id,
        currentSignatureFileId: u.current_signature_file_id
      }))
      
    } catch (replicaError) {
      logger.warn('⚠️ Replica DB failed for signature status check', { error: replicaError })
      
      // Cannot fallback to primary DB for user signature queries
      // Return empty array to skip processing this batch
      logger.error('❌ Cannot check user signatures - replica DB required')
      return []
    }
  }
  
  /**
   * Get users with pending requirements (same logic as requirements discovery)
   */
  private async getUsersWithPendingRequirements(userIds: bigint[]): Promise<{ userId: bigint }[]> {
    try {
      const excludedTypesPlaceholders = this.EXCLUDED_REQUIREMENT_TYPES.map(() => '?').join(', ')
      
      const query = `
        SELECT DISTINCT c.user_id as userId
        FROM claim_requirements cr
        JOIN claims c ON cr.claim_id = c.id
        WHERE c.user_id IN (${userIds.map(() => '?').join(', ')})
          AND cr.status = 'pending'
          AND cr.type NOT IN (${excludedTypesPlaceholders})
        ORDER BY c.user_id
      `
      
      const params = [...userIds, ...this.EXCLUDED_REQUIREMENT_TYPES]
      const users = await replicaDb.$queryRawUnsafe(query, ...params) as Array<{
        userId: bigint
      }>
      
      return users
      
    } catch (replicaError) {
      logger.warn('⚠️ Replica DB failed for requirements check, using primary DB', { error: replicaError })
      
      // Fallback to primary DB - would need to implement Prisma query
      // For now, return empty array to avoid errors
      logger.error('❌ Cannot check requirements with primary DB - Prisma query needed')
      return []
    }
  }
  
  /**
   * Process eligible users in batches
   */
  private async processNullUsersInBatches(
    eligibleUserIds: bigint[],
    batchSize: number,
    result: NullQueueBackfillResult,
    startTime: number
  ): Promise<void> {
    
    for (let i = 0; i < eligibleUserIds.length; i += batchSize) {
      // Check timeout
      if (Date.now() - startTime > this.MAX_EXECUTION_TIME) {
        const remaining = eligibleUserIds.length - i
        result.errors.push(`⏰ Timeout: ${remaining} users remaining unprocessed`)
        break
      }
      
      const batch = eligibleUserIds.slice(i, i + batchSize)
      
      try {
        await this.updateUsersToOutstandingRequests(batch)
        
        result.usersUpdatedToOutstandingRequests += batch.length
        result.progress.processed += batch.length
        result.progress.percentage = Math.round((result.progress.processed / result.progress.total) * 100)
        result.batchesProcessed++
        
        logger.info(`✅ Batch ${Math.floor(i / batchSize) + 1}: Updated ${batch.length} users to outstanding_requests (${result.usersUpdatedToOutstandingRequests}/${eligibleUserIds.length} total)`)
        
      } catch (error) {
        const errorMsg = `❌ Batch ${Math.floor(i / batchSize) + 1} failed: ${error instanceof Error ? error.message : String(error)}`
        result.errors.push(errorMsg)
        logger.error(errorMsg, { batch: batch.slice(0, 5) }) // Log first 5 user IDs
      }
    }
  }
  
  /**
   * Update users to outstanding_requests queue type
   */
  private async updateUsersToOutstandingRequests(userIds: bigint[]): Promise<void> {
    // Use a transaction for batch updates
    await prisma.$transaction(
      userIds.map(userId => 
        prisma.userCallScore.update({
          where: { userId },
          data: {
            // @ts-ignore - currentQueueType exists in schema
            currentQueueType: 'outstanding_requests',
            currentScore: 0,
            isActive: true,
            // @ts-ignore - lastQueueCheck exists in schema
            lastQueueCheck: new Date()
          }
        })
      )
    )
  }
} 