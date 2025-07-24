// =============================================================================
// QUEUE TYPE MIGRATION: Requirements to Outstanding Requests
// =============================================================================
// ⚠️  This is a ONE-TIME migration to fix queue type naming
// ⚠️  Converts currentQueueType: 'requirements' → 'outstanding_requests'
// ⚠️  Safe to run multiple times (idempotent)

import { prisma } from '@/lib/db'
import { logger } from '@/modules/core'

export interface RequirementsToOutstandingMigrationResult {
  timestamp: Date
  duration: number
  success: boolean
  errors: string[]
  summary: string
  totalUsersChecked: number
  usersWithRequirementsQueue: number
  usersUpdated: number
  batchesProcessed: number
  progress: {
    processed: number
    total: number
    percentage: number
  }
}

export interface RequirementsMigrationOptions {
  batchSize?: number
  dryRun?: boolean
  maxUsers?: number
  offset?: number
}

/**
 * Requirements to Outstanding Requests Migration Service
 * 
 * 🎯 MIGRATION GOALS:
 * 1. Find all user_call_scores WHERE currentQueueType = 'requirements'
 * 2. Update them to currentQueueType = 'outstanding_requests'
 * 3. Track progress and provide detailed logging
 * 4. Safe, idempotent operation
 * 
 * 🎯 PERFORMANCE:
 * - Batch processing (200 users per batch)
 * - Progress tracking every batch
 * - Resume-able (can run multiple times safely)
 * - Handles any volume without timeout
 */
export class RequirementsToOutstandingMigrationService {
  private readonly DEFAULT_BATCH_SIZE = 200
  private readonly MAX_EXECUTION_TIME = 25000 // 25 seconds
  private startTime: number = 0

  /**
   * Run the queue type migration
   */
  async runRequirementsMigration(options: RequirementsMigrationOptions = {}): Promise<RequirementsToOutstandingMigrationResult> {
    this.startTime = Date.now()
    const { 
      batchSize = this.DEFAULT_BATCH_SIZE, 
      dryRun = false,
      maxUsers = undefined,
      offset = 0 
    } = options

    const result: RequirementsToOutstandingMigrationResult = {
      timestamp: new Date(),
      duration: 0,
      success: false,
      errors: [],
      summary: '',
      totalUsersChecked: 0,
      usersWithRequirementsQueue: 0,
      usersUpdated: 0,
      batchesProcessed: 0,
      progress: { processed: 0, total: 0, percentage: 0 }
    }

    try {
      logger.info(`🔄 [MIGRATION START] Requirements → Outstanding Requests Migration`)
      logger.info(`   📊 Settings: batchSize=${batchSize}, dryRun=${dryRun}, maxUsers=${maxUsers || 'all'}`)
      logger.info(`   🎯 Converting currentQueueType: 'requirements' → 'outstanding_requests'`)

      // Step 1: Count total users with 'requirements' queue type
      const totalRequirementsUsers = await this.countUsersWithRequirementsQueue()
      result.totalUsersChecked = totalRequirementsUsers
      result.usersWithRequirementsQueue = totalRequirementsUsers
      result.progress.total = maxUsers ? Math.min(maxUsers, totalRequirementsUsers) : totalRequirementsUsers

      logger.info(`📊 [MIGRATION] Found ${totalRequirementsUsers} users with currentQueueType = 'requirements'`)
      logger.info(`🎯 [MIGRATION] Will process ${result.progress.total} users total`)

      if (totalRequirementsUsers === 0) {
        result.success = true
        result.summary = `✅ Migration Complete: No users need queue type migration`
        logger.info(`✅ [MIGRATION] No users need migration - all queue types are correct`)
        return result
      }

      // Step 2: Process users in batches
      let processedCount = 0
      let batchCount = 0
      const limit = maxUsers || totalRequirementsUsers

      while (processedCount < limit && !this.isTimeoutApproaching()) {
        const currentOffset = offset + processedCount
        const currentBatchSize = Math.min(batchSize, limit - processedCount)

        logger.info(`🔄 [BATCH ${batchCount + 1}] Processing users ${currentOffset + 1}-${currentOffset + currentBatchSize}`)

        const batchResult = await this.processBatch(currentOffset, currentBatchSize, dryRun)
        
        result.usersUpdated += batchResult.updated
        
        processedCount += currentBatchSize
        batchCount++
        result.batchesProcessed = batchCount
        result.progress.processed = processedCount
        result.progress.percentage = Math.round((processedCount / result.progress.total) * 100)

        logger.info(`✅ [BATCH ${batchCount}] Complete: ${batchResult.updated} users updated to outstanding_requests`)
        logger.info(`📈 [PROGRESS] ${processedCount}/${result.progress.total} users processed (${result.progress.percentage}%)`)

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      result.success = true
      result.summary = dryRun 
        ? `🧪 DRY RUN: Would update ${result.usersUpdated} users from 'requirements' to 'outstanding_requests' queue`
        : `✅ Migration: Updated ${result.usersUpdated} users from 'requirements' to 'outstanding_requests' queue`

      logger.info(`🎉 [MIGRATION COMPLETE] Requirements Queue Migration Summary:`)
      logger.info(`   📊 Total users checked: ${result.totalUsersChecked}`)
      logger.info(`   📝 Users with 'requirements' queue: ${result.usersWithRequirementsQueue}`)
      logger.info(`   ⚡ Users updated: ${result.usersUpdated}`)
      logger.info(`   📦 Batches processed: ${result.batchesProcessed}`)
      logger.info(`   📈 Progress: ${result.progress.percentage}% complete`)

    } catch (error: any) {
      result.errors.push(`Migration failed: ${error.message}`)
      result.summary = `❌ Migration Failed: ${error.message}`
      logger.error(`❌ [MIGRATION ERROR]`, error)
    }

    result.duration = Date.now() - this.startTime
    return result
  }

  /**
   * Count users with currentQueueType = 'requirements'
   */
  private async countUsersWithRequirementsQueue(): Promise<number> {
    try {
      const count = await prisma.userCallScore.count({
        where: {
          // @ts-ignore - currentQueueType exists in schema
          currentQueueType: 'requirements'
        }
      })
      return count
    } catch (error: any) {
      logger.error(`❌ Error counting requirements queue users:`, error)
      throw error
    }
  }

  /**
   * Process a batch of users
   */
  private async processBatch(offset: number, batchSize: number, dryRun: boolean): Promise<{
    updated: number
  }> {
    try {
      // Get batch of users with 'requirements' queue type
      const usersToUpdate = await prisma.userCallScore.findMany({
        where: {
          // @ts-ignore - currentQueueType exists in schema
          currentQueueType: 'requirements'
        },
        select: {
          id: true,
          userId: true,
          // @ts-ignore - currentQueueType exists in schema
          currentQueueType: true
        },
        skip: offset,
        take: batchSize,
        orderBy: {
          userId: 'asc'
        }
      })

      if (usersToUpdate.length === 0) {
        return { updated: 0 }
      }

      logger.info(`🔍 [BATCH DEBUG] Found ${usersToUpdate.length} users with 'requirements' queue type`)

      // Update users to 'outstanding_requests' queue type
      let updatedCount = 0
      if (usersToUpdate.length > 0 && !dryRun) {
        const updateResult = await prisma.userCallScore.updateMany({
          where: {
            // @ts-ignore - currentQueueType exists in schema
            currentQueueType: 'requirements'
          },
          data: {
            // @ts-ignore - currentQueueType exists in schema
            currentQueueType: 'outstanding_requests'
          }
        })
        updatedCount = updateResult.count
      } else if (dryRun) {
        updatedCount = usersToUpdate.length
      }

      logger.info(`🔄 [BATCH] ${dryRun ? 'Would update' : 'Updated'} ${updatedCount} users`)

      return { updated: updatedCount }

    } catch (error: any) {
      logger.error(`❌ Error processing batch at offset ${offset}:`, error)
      throw error
    }
  }

  /**
   * Check if we're approaching timeout
   */
  private isTimeoutApproaching(): boolean {
    return (Date.now() - this.startTime) > this.MAX_EXECUTION_TIME
  }
} 