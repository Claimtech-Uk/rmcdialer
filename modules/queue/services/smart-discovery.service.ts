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
  pendingRequirements: number;
}

/**
 * Smart Discovery Service - Targeted User Discovery
 * 
 * 🎯 SMART OPTIMIZATIONS:
 * - Only processes users created in specified time window
 * - Determines queue type based on signature and requirements
 * - Adds new users with score 0 (highest priority)
 * - Skips users that already exist in user_call_scores
 * - Processes each user only ONCE (not per queue type)
 */
export class SmartDiscoveryService {
  
  private readonly BATCH_SIZE = 100;
  private readonly MAX_EXECUTION_TIME = 25000; // 25 seconds (safe buffer)
  private startTime: number = 0;

  /**
   * Cron 1: Discover New Users (hourly)
   * Only check users created in last hour
   * Add all users (signed and unsigned)
   * Determine queue type and create user_call_scores entries
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
        include: {
          claims: {
            include: {
              requirements: {
                where: { status: 'PENDING' }
              }
            }
          }
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
      const userIds = recentUsers.map(user => Number(user.id));
      const existingScores = await prisma.userCallScore.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true }
      });
      
      const existingUserIds = new Set(existingScores.map(score => score.userId));
      const newUsers = recentUsers.filter(user => !existingUserIds.has(Number(user.id)));
      
      result.newUsersFound = newUsers.length;
      result.skippedExisting = recentUsers.length - newUsers.length;
      
      logger.info(`🆕 Found ${newUsers.length} NEW users (${result.skippedExisting} already exist)`);

      if (newUsers.length === 0) {
        logger.info('✅ All users in time window already processed');
        return result;
      }

      // Step 3: Process new users and determine queue types
      const usersToCreate: NewUserData[] = [];
      
      for (const user of newUsers) {
        try {
          const userData = this.analyzeUserForQueue(user);
          usersToCreate.push(userData);
          
          // Count by type
          if (userData.queueType === 'unsigned_users') {
            result.unsigned++;
          } else if (userData.queueType === 'outstanding_requests') {
            result.signed++;
          }
        } catch (error) {
          logger.error(`❌ Error analyzing user ${user.id}:`, error);
          result.errors++;
        }
      }

      // Step 4: Create user_call_scores entries in batches
      if (usersToCreate.length > 0) {
        await this.createUserScoresInBatches(usersToCreate);
        result.newUsersCreated = usersToCreate.length;
        logger.info(`✅ Created ${result.newUsersCreated} new user scores`);
      }

      return result;
      
    } catch (error) {
      logger.error('❌ New users discovery failed:', error);
      throw error;
    }
  }

  /**
   * Analyze a user to determine their queue type
   */
  private analyzeUserForQueue(user: any): NewUserData {
    const hasSignature = user.current_signature_file_id !== null;
    const pendingRequirements = user.claims?.reduce((total: number, claim: any) => 
      total + (claim.requirements?.length || 0), 0) || 0;

    let queueType: QueueType | null = null;
    
    // Business logic for queue assignment
    if (!hasSignature) {
      // No signature = unsigned users queue
      queueType = 'unsigned_users';
    } else if (hasSignature && pendingRequirements > 0) {
      // Has signature but has pending requirements = outstanding requests queue
      queueType = 'outstanding_requests';
    }
    // If has signature and no pending requirements = no queue needed

    return {
      id: user.id,
      queueType,
      hasSignature,
      pendingRequirements
    };
  }

  /**
   * Create user_call_scores entries in batches
   */
  private async createUserScoresInBatches(users: NewUserData[]): Promise<void> {
    const eligibleUsers = users.filter(user => user.queueType !== null);
    
    if (eligibleUsers.length === 0) {
      logger.info('ℹ️ No users need queue assignment');
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

      logger.info(`✅ Batch ${Math.floor(i / this.BATCH_SIZE) + 1}: Created ${batch.length} user scores`);
      
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