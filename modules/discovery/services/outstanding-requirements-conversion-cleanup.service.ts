// =============================================================================
// Outstanding Requirements Conversion Cleanup Service - Discovery Module
// =============================================================================
// Cron: Check outstanding_requests users for requirement conversions every hour

import { replicaDb } from '@/lib/mysql'
import { prisma } from '@/lib/db'
import { logger } from '@/modules/core'
import type { 
  OutstandingRequirementsConversionResult, 
  OutstandingRequirementsConversionData, 
  DiscoveryOptions,
  DiscoveryServiceDependencies 
} from '../types/discovery.types'

/**
 * Outstanding Requirements Conversion Cleanup Service
 * 
 * 🎯 CORE GOALS:
 * 1. Get ALL user_call_scores with currentQueueType = 'outstanding_requests'
 * 2. For each user, check their claims and requirements in MySQL replica
 * 3. Users who have NO pending requirements (excluding filtered types):
 *    - Set currentQueueType = null (remove from queue)
 *    - Set currentScore = 0 (reset priority)
 *    - Set isActive = false (no longer needs calling)
 *    - Track as conversions
 * 
 * 🚫 EXCLUDED REQUIREMENT TYPES:
 * - signature
 * - vehicle_registration 
 * - cfa
 * - solicitor_letter_of_authority
 * - letter_of_authority
 * 
 * 🎯 PERFORMANCE:
 * - Process up to ~4,000 users in 28 seconds
 * - Batch processing (300 users per batch)
 * - Complete hourly validation of outstanding queue
 * - Smart prioritization for large volumes
 */
export class OutstandingRequirementsConversionCleanupService {
  private readonly DEFAULT_BATCH_SIZE = 300
  private readonly MAX_EXECUTION_TIME = 28000 // 28 seconds
  private readonly EXCLUDED_REQUIREMENT_TYPES = [
    'signature',
    'vehicle_registration', 
    'cfa',
    'solicitor_letter_of_authority',
    'letter_of_authority'
  ]
  private startTime: number = 0

  constructor(private dependencies?: DiscoveryServiceDependencies) {}

  /**
   * Run hourly outstanding requirements conversion cleanup
   */
  async cleanupOutstandingRequirementsConversions(options: DiscoveryOptions = {}): Promise<OutstandingRequirementsConversionResult> {
    this.startTime = Date.now()
    const { 
      batchSize = this.DEFAULT_BATCH_SIZE,
      dryRun = false 
    } = options

    const result: OutstandingRequirementsConversionResult = {
      timestamp: new Date(),
      duration: 0,
      success: false,
      errors: [],
      summary: '',
      totalOutstandingUsers: 0,
      usersChecked: 0,
      conversionsFound: 0,
      usersUpdated: 0,
      batchesProcessed: 0,
      processingStrategy: '',
      completed: false,
      conversions: []
    }

    try {
      logger.info(`🧹 [OUTSTANDING CLEANUP] Starting hourly outstanding requirements conversion cleanup`)
      
      // Step 1: Get ALL outstanding_requests users from user_call_scores
      const allOutstandingUsers = await this.getAllOutstandingUsers()
      result.totalOutstandingUsers = allOutstandingUsers.length
      
      if (allOutstandingUsers.length === 0) {
        result.success = true
        result.completed = true
        result.summary = `✅ No users in outstanding_requests queue to check`
        logger.info(result.summary)
        return result
      }

      logger.info(`📊 Found ${allOutstandingUsers.length} users in outstanding_requests queue`)
      
      // Step 2: Determine processing strategy
      const maxProcessable = this.calculateMaxProcessable(batchSize)
      
      if (allOutstandingUsers.length <= maxProcessable) {
        // ✅ Can process everyone this hour
        result.processingStrategy = 'complete_processing'
        await this.processAllUsers(allOutstandingUsers, batchSize, dryRun, result)
        result.completed = true
        
      } else {
        // ⚡ Process priority users this hour
        result.processingStrategy = 'priority_processing'
        const priorityUsers = this.prioritizeUsers(allOutstandingUsers, maxProcessable)
        await this.processAllUsers(priorityUsers, batchSize, dryRun, result)
        result.completed = false
        
        logger.warn(`⚠️ Volume too high: processed ${maxProcessable}/${allOutstandingUsers.length} users`)
      }

      result.success = true
      result.summary = dryRun 
        ? `🧪 DRY RUN: Found ${result.conversionsFound} requirement conversions (${result.processingStrategy})`
        : `✅ Outstanding Requirements Cleanup: ${result.conversionsFound} conversions processed, ${result.usersUpdated} users updated (${result.processingStrategy})`

      logger.info(`🎉 [CLEANUP COMPLETE] Outstanding Requirements Conversion Summary:`)
      logger.info(`   📊 Total outstanding users: ${result.totalOutstandingUsers}`)
      logger.info(`   ✅ Users checked: ${result.usersChecked}`)
      logger.info(`   🔄 Conversions found: ${result.conversionsFound}`)
      logger.info(`   💾 Users updated: ${result.usersUpdated}`)
      logger.info(`   📦 Batches processed: ${result.batchesProcessed}`)
      logger.info(`   🎯 Strategy: ${result.processingStrategy}`)
      logger.info(`   ✔️ Completed: ${result.completed ? 'YES' : 'PARTIAL'}`)

    } catch (error: any) {
      result.errors.push(`Cleanup failed: ${error.message}`)
      result.summary = `❌ Cleanup Failed: ${error.message}`
      logger.error(`❌ [CLEANUP ERROR]`, error)
    }

    result.duration = Date.now() - this.startTime
    return result
  }

  /**
   * Get all users with currentQueueType = 'outstanding_requests'
   */
  private async getAllOutstandingUsers(): Promise<Array<{userId: bigint}>> {
    try {
      return await prisma.userCallScore.findMany({
        where: {
          // @ts-ignore - currentQueueType exists in database
          currentQueueType: 'outstanding_requests',
          isActive: true
        },
        select: { userId: true },
        orderBy: [
          // @ts-ignore - lastQueueCheck exists in database
          { lastQueueCheck: 'asc' },  // Oldest checks first (most likely to have changed)
          { currentScore: 'asc' },    // Highest priority first  
          { userId: 'desc' }          // Newest users first
        ]
        // No LIMIT - get them all
      })
    } catch (error: any) {
      logger.error(`❌ Error getting outstanding users:`, error)
      throw error
    }
  }

  /**
   * Calculate maximum processable users in 28 seconds
   */
  private calculateMaxProcessable(batchSize: number): number {
    const secondsPerBatch = 3.5 // Conservative estimate (more complex than signature check)
    const maxBatches = Math.floor(this.MAX_EXECUTION_TIME / 1000 / secondsPerBatch)
    return maxBatches * batchSize // ~2,400 users max
  }

  /**
   * Prioritize users when volume is too high
   */
  private prioritizeUsers(allUsers: Array<{userId: bigint}>, maxCount: number): Array<{userId: bigint}> {
    // Already ordered by priority in getAllOutstandingUsers()
    return allUsers.slice(0, maxCount)
  }

  /**
   * Process all users in batches
   */
  private async processAllUsers(
    users: Array<{userId: bigint}>, 
    batchSize: number, 
    dryRun: boolean, 
    result: OutstandingRequirementsConversionResult
  ): Promise<void> {
    
    const totalBatches = Math.ceil(users.length / batchSize)
    let batchCount = 0

    for (let i = 0; i < users.length; i += batchSize) {
      if (this.isTimeoutApproaching()) {
        logger.warn(`⏰ Timeout approaching, stopping at batch ${batchCount + 1}`)
        break
      }

      const batch = users.slice(i, i + batchSize)
      batchCount++

      logger.info(`🔄 [BATCH ${batchCount}/${totalBatches}] Checking ${batch.length} users`)

      const batchResult = await this.processBatch(batch, dryRun)
      
      result.usersChecked += batchResult.checked
      result.conversionsFound += batchResult.conversions.length
      result.usersUpdated += batchResult.updated
      result.conversions.push(...batchResult.conversions)
      
      const progress = Math.round((result.usersChecked / users.length) * 100)
      logger.info(`✅ [BATCH ${batchCount}] Complete: ${batchResult.conversions.length} conversions found | Progress: ${progress}%`)

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    result.batchesProcessed = batchCount
  }

  /**
   * Process a batch of outstanding users
   */
  private async processBatch(users: Array<{userId: bigint}>, dryRun: boolean): Promise<{
    checked: number
    conversions: OutstandingRequirementsConversionData[]
    updated: number
  }> {
    
    if (users.length === 0) {
      return { checked: 0, conversions: [], updated: 0 }
    }

    const userIds = users.map(u => u.userId.toString())

    // Get user requirements status from MySQL replica
    const userRequirementsQuery = `
      SELECT 
        u.id as user_id,
        u.is_enabled,
        u.current_signature_file_id,
        COUNT(CASE 
          WHEN cr.status = 'PENDING' 
            AND cr.type NOT IN (${this.EXCLUDED_REQUIREMENT_TYPES.map(() => '?').join(', ')})
          THEN 1 
        END) as pending_requirements_count
      FROM users u
      LEFT JOIN claims c ON u.id = c.user_id
      LEFT JOIN claim_requirements cr ON c.id = cr.claim_id
      WHERE u.id IN (${userIds.join(',')})
        AND u.is_enabled = 1
      GROUP BY u.id, u.is_enabled, u.current_signature_file_id
    `

    const userRequirementsData = await replicaDb.$queryRawUnsafe(
      userRequirementsQuery, 
      ...this.EXCLUDED_REQUIREMENT_TYPES
    ) as Array<{
      user_id: string
      is_enabled: boolean
      current_signature_file_id: number | null
      pending_requirements_count: number
    }>

    // Find users who have completed all requirements (conversions)
    const conversions: OutstandingRequirementsConversionData[] = userRequirementsData
      .filter(user => 
        user.is_enabled && 
        user.current_signature_file_id !== null && // Still has signature
        user.pending_requirements_count === 0      // No pending requirements
      )
      .map(user => ({
        userId: BigInt(user.user_id),
        completedAt: new Date(),
        finalPendingRequirements: 0
      }))

    logger.info(`🔍 [BATCH] ${userRequirementsData.length} users checked, ${conversions.length} requirement conversions found`)

    if (conversions.length === 0 || dryRun) {
      return { 
        checked: userRequirementsData.length, 
        conversions, 
        updated: dryRun ? conversions.length : 0
      }
    }

    // Update users who completed all requirements: set queue to null and deactivate
    let updated = 0
    for (const conversion of conversions) {
      try {
        // Get current user call score data for conversion logging
        const currentUserScore = await prisma.userCallScore.findUnique({
          where: { userId: conversion.userId },
          select: {
            currentScore: true,
            totalAttempts: true,
            lastCallAt: true,
            // @ts-ignore - currentQueueType exists in database
            currentQueueType: true
          }
        })

        // Update user call score
        const updateResult = await prisma.userCallScore.updateMany({
          where: { 
            userId: conversion.userId,
            // @ts-ignore - currentQueueType exists in database
            currentQueueType: 'outstanding_requests' // Only update if still in outstanding queue
          },
          data: { 
            // @ts-ignore - currentQueueType exists in database
            currentQueueType: null,     // Remove from queue (user is complete)
            currentScore: 0,            // Reset score to highest priority
            isActive: false,            // Deactivate (no longer needs calling)
            // @ts-ignore - lastQueueCheck exists in database
            lastQueueCheck: new Date()  // Update check timestamp
          }
        })

        if (updateResult.count > 0) {
          updated += updateResult.count

          // Create conversion record in database
          await prisma.conversion.create({
            data: {
              userId: conversion.userId,
              previousQueueType: 'outstanding_requests',
              conversionType: 'requirements_completed',
              conversionReason: 'All outstanding requirements have been fulfilled - user complete',
              finalScore: currentUserScore?.currentScore || 0,
              totalCallAttempts: currentUserScore?.totalAttempts || 0,
              lastCallAt: currentUserScore?.lastCallAt,
              signatureObtained: true, // Already had signature to be in outstanding_requests
              convertedAt: conversion.completedAt
            }
          })

          logger.info(`📝 [CONVERSION] Created conversion record for user ${conversion.userId}`)
        }
      } catch (error: any) {
        logger.error(`❌ Failed to update user ${conversion.userId}:`, error)
      }
    }

    return {
      checked: userRequirementsData.length,
      conversions,
      updated
    }
  }

  /**
   * Check if approaching timeout
   */
  private isTimeoutApproaching(): boolean {
    const elapsed = Date.now() - this.startTime
    return elapsed > this.MAX_EXECUTION_TIME
  }
} 