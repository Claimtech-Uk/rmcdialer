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
      // Step 1: Get users created in the last X hours
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
      logger.info(`👥 Found ${result.usersChecked} users created in last ${hoursBack} hours`);

      if (recentUsers.length === 0) {
        logger.info('✅ No new users found');
        return result;
      }

      // Step 2: Check which users already exist in user_call_scores
      const userIds = recentUsers.map(u => u.id);
      const existingScores = await prisma.userCallScore.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true }
      });

      const existingUserIds = new Set(existingScores.map(s => s.userId));
      result.skippedExisting = existingScores.length;

      // Step 3: Filter to only truly new users
      const newUsers = recentUsers.filter(user => !existingUserIds.has(user.id));
      result.newUsersFound = newUsers.length;

      logger.info(`🆕 Found ${result.newUsersFound} new users (${result.skippedExisting} already exist, skipped)`);

      // Step 4: Process new users in batches
      if (newUsers.length > 0) {
        result.newUsersCreated = await this.processNewUsersInBatches(newUsers, result);
      }

      const duration = Date.now() - this.startTime;
      logger.info(`✅ New users discovery completed in ${duration}ms`);
      logger.info(`📊 Summary: ${result.newUsersCreated}/${result.newUsersFound} users processed (${result.unsigned} unsigned, ${result.signed} signed)`);

    } catch (error) {
      logger.error('❌ New users discovery failed:', error);
      result.errors++;
      throw error;
    }

    return result;
  }

  /**
   * Process new users in batches to avoid timeout
   */
  private async processNewUsersInBatches(newUsers: any[], result: SmartDiscoveryResult): Promise<number> {
    let created = 0;
    
    for (let i = 0; i < newUsers.length; i += this.BATCH_SIZE) {
      if (this.isTimeoutApproaching()) {
        logger.warn(`⏰ Timeout approaching, processed ${created}/${newUsers.length} new users`);
        break;
      }
      
      const batch = newUsers.slice(i, i + this.BATCH_SIZE);
      const batchCreated = await this.processBatchOfNewUsers(batch, result);
      created += batchCreated;
      
      logger.info(`✅ Batch ${Math.floor(i/this.BATCH_SIZE) + 1}: Created ${batchCreated}/${batch.length} scores (${created}/${newUsers.length} total)`);
    }
    
    return created;
  }

  /**
   * Process a batch of new users
   */
  private async processBatchOfNewUsers(batch: any[], result: SmartDiscoveryResult): Promise<number> {
    let created = 0;

    for (const user of batch) {
      try {
        const userData = this.analyzeNewUser(user);
        
        // Count by type for reporting
        if (userData.hasSignature) {
          result.signed++;
        } else {
          result.unsigned++;
        }

        // Only create user_call_scores if user needs to be in a queue
        if (userData.queueType) {
          await prisma.userCallScore.create({
            data: {
              userId: userData.id,
              currentScore: 0, // New users start with highest priority
              totalAttempts: 0,
              successfulCalls: 0,
              currentQueueType: userData.queueType,
              isActive: true,
              lastQueueCheck: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          created++;
          
          logger.debug(`✅ Created score for user ${userData.id} in ${userData.queueType} queue`);
        } else {
          logger.debug(`⏭️ User ${userData.id} doesn't need queue (signed with no pending requirements)`);
        }

      } catch (error) {
        logger.error(`❌ Failed to process user ${user.id}:`, error);
        result.errors++;
      }
    }

    return created;
  }

  /**
   * Analyze a new user to determine their queue type
   * Based on signature status and pending requirements
   */
  private analyzeNewUser(user: any): NewUserData {
    const hasSignature = user.current_signature_file_id !== null;
    const pendingRequirements = user.claims.reduce((acc: number, claim: any) => 
      acc + claim.requirements.length, 0
    );

    let queueType: QueueType | null = null;
    
    if (!hasSignature) {
      // No signature = unsigned users queue
      queueType = 'unsigned_users';
    } else if (pendingRequirements > 0) {
      // Has signature but pending requirements = outstanding requests queue
      queueType = 'outstanding_requests';
    } else {
      // Has signature and no pending requirements = no queue needed
      queueType = null;
    }

    return {
      id: user.id,
      queueType,
      hasSignature,
      pendingRequirements
    };
  }

  /**
   * Check if we're approaching timeout
   */
  private isTimeoutApproaching(): boolean {
    const elapsed = Date.now() - this.startTime;
    return elapsed > this.MAX_EXECUTION_TIME;
  }
} 