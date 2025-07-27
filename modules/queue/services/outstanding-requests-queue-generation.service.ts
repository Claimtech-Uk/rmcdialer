/**
 * Outstanding Requests Queue Generation Service
 * 
 * Generates fresh outstanding_requests_queue from user_call_scores table hourly.
 * Reads users with currentQueueType = 'outstanding_requests' and populates the separated queue table.
 */

import { prisma } from '../../../lib/db';
import { logger } from '../../core/utils/logger.utils';

interface QueueGenerationResult {
  queueType: 'outstanding_requests';
  totalEligible: number;
  queuePopulated: number;
  removed: number;
  errors: number;
  duration: number;
}

export class OutstandingRequestsQueueGenerationService {
  
  private readonly QUEUE_SIZE_LIMIT = 100;
  
  /**
   * Generate fresh outstanding requests queue from user_call_scores
   * Called hourly to refresh the queue with latest scoring
   */
  async populateOutstandingRequestsQueue(): Promise<QueueGenerationResult> {
    const startTime = Date.now();
    logger.info('🎯 [OUTSTANDING] Generating fresh outstanding requests queue from user_call_scores...');
    
    const result: QueueGenerationResult = {
      queueType: 'outstanding_requests',
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
      
      logger.info(`📊 [OUTSTANDING] Found ${result.totalEligible} qualified users in user_call_scores`);
      
      // Step 3: Populate fresh queue if we have users
      if (eligibleUsers.length > 0) {
        result.queuePopulated = await this.bulkPopulateQueue(eligibleUsers);
      }
      
      result.duration = Date.now() - startTime;
      
      logger.info(`✅ [OUTSTANDING] Queue generation complete: ${result.queuePopulated} users queued (${result.removed} removed) in ${result.duration}ms`);
      
      return result;
      
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.errors++;
      logger.error('❌ [OUTSTANDING] Queue generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Clear existing outstanding requests queue entries
   */
  private async clearExistingQueue(): Promise<number> {
    try {
      const result = await (prisma as any).outstandingRequestsQueue.deleteMany({});
      logger.info(`🧹 [OUTSTANDING] Cleared ${result.count} existing queue entries`);
      return result.count;
    } catch (error) {
      logger.error('❌ [OUTSTANDING] Failed to clear existing queue:', error);
      return 0;
    }
  }
  
  /**
   * Get qualified users from user_call_scores table
   * Criteria: currentQueueType = 'outstanding_requests' AND isActive = true
   * Enhanced: 2-hour cooling period + newest-first for tied scores
   */
  private async getQualifiedUsersFromScores() {
    try {
      // Calculate 2-hour delay threshold
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      return await prisma.userCallScore.findMany({
        where: {
          currentQueueType: 'outstanding_requests',
          isActive: true,
          // Only include users ready to be called
          nextCallAfter: {
            lte: new Date()
          },
          // NEW: 2-hour cooling period for new user_call_scores
          createdAt: {
            lte: twoHoursAgo
          }
        },
        orderBy: [
          { currentScore: 'asc' },    // Lower score = higher priority (0 is best)
          { createdAt: 'desc' }       // NEW: Most recent first for tied scores (fresher leads prioritized)
        ],
        take: this.QUEUE_SIZE_LIMIT   // Limit queue size for performance
      });
    } catch (error) {
      logger.error('❌ [OUTSTANDING] Failed to get qualified users from user_call_scores:', error);
      throw error;
    }
  }
  
  /**
   * Bulk populate outstanding_requests_queue table
   */
  private async bulkPopulateQueue(users: any[]): Promise<number> {
    let populated = 0;
    
    logger.info(`📝 [OUTSTANDING] Populating queue with ${users.length} users...`);
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      try {
        await (prisma as any).outstandingRequestsQueue.create({
          data: {
            userId: user.userId,
            claimId: null, // Will be populated if needed
            priorityScore: user.currentScore,
            queuePosition: i + 1, // Position based on score ranking
            status: 'pending',
            queueReason: this.getQueueReason(user.currentScore),
            // Outstanding requests specific fields
            requirementTypes: ['document'], // Default requirement type
            totalRequirements: 1,
            pendingRequirements: 1,
            completedRequirements: 0,
            oldestRequirementDate: user.createdAt,
            availableFrom: user.nextCallAfter || new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        populated++;
        
        // Log every 25 users for progress tracking
        if (populated % 25 === 0) {
          logger.info(`📝 [OUTSTANDING] Populated ${populated}/${users.length} users...`);
        }
        
      } catch (error) {
        logger.error(`❌ [OUTSTANDING] Failed to add user ${user.userId} to queue:`, error);
        // Continue with next user instead of failing entire operation
      }
    }
    
    logger.info(`✅ [OUTSTANDING] Successfully populated ${populated} out of ${users.length} users`);
    return populated;
  }
  
  /**
   * Generate queue reason based on user score
   */
  private getQueueReason(score: number): string {
    if (score === 0) {
      return 'New lead - Pending document requirements';
    } else if (score <= 5) {
      return 'High priority - Outstanding requirements';
    } else if (score <= 10) {
      return 'Medium priority - Outstanding requirements';
    } else {
      return 'Aged lead - Outstanding requirements';
    }
  }
  
  /**
   * Get queue statistics for monitoring
   */
  async getQueueStats(): Promise<{ total: number; pending: number; oldestEntry?: Date }> {
    try {
      const [total, pending, oldestEntry] = await Promise.all([
        (prisma as any).outstandingRequestsQueue.count(),
        (prisma as any).outstandingRequestsQueue.count({ where: { status: 'pending' } }),
        (prisma as any).outstandingRequestsQueue.findFirst({
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
      logger.error('❌ [OUTSTANDING] Failed to get queue stats:', error);
      return { total: 0, pending: 0 };
    }
  }
} 