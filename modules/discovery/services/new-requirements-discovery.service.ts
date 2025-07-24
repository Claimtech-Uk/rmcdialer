// =============================================================================
// New Requirements Discovery Service - Discovery Module
// =============================================================================
// Cron 3: Find new requirements and update user queue types

import { replicaDb } from '@/lib/mysql'
import { prisma } from '@/lib/db'
import { logger } from '@/modules/core'
import type { 
  NewRequirementsDiscoveryResult, 
  NewRequirementData, 
  DiscoveryOptions,
  DiscoveryServiceDependencies 
} from '../types/discovery.types'

/**
 * New Requirements Discovery Service
 * 
 * 🎯 CORE GOALS:
 * 1. Find new requirements created in the last hour
 * 2. Connect requirements → claims → users
 * 3. Update user queue type to 'requirements'
 * 4. Exclude specific requirement types
 * 5. Skip unsigned users (unsigned takes priority)
 * 
 * 🚫 EXCLUDED REQUIREMENT TYPES:
 * - signature
 * - vehicle_registration 
 * - cfa
 * - solicitor_letter_of_authority
 * - letter_of_authority
 */
export class NewRequirementsDiscoveryService {
  private readonly BATCH_SIZE = 50
  private readonly MAX_EXECUTION_TIME = 25000 // 25 seconds
  private readonly EXCLUDED_TYPES = [
    'signature',
    'vehicle_registration', 
    'cfa',
    'solicitor_letter_of_authority',
    'letter_of_authority'
  ]
  private startTime: number = 0

  constructor(private dependencies?: DiscoveryServiceDependencies) {}

  /**
   * Discover new requirements and update user queue types
   */
  async discoverNewRequirements(options: DiscoveryOptions = {}): Promise<NewRequirementsDiscoveryResult> {
    this.startTime = Date.now()
    const { hoursBack = 1, dryRun = false } = options

    const result: NewRequirementsDiscoveryResult = {
      timestamp: new Date(),
      duration: 0,
      success: false,
      errors: [],
      summary: '',
      requirementsChecked: 0,
      newRequirementsFound: 0,
      usersUpdated: 0,
      skippedUnsigned: 0,
      excludedTypes: 0
    }

    logger.info(`📋 Starting new requirements discovery (last ${hoursBack} hour${hoursBack !== 1 ? 's' : ''})`)

    try {
      // Step 1: Get new requirements from MySQL
      const newRequirements = await this.getNewRequirementsFromMySQL(hoursBack)
      result.requirementsChecked = newRequirements.length
      
      if (newRequirements.length === 0) {
        result.success = true
        result.summary = `✅ No new requirements found in last ${hoursBack} hour(s)`
        logger.info(result.summary)
        return result
      }

      logger.info(`🔍 Found ${newRequirements.length} new requirements in last ${hoursBack} hour(s)`)

      // Step 2: Filter requirements and check user signatures
      const eligibleRequirements = await this.filterEligibleRequirements(newRequirements, result)
      
      if (eligibleRequirements.length === 0) {
        result.success = true
        result.summary = `✅ No eligible requirements found (${result.excludedTypes} excluded types, ${result.skippedUnsigned} unsigned users)`
        logger.info(result.summary)
        return result
      }

      logger.info(`📋 Found ${eligibleRequirements.length} eligible requirements (excluded ${result.excludedTypes} types, ${result.skippedUnsigned} unsigned users)`)

      // Step 3: Update user queue types
      if (!dryRun) {
        await this.updateUserQueueTypes(eligibleRequirements, result)
      }

      result.success = true
      result.summary = `✅ New Requirements Discovery: ${result.usersUpdated} users updated to outstanding_requests queue`
      
      logger.info(result.summary)

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      result.errors.push(errorMsg)
      result.summary = `❌ New requirements discovery failed: ${errorMsg}`
      logger.error(result.summary, error)
    } finally {
      result.duration = Date.now() - this.startTime
    }

    return result
  }

  /**
   * Get new requirements from MySQL in the specified time window
   */
  private async getNewRequirementsFromMySQL(hoursBack: number): Promise<NewRequirementData[]> {
    const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000))
    
    logger.info(`📅 Checking requirements created after: ${cutoffTime.toISOString()}`)

    const query = `
      SELECT 
        cr.id as requirement_id,
        cr.claim_id,
        cr.type,
        cr.status,
        cr.created_at,
        c.user_id
      FROM claim_requirements cr
      JOIN claims c ON cr.claim_id = c.id
      WHERE cr.created_at >= ?
        AND cr.status = 'pending'
        AND cr.type NOT IN (${this.EXCLUDED_TYPES.map(() => '?').join(', ')})
      ORDER BY cr.created_at DESC
    `

    try {
      const requirements = await replicaDb.$queryRawUnsafe(
        query, 
        cutoffTime, 
        ...this.EXCLUDED_TYPES
      ) as Array<{
        requirement_id: string
        claim_id: number
        type: string
        status: string
        created_at: Date
        user_id: bigint
      }>

      // 📊 DETAILED ANALYSIS: Log requirement types breakdown
      const typeBreakdown = requirements.reduce((acc, req) => {
        acc[req.type] = (acc[req.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const uniqueUsers = new Set(requirements.map(req => req.user_id)).size
      const totalRequirements = requirements.length

      logger.info(`📊 [REQUIREMENTS ANALYSIS] Found ${totalRequirements} requirements for ${uniqueUsers} unique users`)
      logger.info(`📋 [TYPE BREAKDOWN]:`)
      Object.entries(typeBreakdown)
        .sort(([,a], [,b]) => b - a) // Sort by count descending
        .forEach(([type, count]) => {
          logger.info(`   📄 ${type}: ${count} requirements`)
        })

      // Log excluded types for reference
      logger.info(`🚫 [EXCLUDED TYPES]: ${this.EXCLUDED_TYPES.join(', ')}`)
      
      // Show time range analysis
      const oldestReq = requirements[requirements.length - 1]
      const newestReq = requirements[0]
      if (oldestReq && newestReq) {
        logger.info(`⏰ [TIME RANGE]: ${newestReq.created_at.toISOString()} → ${oldestReq.created_at.toISOString()}`)
      }

      return requirements.map(req => ({
        requirementId: req.requirement_id,
        userId: req.user_id,
        claimId: req.claim_id,
        type: req.type,
        status: req.status,
        createdAt: req.created_at
      }))
    } catch (error) {
      logger.error(`❌ Failed to query replica database for requirements:`, error)
      // If replica fails, return empty array instead of crashing
      logger.warn(`⚠️ Replica database unavailable, skipping requirements discovery this cycle`)
      throw new Error(`Replica database connection failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Filter requirements and exclude unsigned users
   */
  private async filterEligibleRequirements(
    requirements: NewRequirementData[], 
    result: NewRequirementsDiscoveryResult
  ): Promise<NewRequirementData[]> {
    
    // Get unique user IDs
    const userIds = [...new Set(requirements.map(req => req.userId))]
    
    logger.info(`🔍 [FILTERING] Checking ${userIds.length} unique users from ${requirements.length} requirements`)
    
    try {
      // Check which users have signatures (signed users only)
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
      
      const signedUsers = users.filter(user => user.current_signature_file_id !== null)
      const unsignedUsers = users.filter(user => user.current_signature_file_id === null)
      
      logger.info(`👥 [USER ANALYSIS]:`)
      logger.info(`   ✍️  ${signedUsers.length} signed users (will be processed)`)
      logger.info(`   📝 ${unsignedUsers.length} unsigned users (will be skipped)`)
      logger.info(`   📊 Total users checked: ${users.length}`)
      
      const signedUserIds = new Set(signedUsers.map(user => user.id))
      
      // Filter requirements for signed users only
      const eligibleRequirements = requirements.filter(req => {
        if (!signedUserIds.has(req.userId)) {
          result.skippedUnsigned++
          return false
        }
        return true
      })
      
      // Show requirements per user breakdown
      const reqPerUser = eligibleRequirements.reduce((acc, req) => {
        const userId = req.userId.toString()
        acc[userId] = (acc[userId] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const userReqCounts = Object.values(reqPerUser)
      const avgReqsPerUser = userReqCounts.length > 0 ? (userReqCounts.reduce((a, b) => a + b, 0) / userReqCounts.length).toFixed(1) : '0'
      const maxReqsPerUser = userReqCounts.length > 0 ? Math.max(...userReqCounts) : 0
      
      logger.info(`📊 [REQUIREMENTS PER USER]:`)
      logger.info(`   📈 Average: ${avgReqsPerUser} requirements per user`)
      logger.info(`   📊 Maximum: ${maxReqsPerUser} requirements for one user`)
      logger.info(`   👥 Unique users with requirements: ${Object.keys(reqPerUser).length}`)
      
      result.newRequirementsFound = eligibleRequirements.length
      
      return eligibleRequirements
    } catch (error) {
      logger.error(`❌ Failed to check user signatures from replica:`, error)
      // If replica fails, return empty array to avoid processing without signature validation
      logger.warn(`⚠️ Cannot validate user signatures, skipping requirements processing this cycle`)
      return []
    }
  }

  /**
   * Update user queue types to 'requirements' and reset scores
   */
  private async updateUserQueueTypes(
    requirements: NewRequirementData[], 
    result: NewRequirementsDiscoveryResult
  ): Promise<void> {
    
    // Get unique user IDs
    const userIds = [...new Set(requirements.map(req => req.userId))]
    
    let updated = 0
    
    for (let i = 0; i < userIds.length; i += this.BATCH_SIZE) {
      // Check execution time
      if (Date.now() - this.startTime > this.MAX_EXECUTION_TIME) {
        logger.warn(`⏰ Execution time limit reached, stopping at ${updated}/${userIds.length} users`)
        break
      }

      const batch = userIds.slice(i, i + this.BATCH_SIZE)
      
      // Update existing user_call_scores or create new ones
      for (const userId of batch) {
        try {
          const existingScore = await prisma.userCallScore.findUnique({
            where: { userId }
          })
          
          if (existingScore) {
            // Update existing user to outstanding_requests queue
            await prisma.userCallScore.update({
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
          } else {
            // Create new user score entry for outstanding_requests queue
            await prisma.userCallScore.create({
              data: {
                userId,
                // @ts-ignore - currentQueueType exists in schema
                currentQueueType: 'outstanding_requests',
                currentScore: 0,
                totalAttempts: 0,
                isActive: true,
                // @ts-ignore - lastQueueCheck exists in schema
                lastQueueCheck: new Date()
              }
            })
          }
          
          updated++
          
        } catch (error) {
          logger.error(`Failed to update user ${userId}:`, error)
          result.errors.push(`Failed to update user ${userId}`)
        }
      }
      
      logger.info(`✅ Batch ${Math.floor(i / this.BATCH_SIZE) + 1}: Updated ${batch.length} users to outstanding_requests queue (${updated}/${userIds.length} total)`)
    }
    
    result.usersUpdated = updated
  }
} 