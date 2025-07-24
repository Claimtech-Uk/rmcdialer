// =============================================================================
// New Users Discovery Service - Discovery Module
// =============================================================================
// Cron 1: Add new users from last hour and assign to appropriate queue

import { replicaDb } from '@/lib/mysql'
import { prisma } from '@/lib/db'
import { logger } from '@/modules/core'
import type { 
  NewUsersDiscoveryResult, 
  NewUserData, 
  DiscoveryOptions,
  DiscoveryServiceDependencies 
} from '../types/discovery.types'

/**
 * New Users Discovery Service
 * 
 * 🎯 CORE GOALS:
 * 1. Find users created in the last hour
 * 2. Add new users with score 0 (highest priority)
 * 3. Assign queue based on signature status:
 *    - No signature → unsigned_users queue
 *    - Has signature → no queue (complete)
 * 
 * 🎯 OPTIMIZATIONS:
 * - Only processes recent users (not all 12K+ users)
 * - Skips users already in user_call_scores
 * - Batch processing for performance
 * - Simple signature-only logic (no complex requirements)
 */
export class NewUsersDiscoveryService {
  private readonly BATCH_SIZE = 50
  private readonly MAX_EXECUTION_TIME = 25000 // 25 seconds (5s buffer)
  private startTime: number = 0

  constructor(private dependencies?: DiscoveryServiceDependencies) {}

  /**
   * Discover and add new users from the specified time window
   */
  async discoverNewUsers(options: DiscoveryOptions = {}): Promise<NewUsersDiscoveryResult> {
    this.startTime = Date.now()
    const { hoursBack = 1, dryRun = false } = options

    const result: NewUsersDiscoveryResult = {
      timestamp: new Date(),
      duration: 0,
      success: false,
      errors: [],
      summary: '',
      usersChecked: 0,
      newUsersFound: 0,
      newUsersCreated: 0,
      skippedExisting: 0,
      unsigned: 0,
      signed: 0
    }

    logger.info(`🆕 Starting new users discovery (last ${hoursBack} hour${hoursBack !== 1 ? 's' : ''})`)

    try {
      // Step 1: Get recent users from MySQL
      const recentUsers = await this.getRecentUsersFromMySQL(hoursBack)
      result.usersChecked = recentUsers.length
      
      if (recentUsers.length === 0) {
        result.success = true
        result.summary = `✅ No new users found in last ${hoursBack} hour(s)`
        logger.info(result.summary)
        return result
      }

      logger.info(`🔍 Found ${recentUsers.length} users created in last ${hoursBack} hour(s)`)

      // Step 2: Filter out users already in user_call_scores
      const newUsers = await this.filterNewUsers(recentUsers)
      result.newUsersFound = newUsers.length
      result.skippedExisting = recentUsers.length - newUsers.length

      if (newUsers.length === 0) {
        result.success = true
        result.summary = `✅ All ${recentUsers.length} recent users already processed`
        logger.info(result.summary)
        return result
      }

      logger.info(`🔄 [FILTERING] Checking which users are genuinely new...`)
      logger.info(`   ✅ ${newUsers.length} NEW users (need processing)`)
      logger.info(`   ⏭️  ${result.skippedExisting} users already scored (skipped)`)

      // Step 3: Process new users in batches
      if (!dryRun) {
        await this.processNewUsersInBatches(newUsers, result)
      }

      result.success = true
      result.summary = `✅ New Users Discovery: ${result.newUsersCreated} users added to system (${result.unsigned} unsigned queue, ${result.signed} null queue)`
      
      // Enhanced completion logging
      logger.info(`🎉 [DISCOVERY COMPLETE] Summary:`)
      logger.info(`   📊 Total users checked: ${result.usersChecked}`)
      logger.info(`   🆕 New users found: ${result.newUsersFound}`)
      logger.info(`   ➕ Users added to system: ${result.newUsersCreated} (all new users)`)
      logger.info(`   📝 Breakdown: ${result.unsigned} unsigned (queue: unsigned_users), ${result.signed} signed (queue: null)`)
      logger.info(`   🔗 All users now available for later crons (requirements, conversions, etc.)`)
      logger.info(`   ⏭️  Already processed: ${result.skippedExisting}`)
      logger.info(result.summary)

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      result.errors.push(errorMsg)
      result.summary = `❌ New users discovery failed: ${errorMsg}`
      logger.error(result.summary, error)
    } finally {
      result.duration = Date.now() - this.startTime
    }

    return result
  }

  /**
   * Get users created in the specified time window from MySQL
   */
  private async getRecentUsersFromMySQL(hoursBack: number): Promise<NewUserData[]> {
    const now = new Date()
    const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000))
    
    logger.info(`🔍 [DISCOVERY] Searching for users created between:`)
    logger.info(`   📅 From: ${cutoffTime.toISOString()} (${hoursBack} hour${hoursBack !== 1 ? 's' : ''} ago)`)
    logger.info(`   📅 To:   ${now.toISOString()} (now)`)

    const query = `
      SELECT 
        u.id,
        u.current_signature_file_id
      FROM users u
      WHERE u.created_at >= ?
        AND u.is_enabled = 1
      ORDER BY u.created_at DESC
    `

    const users = await replicaDb.$queryRawUnsafe(query, cutoffTime) as Array<{
      id: bigint
      current_signature_file_id: number | null
    }>

    const signedCount = users.filter(u => u.current_signature_file_id !== null).length
    const unsignedCount = users.filter(u => u.current_signature_file_id === null).length

    logger.info(`📊 [DISCOVERY] Found ${users.length} users in time window:`)
    logger.info(`   ✍️  ${signedCount} signed users (will get queue: null)`)
    logger.info(`   📝 ${unsignedCount} unsigned users (will get queue: unsigned_users)`)
    logger.info(`   🗄️  All users will be added to user_call_scores for future cron reference`)

    return users.map(user => ({
      id: user.id,
      hasSignature: user.current_signature_file_id !== null,
      queueType: user.current_signature_file_id !== null ? null : 'unsigned_users' as const
    }))
  }

  /**
   * Filter out users that already exist in user_call_scores
   */
  private async filterNewUsers(recentUsers: NewUserData[]): Promise<NewUserData[]> {
    const userIds = recentUsers.map(user => user.id)
    
    const existingScores = await prisma.userCallScore.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true }
    })
    
    const existingUserIds = new Set(existingScores.map(score => score.userId))
    return recentUsers.filter(user => !existingUserIds.has(user.id))
  }

  /**
   * Process new users in batches to avoid timeout
   */
  private async processNewUsersInBatches(
    newUsers: NewUserData[], 
    result: NewUsersDiscoveryResult
  ): Promise<void> {
    let processed = 0

    for (let i = 0; i < newUsers.length; i += this.BATCH_SIZE) {
      // Check execution time
      if (Date.now() - this.startTime > this.MAX_EXECUTION_TIME) {
        logger.warn(`⏰ Execution time limit reached, stopping at ${processed}/${newUsers.length} users`)
        break
      }

      const batch = newUsers.slice(i, i + this.BATCH_SIZE)
      
      // Create user_call_scores entries for ALL new users (signed and unsigned)
      const usersToCreate = batch // No filtering - add all users
      
      if (usersToCreate.length > 0) {
        const userScoresToCreate = usersToCreate.map(user => ({
          userId: user.id,
          currentScore: 0, // New users get highest priority
          totalAttempts: 0,
          lastCallAt: null,
          isActive: true,
          currentQueueType: user.queueType // Can be null for signed users
        }))

        await prisma.userCallScore.createMany({
          data: userScoresToCreate,
          skipDuplicates: true
        })

        result.newUsersCreated += usersToCreate.length
        logger.info(`✅ [BATCH ${Math.floor(i / this.BATCH_SIZE) + 1}] Created ${usersToCreate.length} user_call_scores entries`)
        logger.info(`   📈 Progress: ${result.newUsersCreated}/${newUsers.length} total users added to system`)
      }

      // Update counters
      for (const user of batch) {
        if (user.hasSignature) {
          result.signed++
        } else {
          result.unsigned++
        }
      }

      processed += batch.length
    }
  }
} 