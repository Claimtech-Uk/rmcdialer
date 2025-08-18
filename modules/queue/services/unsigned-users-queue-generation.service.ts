/**
 * Unsigned Users Queue Generation Service
 * 
 * Generates fresh unsigned_users_queue from user_call_scores table hourly.
 * Reads users with currentQueueType = 'unsigned_users' and populates the separated queue table.
 */

import { prisma } from '../../../lib/db';
import { logger } from '../../core/utils/logger.utils';

interface QueueGenerationResult {
  queueType: 'unsigned_users';
  totalEligible: number;
  queuePopulated: number;
  removed: number;
  errors: number;
  duration: number;
}

export class UnsignedUsersQueueGenerationService {
  
  // Configuration
  private readonly QUEUE_SIZE_LIMIT = 200; // Reduced to prevent Vercel timeouts
  
  /**
   * Generate fresh unsigned users queue from user_call_scores
   * Called hourly to refresh the queue with latest scoring
   */
  async populateUnsignedUsersQueue(): Promise<QueueGenerationResult> {
    const startTime = Date.now();
    logger.info('🎯 [UNSIGNED] Generating fresh unsigned users queue from user_call_scores...');
    
    const result: QueueGenerationResult = {
      queueType: 'unsigned_users',
      totalEligible: 0,
      queuePopulated: 0,
      removed: 0,
      errors: 0,
      duration: 0
    };
    
    try {
      // Step 1: Clear existing queue entries
      result.removed = await this.clearExistingQueue();
      
      // Step 2: Get qualified users from user_call_scores
      const eligibleUsers = await this.getQualifiedUsersFromScores();
      result.totalEligible = eligibleUsers.length;
      
      logger.info(`📊 [UNSIGNED] Found ${result.totalEligible} qualified users in user_call_scores`);
      
      // Step 3: Populate fresh queue if we have users
      if (eligibleUsers.length > 0) {
        result.queuePopulated = await this.bulkPopulateQueue(eligibleUsers);
      }
      
      result.duration = Date.now() - startTime;
      
      logger.info(`✅ [UNSIGNED] Queue generation complete: ${result.queuePopulated} users queued (${result.removed} removed) in ${result.duration}ms`);
      
      return result;
      
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.errors++;
      logger.error('❌ [UNSIGNED] Queue generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Clear existing unsigned users queue entries
   */
  private async clearExistingQueue(): Promise<number> {
    try {
      const result = await (prisma as any).unsignedUsersQueue.deleteMany({});
      logger.info(`🧹 [UNSIGNED] Cleared ${result.count} existing queue entries`);
      return result.count;
    } catch (error) {
      logger.error('❌ [UNSIGNED] Failed to clear existing queue:', error);
      return 0;
    }
  }
  
  /**
   * Get qualified users from user_call_scores table
   * Criteria: currentQueueType = 'unsigned_users' AND isActive = true
   * Enhanced: 2-hour cooling period + newest-first for tied scores
   */
  private async getQualifiedUsersFromScores() {
    try {
      // Calculate 2-hour delay threshold
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      // DEBUG: Check user 16185 specifically before main query
      const user16185 = await prisma.userCallScore.findFirst({
        where: { userId: BigInt(16185) },
        select: {
          userId: true,
          currentScore: true,
          currentQueueType: true,
          isActive: true,
          nextCallAfter: true,
          createdAt: true
        }
      });
      
      if (user16185) {
        const passesTimeFilter = user16185.createdAt <= twoHoursAgo;
        const passesCallAfterFilter = !user16185.nextCallAfter || user16185.nextCallAfter <= new Date();
        
        logger.info(`🕵️ [DEBUG] User 16185 status:`, {
          score: user16185.currentScore,
          queueType: user16185.currentQueueType,
          isActive: user16185.isActive,
          nextCallAfter: user16185.nextCallAfter,
          createdAt: user16185.createdAt,
          passesTimeFilter,
          passesCallAfterFilter,
          twoHoursAgo
        });
      } else {
        logger.info(`🕵️ [DEBUG] User 16185 not found in user_call_scores`);
      }
      
      // PRIORITY FIX: Get score 0 users first, then fill remaining slots with other users
      const score0Users = await prisma.userCallScore.findMany({
        where: {
          currentQueueType: 'unsigned_users',
          isActive: true,
          currentScore: 0,  // HIGHEST PRIORITY - always include these
          OR: [
            { nextCallAfter: null },
            { nextCallAfter: { lte: new Date() } }
          ]
          // NOTE: No 2-hour cooling for score 0 users - they get immediate priority
        },
        orderBy: [
          { createdAt: 'desc' }  // Most recent score 0 users first
        ]
      });

      // Get remaining users (non-zero scores) to fill remaining queue slots
      const remainingSlots = Math.max(0, this.QUEUE_SIZE_LIMIT - score0Users.length);
      const otherUsers = remainingSlots > 0 ? await prisma.userCallScore.findMany({
        where: {
          currentQueueType: 'unsigned_users',
          isActive: true,
          currentScore: { gt: 0 },  // Exclude score 0 (already got them above)
          OR: [
            { nextCallAfter: null },
            { nextCallAfter: { lte: new Date() } }
          ],
          // Apply 2-hour cooling period to non-priority users
          createdAt: {
            lte: twoHoursAgo
          }
        },
        orderBy: [
          { currentScore: 'asc' },    // Lower score = higher priority
          { createdAt: 'desc' }
        ],
        take: remainingSlots
      }) : [];

      // Combine with score 0 users first (highest priority)
      const results = [...score0Users, ...otherUsers];

      // DEBUG: Log the score distribution of retrieved users  
      const scoreCount = results.length;
      const scoreRange = scoreCount > 0 ? `${results[0].currentScore}-${results[results.length-1].currentScore}` : 'none';
      
      // ENHANCED DEBUG: Check priority user inclusion
      const hasUser16185 = results.some(u => u.userId === BigInt(16185));
      
      logger.info(`🔍 [UNSIGNED] Retrieved ${scoreCount} users (${score0Users.length} score 0 + ${otherUsers.length} others)`);
      logger.info(`📊 [UNSIGNED] Score range: ${scoreRange}`);  
      logger.info(`🎯 [UNSIGNED] Score 0 users guaranteed first priority: ${score0Users.length} users`);
      logger.info(`🕵️ [UNSIGNED] User 16185 included: ${hasUser16185}`);

      return results;
    } catch (error) {
      logger.error('❌ [UNSIGNED] Failed to get qualified users from user_call_scores:', error);
      throw error;
    }
  }
  
  /**
   * Bulk populate unsigned_users_queue table
   */
  private async bulkPopulateQueue(users: any[]): Promise<number> {
    let populated = 0;
    
    logger.info(`📝 [UNSIGNED] Populating queue with ${users.length} users...`);
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      try {
        await (prisma as any).unsignedUsersQueue.create({
          data: {
            userId: user.userId,
            claimId: null, // Will be populated if needed
            priorityScore: user.currentScore,
            queuePosition: i + 1, // Position based on score ranking
            status: 'pending',
            queueReason: this.getQueueReason(user.currentScore),
            signatureMissingSince: user.createdAt,
            signatureType: 'initial',
            availableFrom: user.nextCallAfter || new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        populated++;
        
        // Log every 25 users for progress tracking
        if (populated % 25 === 0) {
          logger.info(`📝 [UNSIGNED] Populated ${populated}/${users.length} users...`);
        }
        
      } catch (error) {
        logger.error(`❌ [UNSIGNED] Failed to add user ${user.userId} to queue:`, error);
        // Continue with next user instead of failing entire operation
      }
    }
    
    logger.info(`✅ [UNSIGNED] Successfully populated ${populated} out of ${users.length} users`);
    return populated;
  }
  
  /**
   * Generate queue reason based on user score
   */
  private getQueueReason(score: number): string {
    if (score === 0) {
      return 'New lead - Missing signature';
    } else if (score <= 5) {
      return 'High priority - Missing signature';
    } else if (score <= 10) {
      return 'Medium priority - Missing signature';
    } else {
      return 'Aged lead - Missing signature';
    }
  }
  
  /**
   * Get queue statistics for monitoring
   */
  async getQueueStats(): Promise<{ total: number; pending: number; oldestEntry?: Date }> {
    try {
      const [total, pending, oldestEntry] = await Promise.all([
        (prisma as any).unsignedUsersQueue.count(),
        (prisma as any).unsignedUsersQueue.count({ where: { status: 'pending' } }),
        (prisma as any).unsignedUsersQueue.findFirst({
          where: { status: 'pending' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true }
        })
      ]);
      
      return {
        total,
        pending,
        oldestEntry: oldestEntry?.createdAt
      };
      
    } catch (error) {
      logger.error('❌ [UNSIGNED] Failed to get queue stats:', error);
      return { total: 0, pending: 0 };
    }
  }
} 