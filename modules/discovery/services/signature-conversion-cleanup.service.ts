// =============================================================================
// Signature Conversion Cleanup Service - Discovery Module
// =============================================================================
// Cron 2: Check unsigned users for signature conversions every hour

import { replicaDb } from '@/lib/mysql'
import { prisma } from '@/lib/db'
import { logger } from '@/modules/core'
import type { 
  SignatureConversionResult, 
  SignatureConversionData, 
  DiscoveryOptions,
  DiscoveryServiceDependencies 
} from '../types/discovery.types'

/**
 * Signature Conversion Cleanup Service
 * 
 * 🎯 CORE GOALS:
 * 1. Get ALL user_call_scores with currentQueueType = 'unsigned_users'
 * 2. Check them against MySQL replica for current_signature_file_id
 * 3. Users who now have signatures:
 *    - Set currentQueueType = null (remove from queue)
 *    - Set currentScore = 0 (reset priority)
 *    - Track as conversions
 * 
 * 🎯 PERFORMANCE:
 * - Process up to ~6,000 users in 28 seconds
 * - Batch processing (400 users per batch)
 * - Complete hourly validation of unsigned queue
 * - Smart prioritization for large volumes
 */
export class SignatureConversionCleanupService {
  private readonly DEFAULT_BATCH_SIZE = 400
  private readonly MAX_EXECUTION_TIME = 28000 // 28 seconds
  private startTime: number = 0

  constructor(private dependencies?: DiscoveryServiceDependencies) {}

  /**
   * Run hourly signature conversion cleanup
   */
  async cleanupSignatureConversions(options: DiscoveryOptions = {}): Promise<SignatureConversionResult> {
    this.startTime = Date.now()
    const { 
      batchSize = this.DEFAULT_BATCH_SIZE,
      dryRun = false 
    } = options

    const result: SignatureConversionResult = {
      timestamp: new Date(),
      duration: 0,
      success: false,
      errors: [],
      summary: '',
      totalUnsignedUsers: 0,
      usersChecked: 0,
      conversionsFound: 0,
      usersUpdated: 0,
      batchesProcessed: 0,
      processingStrategy: '',
      completed: false,
      conversions: []
    }

    try {
      logger.info(`🧹 [SIGNATURE CLEANUP] Starting hourly signature conversion cleanup`)
      
      // Step 1: Get ALL unsigned users from user_call_scores
      const allUnsignedUsers = await this.getAllUnsignedUsers()
      result.totalUnsignedUsers = allUnsignedUsers.length
      
      if (allUnsignedUsers.length === 0) {
        result.success = true
        result.completed = true
        result.summary = `✅ No users in unsigned queue to check`
        logger.info(result.summary)
        return result
      }

      logger.info(`📊 Found ${allUnsignedUsers.length} users in unsigned_users queue`)
      
      // Step 2: Determine processing strategy
      const maxProcessable = this.calculateMaxProcessable(batchSize)
      
      if (allUnsignedUsers.length <= maxProcessable) {
        // ✅ Can process everyone this hour
        result.processingStrategy = 'complete_processing'
        await this.processAllUsers(allUnsignedUsers, batchSize, dryRun, result)
        result.completed = true
        
      } else {
        // ⚡ Process priority users this hour
        result.processingStrategy = 'priority_processing'
        const priorityUsers = this.prioritizeUsers(allUnsignedUsers, maxProcessable)
        await this.processAllUsers(priorityUsers, batchSize, dryRun, result)
        result.completed = false
        
        logger.warn(`⚠️ Volume too high: processed ${maxProcessable}/${allUnsignedUsers.length} users`)
      }

      result.success = true
      result.summary = dryRun 
        ? `🧪 DRY RUN: Found ${result.conversionsFound} signature conversions (${result.processingStrategy})`
        : `✅ Signature Cleanup: ${result.conversionsFound} conversions processed, ${result.usersUpdated} users updated (${result.processingStrategy})`

      logger.info(`🎉 [CLEANUP COMPLETE] Signature Conversion Summary:`)
      logger.info(`   📊 Total unsigned users: ${result.totalUnsignedUsers}`)
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
   * Get all users with currentQueueType = 'unsigned_users'
   */
  private async getAllUnsignedUsers(): Promise<Array<{userId: bigint}>> {
    try {
      return await prisma.userCallScore.findMany({
        where: {
          // @ts-ignore - currentQueueType exists in database
          currentQueueType: 'unsigned_users',
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
      logger.error(`❌ Error getting unsigned users:`, error)
      throw error
    }
  }

  /**
   * Calculate maximum processable users in 28 seconds
   */
  private calculateMaxProcessable(batchSize: number): number {
    const secondsPerBatch = 2.5 // Conservative estimate
    const maxBatches = Math.floor(this.MAX_EXECUTION_TIME / 1000 / secondsPerBatch)
    return maxBatches * batchSize // ~6,720 users max
  }

  /**
   * Prioritize users when volume is too high
   */
  private prioritizeUsers(allUsers: Array<{userId: bigint}>, maxCount: number): Array<{userId: bigint}> {
    // Already ordered by priority in getAllUnsignedUsers()
    return allUsers.slice(0, maxCount)
  }

  /**
   * Process all users in batches
   */
  private async processAllUsers(
    users: Array<{userId: bigint}>, 
    batchSize: number, 
    dryRun: boolean, 
    result: SignatureConversionResult
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
   * Process a batch of unsigned users
   */
  private async processBatch(users: Array<{userId: bigint}>, dryRun: boolean): Promise<{
    checked: number
    conversions: SignatureConversionData[]
    updated: number
  }> {
    
    if (users.length === 0) {
      return { checked: 0, conversions: [], updated: 0 }
    }

    const userIds = users.map(u => u.userId.toString())

    // Check current signature status in MySQL replica
    const userSignatureStatus = await replicaDb.$queryRawUnsafe(`
      SELECT 
        id,
        current_signature_file_id,
        is_enabled
      FROM users 
      WHERE id IN (${userIds.join(',')})
        AND is_enabled = 1
    `) as Array<{
      id: string
      current_signature_file_id: number | null
      is_enabled: boolean
    }>

    // Find users who now have signatures (conversions)
    const conversions: SignatureConversionData[] = userSignatureStatus
      .filter(user => user.current_signature_file_id !== null && user.is_enabled)
      .map(user => ({
        userId: BigInt(user.id),
        signatureFileId: user.current_signature_file_id!,
        convertedAt: new Date()
      }))

    logger.info(`🔍 [BATCH] ${userSignatureStatus.length} users checked, ${conversions.length} signature conversions found`)

    if (conversions.length === 0 || dryRun) {
      return { 
        checked: userSignatureStatus.length, 
        conversions, 
        updated: dryRun ? conversions.length : 0
      }
    }

    // Update users who got signatures: set queue to null and score to 0
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
            currentQueueType: 'unsigned_users' // Only update if still in unsigned queue
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

          // Check if a conversion already exists for this user within the last hour
          // to prevent race conditions with live call outcomes
          const recentConversion = await prisma.conversion.findFirst({
            where: {
              userId: conversion.userId,
              convertedAt: {
                gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
              }
            }
          });

          if (recentConversion) {
            logger.info(`⏭️ [SKIP] User ${conversion.userId} already has recent conversion ${recentConversion.id}, skipping duplicate`);
          } else {
            // Create conversion record in database
            await prisma.conversion.create({
              data: {
                userId: conversion.userId,
                previousQueueType: 'unsigned_users',
                conversionType: 'signature_obtained',
                conversionReason: 'User provided signature - moved from unsigned queue',
                finalScore: currentUserScore?.currentScore || 0,
                totalCallAttempts: currentUserScore?.totalAttempts || 0,
                lastCallAt: currentUserScore?.lastCallAt,
                signatureObtained: true,
                convertedAt: conversion.convertedAt
              }
            })

            logger.info(`📝 [CONVERSION] Created conversion record for user ${conversion.userId}`)
          }
        }
      } catch (error: any) {
        logger.error(`❌ Failed to update user ${conversion.userId}:`, error)
      }
    }

    return {
      checked: userSignatureStatus.length,
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