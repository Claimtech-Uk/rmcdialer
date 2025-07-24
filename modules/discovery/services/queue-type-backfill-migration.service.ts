// =============================================================================
// ONE-OFF MIGRATION: Queue Type Backfill Service
// =============================================================================
// ⚠️  This is a ONE-TIME migration to fix existing user_call_scores entries
// ⚠️  Most users currently have currentQueueType: null when they should be 'unsigned_users'
// ⚠️  This service may never be needed again after initial backfill

import { replicaDb } from '@/lib/mysql'
import { prisma } from '@/lib/db'
import { logger } from '@/modules/core'
import type { 
  QueueTypeMigrationResult, 
  UserQueueMigrationData, 
  MigrationOptions,
  DiscoveryServiceDependencies 
} from '../types/discovery.types'

/**
 * Queue Type Backfill Migration Service
 * 
 * 🎯 MIGRATION GOALS:
 * 1. Find all user_call_scores WHERE currentQueueType IS NULL
 * 2. Check read replica: current_signature_file_id IS NULL = unsigned
 * 3. Update unsigned users to currentQueueType = 'unsigned_users'
 * 4. Leave signed users as null (for future requirements discovery)
 * 
 * 🎯 PERFORMANCE:
 * - Batch processing (300 users per batch)
 * - Progress tracking every batch
 * - Resume-able (can run multiple times safely)
 * - Handles 12,000+ users without timeout
 */
export class QueueTypeBackfillMigrationService {
  private readonly DEFAULT_BATCH_SIZE = 300
  private readonly MAX_EXECUTION_TIME = 25000 // 25 seconds
  private startTime: number = 0

  constructor(private dependencies?: DiscoveryServiceDependencies) {}

  /**
   * Run the one-off migration to backfill queue types
   */
  async runBackfillMigration(options: MigrationOptions = {}): Promise<QueueTypeMigrationResult> {
    this.startTime = Date.now()
    const { 
      batchSize = this.DEFAULT_BATCH_SIZE, 
      dryRun = false,
      maxUsers = undefined,
      offset = 0 
    } = options

    const result: QueueTypeMigrationResult = {
      timestamp: new Date(),
      duration: 0,
      success: false,
      errors: [],
      summary: '',
      totalUsersChecked: 0,
      usersWithNullQueue: 0,
      usersProcessed: 0,
      unsignedUsersUpdated: 0,
      signedUsersSkipped: 0,
      batchesProcessed: 0,
      progress: { processed: 0, total: 0, percentage: 0 }
    }

    try {
      logger.info(`🔄 [MIGRATION START] Queue Type Backfill Migration`)
      logger.info(`   📊 Settings: batchSize=${batchSize}, dryRun=${dryRun}, maxUsers=${maxUsers || 'all'}`)
      logger.info(`   ⚠️  One-off migration to fix currentQueueType for existing users`)

      // Step 1: Count total users with null queue type
      const totalNullUsers = await this.countUsersWithNullQueue()
      result.totalUsersChecked = totalNullUsers
      result.usersWithNullQueue = totalNullUsers
      result.progress.total = maxUsers ? Math.min(maxUsers, totalNullUsers) : totalNullUsers

      logger.info(`📊 [MIGRATION] Found ${totalNullUsers} users with currentQueueType = null`)
      logger.info(`🎯 [MIGRATION] Will process ${result.progress.total} users total`)

      if (totalNullUsers === 0) {
        result.success = true
        result.summary = `✅ Migration Complete: No users need queue type backfill`
        logger.info(`✅ [MIGRATION] No users need migration - all queue types already set`)
        return result
      }

      // Step 2: Process users in batches
      let processedCount = 0
      let batchCount = 0
      const limit = maxUsers || totalNullUsers

      while (processedCount < limit && !this.isTimeoutApproaching()) {
        const currentOffset = offset + processedCount
        const currentBatchSize = Math.min(batchSize, limit - processedCount)

        logger.info(`🔄 [BATCH ${batchCount + 1}] Processing users ${currentOffset + 1}-${currentOffset + currentBatchSize}`)

        const batchResult = await this.processBatch(currentOffset, currentBatchSize, dryRun)
        
        result.usersProcessed += batchResult.processed
        result.unsignedUsersUpdated += batchResult.unsignedUpdated
        result.signedUsersSkipped += batchResult.signedSkipped
        
        processedCount += currentBatchSize
        batchCount++
        result.batchesProcessed = batchCount
        result.progress.processed = processedCount
        result.progress.percentage = Math.round((processedCount / result.progress.total) * 100)

        logger.info(`✅ [BATCH ${batchCount}] Complete: ${batchResult.unsignedUpdated} unsigned users updated, ${batchResult.signedSkipped} signed users skipped`)
        logger.info(`📈 [PROGRESS] ${processedCount}/${result.progress.total} users processed (${result.progress.percentage}%)`)

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      result.success = true
      result.summary = dryRun 
        ? `🧪 DRY RUN: Would update ${result.unsignedUsersUpdated} users to unsigned_users queue`
        : `✅ Migration: Updated ${result.unsignedUsersUpdated} users to unsigned_users queue, skipped ${result.signedUsersSkipped} signed users`

      logger.info(`🎉 [MIGRATION COMPLETE] Queue Type Backfill Summary:`)
      logger.info(`   📊 Total users checked: ${result.totalUsersChecked}`)
      logger.info(`   📝 Users with null queue: ${result.usersWithNullQueue}`)
      logger.info(`   ⚡ Users processed: ${result.usersProcessed}`)
      logger.info(`   ✅ Unsigned users updated: ${result.unsignedUsersUpdated}`)
      logger.info(`   ⏭️  Signed users skipped: ${result.signedUsersSkipped}`)
      logger.info(`   📦 Batches processed: ${result.batchesProcessed}`)
      logger.info(`   ${dryRun ? '🧪 DRY RUN MODE' : '💾 CHANGES APPLIED'}`)

    } catch (error: any) {
      result.errors.push(`Migration failed: ${error.message}`)
      result.summary = `❌ Migration Failed: ${error.message}`
      logger.error(`❌ [MIGRATION ERROR]`, error)
    }

    result.duration = Date.now() - this.startTime
    return result
  }

  /**
   * Count users in user_call_scores with currentQueueType = null
   */
  private async countUsersWithNullQueue(): Promise<number> {
    try {
      const count = await prisma.userCallScore.count({
        where: {
          // @ts-ignore - One-off migration, currentQueueType exists in schema
          currentQueueType: null
        }
      })
      return count
    } catch (error: any) {
      logger.error(`❌ Error counting null queue users:`, error)
      throw error
    }
  }

  /**
   * Process a batch of users
   */
  private async processBatch(offset: number, batchSize: number, dryRun: boolean): Promise<{
    processed: number
    unsignedUpdated: number
    signedSkipped: number
  }> {
    try {
      // Get batch of users with null queue type
      const usersToCheck = await prisma.userCallScore.findMany({
        where: {
          // @ts-ignore - One-off migration, currentQueueType exists in schema
          currentQueueType: null
        },
        select: {
          userId: true,
          // @ts-ignore - One-off migration, currentQueueType exists in schema
          currentQueueType: true
        },
        skip: offset,
        take: batchSize,
        orderBy: {
          userId: 'asc'
        }
      })

      if (usersToCheck.length === 0) {
        return { processed: 0, unsignedUpdated: 0, signedSkipped: 0 }
      }

      const userIds = usersToCheck.map(u => u.userId.toString())

      // Query read replica to check signature status
      const userSignatureStatus = await replicaDb.$queryRawUnsafe(
        `SELECT 
           id,
           current_signature_file_id
         FROM users 
         WHERE id IN (${userIds.join(',')})`
      ) as Array<{
        id: string
        current_signature_file_id: number | null
      }>

      // Separate unsigned users that need updating
      const unsignedUserIds: bigint[] = []
      let signedCount = 0

      for (const user of userSignatureStatus) {
        // If current_signature_file_id IS NULL, user is unsigned
        if (user.current_signature_file_id === null) {
          unsignedUserIds.push(BigInt(user.id))
        } else {
          signedCount++
        }
      }

      logger.info(`🔍 [BATCH DEBUG] Processed ${userSignatureStatus.length} users`)
      logger.info(`   🔍 Found ${unsignedUserIds.length} unsigned users (null signature)`)
      logger.info(`   ✍️  Found ${signedCount} signed users (has signature)`)
      logger.info(`   📝 Sample data: ${userSignatureStatus.slice(0, 3).map(u => 
        `ID:${u.id}(sig:${u.current_signature_file_id === null ? 'NULL' : u.current_signature_file_id})`
      ).join(', ')}`)

      // Update unsigned users to 'unsigned_users' queue
      let updatedCount = 0
      if (unsignedUserIds.length > 0 && !dryRun) {
        const updateResult = await prisma.userCallScore.updateMany({
          where: {
            userId: {
              in: unsignedUserIds
            },
            // @ts-ignore - One-off migration, currentQueueType exists in schema
            currentQueueType: null
          },
          data: {
            // @ts-ignore - One-off migration, currentQueueType exists in schema
            currentQueueType: 'unsigned_users'
          }
        })
        updatedCount = updateResult.count
      } else if (dryRun) {
        updatedCount = unsignedUserIds.length
      }

      return {
        processed: usersToCheck.length,
        unsignedUpdated: updatedCount,
        signedSkipped: signedCount
      }

    } catch (error: any) {
      logger.error(`❌ Error processing batch at offset ${offset}:`, error)
      throw error
    }
  }

  /**
   * Check if we're approaching timeout
   */
  private isTimeoutApproaching(): boolean {
    const elapsed = Date.now() - this.startTime
    return elapsed > this.MAX_EXECUTION_TIME
  }
} 