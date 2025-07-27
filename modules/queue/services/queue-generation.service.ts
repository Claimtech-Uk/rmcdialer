import { prisma } from '@/lib/db';
import type { QueueType } from '@/modules/queue/types/queue.types';
import { logger } from '@/modules/core/utils/logger.utils';

interface QueueGenerationResult {
  queueType: QueueType;
  totalEligible: number;
  queuePopulated: number;
  removed: number;
}

/**
 * Automatic Queue Generation Service
 * 
 * @deprecated This service will be removed in Phase 3 of queue migration.
 * New queues read directly from user_call_scores table.
 * Only use during legacy queue support period.
 * 
 * This service automatically populates call_queue from user_call_scores
 * - Pulls top scoring users (lowest scores = highest priority)
 * - Maintains ~100 users per queue type
 * - Auto-refreshes as needed
 * - No manual intervention required
 */
export class QueueGenerationService {
  
  private readonly QUEUE_SIZE_LIMIT = 100;
  
  /**
   * Generate fresh queues for all queue types
   */
  async generateAllQueues(): Promise<QueueGenerationResult[]> {
    logger.info('🎯 Generating fresh call queues from user_call_scores...');
    
    const results: QueueGenerationResult[] = [];
    
    try {
      // Generate queues for each type
      const unsignedResult = await this.generateQueue('unsigned_users');
      results.push(unsignedResult);
      
      const outstandingResult = await this.generateQueue('outstanding_requests');
      results.push(outstandingResult);
      
      logger.info(`🎯 Queue generation complete: ${results.length} queues refreshed`);
      return results;
      
    } catch (error) {
      logger.error('❌ Queue generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate queue for a specific queue type
   */
  async generateQueue(queueType: QueueType): Promise<QueueGenerationResult> {
    logger.info(`📋 Generating ${queueType} queue...`);
    
    try {
      // 1. Clear existing queue entries for this type
      const removed = await this.clearExistingQueue(queueType);
      
      // 2. Get top scoring users for this queue type
      const eligibleUsers = await this.getTopScoringUsers(queueType);
      
      // 3. Populate fresh queue
      const queuePopulated = await this.populateQueue(queueType, eligibleUsers);
      
      const result: QueueGenerationResult = {
        queueType,
        totalEligible: eligibleUsers.length,
        queuePopulated,
        removed
      };
      
      logger.info(`📋 ${queueType} queue: ${result.queuePopulated} users added (${result.removed} removed)`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Failed to generate ${queueType} queue:`, error);
      throw error;
    }
  }
  
  /**
   * Clear existing queue entries for a queue type
   */
  private async clearExistingQueue(queueType: QueueType): Promise<number> {
    const result = await prisma.callQueue.deleteMany({
      where: { queueType }
    });
    
    return result.count;
  }
  
  /**
   * Get top scoring users from user_call_scores for a queue type
   * Lower scores = higher priority (0 is best)
   */
  private async getTopScoringUsers(queueType: QueueType) {
    // For now, get all active users ordered by score
    // TODO: Add queue type filtering once schema is properly updated
    return await prisma.userCallScore.findMany({
      orderBy: [
        { currentScore: 'asc' }, // Lowest scores first (highest priority)
        { createdAt: 'asc' }     // Oldest first for tie-breaking
      ],
      take: this.QUEUE_SIZE_LIMIT
    });
  }
  
  /**
   * Populate call_queue with users from user_call_scores
   */
  private async populateQueue(queueType: QueueType, users: any[]): Promise<number> {
    let populated = 0;
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      try {
        await prisma.callQueue.create({
          data: {
            userId: user.userId,
            queueType,
            priorityScore: user.currentScore,
            queuePosition: i + 1, // Position based on score ranking
            status: 'pending',
            queueReason: this.getQueueReason(queueType, user.currentScore),
            availableFrom: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        populated++;
        
      } catch (error) {
        logger.error(`❌ Failed to add user ${user.userId} to ${queueType} queue:`, error);
      }
    }
    
    return populated;
  }
  
  /**
   * Get queue reason based on queue type and score
   */
  private getQueueReason(queueType: QueueType, score: number): string {
    const priorityLevel = this.getPriorityLevel(score);
    
    switch (queueType) {
      case 'unsigned_users':
        return `Missing signature - ${priorityLevel} priority (score: ${score})`;
      case 'outstanding_requests':
        return `Outstanding requirements - ${priorityLevel} priority (score: ${score})`;
      default:
        return `Unknown queue type - ${priorityLevel} priority (score: ${score})`;
    }
  }
  
  /**
   * Get priority level description based on score
   */
  private getPriorityLevel(score: number): string {
    if (score <= 10) return 'RED HOT';
    if (score <= 50) return 'WARM';
    if (score <= 100) return 'LUKEWARM';
    if (score <= 199) return 'COLD';
    return 'FROZEN';
  }
  
  /**
   * Auto-refresh queue when it gets low
   */
  async autoRefreshIfNeeded(queueType: QueueType, threshold: number = 20): Promise<boolean> {
    const currentCount = await prisma.callQueue.count({
      where: { 
        queueType,
        status: 'pending'
      }
    });
    
    if (currentCount <= threshold) {
      logger.info(`🔄 Auto-refreshing ${queueType} queue (${currentCount} <= ${threshold})`);
      await this.generateQueue(queueType);
      return true;
    }
    
    return false;
  }
  
  /**
   * Get queue status for monitoring
   */
  async getQueueStatus() {
    const unsignedCount = await prisma.callQueue.count({
      where: { queueType: 'unsigned_users', status: 'pending' }
    });
    
    const outstandingCount = await prisma.callQueue.count({
      where: { queueType: 'outstanding_requests', status: 'pending' }
    });
    
    const totalScores = await prisma.userCallScore.count();
    
    return {
      unsigned_users: unsignedCount,
      outstanding_requests: outstandingCount,
      total_user_call_scores: totalScores,
      last_updated: new Date()
    };
  }
} 