import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import type { QueueType } from '@/modules/queue/types/queue.types';
import { logger } from '@/modules/core/utils/logger.utils';

interface SmartDiscoveryResult {
  usersChecked: number;
  newUsersFound: number;
  newUsersCreated: number;
  skippedExisting: number;
  unsigned: number;
  signed: number;
  errors: number;
}

interface NewUserData {
  id: bigint;
  queueType: QueueType | null;
  hasSignature: boolean;
}

/**
 * Smart Discovery Service - Targeted User Discovery
 * 
 * 🎯 DISCOVERY GOALS:
 * 1. Add new users from last hour
 * 2. Mark as unsigned_users queue (no signature) or no queue (has signature)
 * 
 * 🎯 SMART OPTIMIZATIONS:
 * - Only processes users created in specified time window
 * - Simple signature check: has signature = no queue, no signature = unsigned queue
 * - Adds new users with score 0 (highest priority)
 * - Skips users that already exist in user_call_scores
 * - Processes each user only ONCE
 */
export class SmartDiscoveryService {
  
  private readonly BATCH_SIZE = 100;
  private readonly MAX_EXECUTION_TIME = 25000; // 25 seconds (safe buffer)
  private startTime: number = 0;

  /**
   * Cron 1: Discover New Users (hourly)
   * Only check users created in last hour
   * Add all users based on signature status:
   * - No signature → unsigned_users queue
   * - Has signature → no queue (complete)
   */
  async discoverNewUsers(hoursBack: number = 1): Promise<SmartDiscoveryResult> {
    this.startTime = Date.now();
    logger.info(`🆕 Starting new users discovery (last ${hoursBack} hours)...`);
    
    const result: SmartDiscoveryResult = {
      usersChecked: 0,
      newUsersFound: 0,
      newUsersCreated: 0,
      skippedExisting: 0,
      unsigned: 0,
      signed: 0,
      errors: 0
    };

    try {
      // Step 1: Get users created in the last X hours from MySQL replica
      const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
      logger.info(`📅 Looking for users created after: ${cutoffTime.toISOString()}`);
      
      const recentUsers = await replicaDb.user.findMany({
        where: {
          is_enabled: true,
          phone_number: { not: null },
          first_name: { not: null },
          created_at: { gte: cutoffTime }
        },
        select: {
          id: true,
          current_signature_file_id: true,
          first_name: true,
          last_name: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' }
      });

      result.usersChecked = recentUsers.length;
      logger.info(`📊 Found ${recentUsers.length} users created in last ${hoursBack} hour(s)`);

      if (recentUsers.length === 0) {
        logger.info('✅ No new users found in time window');
        return result;
      }

      // Step 2: Check which users already exist in user_call_scores
      const userIds = recentUsers.map(user => user.id);
      const existingScores = await prisma.userCallScore.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true }
      });
      
      const existingUserIds = new Set(existingScores.map(score => score.userId));
      const newUsers = recentUsers.filter(user => !existingUserIds.has(user.id));
      
      result.newUsersFound = newUsers.length;
      result.skippedExisting = recentUsers.length - newUsers.length;
      
      logger.info(`🆕 Found ${newUsers.length} NEW users (${result.skippedExisting} already exist)`);

      if (newUsers.length === 0) {
        logger.info('✅ All users in time window already processed');
        return result;
      }

      // Step 3: Process new users and determine queue assignment
      const usersToCreate: NewUserData[] = [];
      
      for (const user of newUsers) {
        try {
          const userData = this.analyzeUserSignatureStatus(user);
          usersToCreate.push(userData);
          
          // Count by type
          if (userData.hasSignature) {
            result.signed++;
          } else {
            result.unsigned++;
          }
        } catch (error) {
          logger.error(`❌ Error analyzing user ${user.id}:`, error);
          result.errors++;
        }
      }

      // Step 4: Create user_call_scores entries for users that need queues
      if (usersToCreate.length > 0) {
        await this.createUserScoresInBatches(usersToCreate);
        result.newUsersCreated = usersToCreate.filter(u => u.queueType !== null).length;
        logger.info(`✅ Created ${result.newUsersCreated} new user scores (${result.signed} signed users skipped)`);
      }

      return result;
      
    } catch (error) {
      logger.error('❌ New users discovery failed:', error);
      throw error;
    }
  }

  /**
   * Analyze a user's signature status to determine queue assignment
   * Simple logic: has signature = no queue, no signature = unsigned queue
   */
  private analyzeUserSignatureStatus(user: any): NewUserData {
    const hasSignature = user.current_signature_file_id !== null;

    let queueType: QueueType | null = null;
    
    if (!hasSignature) {
      // No signature = needs to be called to get signed
      queueType = 'unsigned_users';
    }
    // Has signature = complete, no queue needed

    return {
      id: user.id,
      queueType,
      hasSignature
    };
  }

  /**
   * Create user_call_scores entries in batches (only for users that need queues)
   */
  private async createUserScoresInBatches(users: NewUserData[]): Promise<void> {
    const eligibleUsers = users.filter(user => user.queueType !== null);
    
    if (eligibleUsers.length === 0) {
      logger.info('ℹ️ No users need queue assignment (all signed)');
      return;
    }

    for (let i = 0; i < eligibleUsers.length; i += this.BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + this.BATCH_SIZE);
      
      const userScoresToCreate = batch.map(user => ({
        userId: user.id,
        currentScore: 0, // New users get highest priority
        totalAttempts: 0,
        lastCallAt: null,
        isActive: true,
        currentQueueType: user.queueType!
      }));

      await prisma.userCallScore.createMany({
        data: userScoresToCreate,
        skipDuplicates: true // Safety net
      });

      logger.info(`✅ Batch ${Math.floor(i / this.BATCH_SIZE) + 1}: Created ${batch.length} user scores (unsigned queue)`);
      
      // Check execution time
      if (Date.now() - this.startTime > this.MAX_EXECUTION_TIME) {
        logger.warn('⚠️ Approaching execution time limit, stopping batch processing');
        break;
      }
    }
  }

  /**
   * Cron 2: Discover New Requirements (hourly) 
   * TODO: Implement in next phase
   */
  async discoverNewRequirements(hoursBack: number = 1): Promise<SmartDiscoveryResult> {
    logger.info('🔄 New requirements discovery - TODO: Implement next');
    return {
      usersChecked: 0,
      newUsersFound: 0, 
      newUsersCreated: 0,
      skippedExisting: 0,
      unsigned: 0,
      signed: 0,
      errors: 0
    };
  }

  /**
   * Cron 3: Check Unsigned Conversions (hourly)
   * TODO: Implement in next phase  
   */
  async checkUnsignedConversions(hoursBack: number = 1): Promise<SmartDiscoveryResult> {
    logger.info('🔄 Unsigned conversions check - TODO: Implement next');
    return {
      usersChecked: 0,
      newUsersFound: 0,
      newUsersCreated: 0, 
      skippedExisting: 0,
      unsigned: 0,
      signed: 0,
      errors: 0
    };
  }

  /**
   * Cron 4: Check Requirements Conversions (hourly)
   * TODO: Implement in next phase
   */
  async checkRequirementsConversions(hoursBack: number = 1): Promise<SmartDiscoveryResult> {
    logger.info('🔄 Requirements conversions check - TODO: Implement next');
    return {
      usersChecked: 0,
      newUsersFound: 0,
      newUsersCreated: 0,
      skippedExisting: 0, 
      unsigned: 0,
      signed: 0,
      errors: 0
    };
  }
} 