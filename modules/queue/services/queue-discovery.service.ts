import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import type { QueueType } from '@/modules/queue/types/queue.types';
import { logger } from '@/modules/core/utils/logger.utils';

interface QueueDiscoveryResult {
  queueType: QueueType;
  discovered: number;
  newLeads: number;
  existingLeads: number;
  conversions: number;
  errors: number;
  duration: number;
}

interface QueueDiscoveryReport {
  timestamp: Date;
  totalDiscovered: number;
  totalNewLeads: number;
  totalExistingLeads: number;
  totalConversions: number;
  results: QueueDiscoveryResult[];
  summary: string;
  totalProcessed: number;
  usersFound: number;
}

/**
 * CORRECTED Queue Discovery Service
 * 
 * Implements proper lead lifecycle management:
 * - Populates user_call_scores (NOT call_queue)
 * - New leads start with score = 0
 * - Existing leads keep their score
 * - Queue type changes reset score = 0
 * - Missing leads = conversions
 * - Daily aging handled separately
 */
export class QueueDiscoveryService {
  
  /**
   * Run complete lead discovery and scoring for all queue types
   * This is the main method called by the cron job
   */
  async runHourlyDiscovery(): Promise<QueueDiscoveryReport> {
    const startTime = Date.now();
    logger.info('🔍 Starting enhanced hourly queue discovery...');
    
    const results: QueueDiscoveryResult[] = [];
    
    try {
      // 1. Apply daily aging to all active user scores
      await this.applyDailyAging();
      
      // 2. Discover and score leads by queue type
      const unsignedResult = await this.discoverAndScoreLeads('unsigned_users');
      results.push(unsignedResult);
      
      const outstandingResult = await this.discoverAndScoreLeads('outstanding_requests');
      results.push(outstandingResult);
      
      // 3. Detect and log conversions (users who disappeared from eligibility)
      await this.detectConversions();
      
      // 4. Cleanup invalid entries
      await this.cleanupInvalidEntries();
      
      const totalDuration = Date.now() - startTime;
      const totalDiscovered = results.reduce((sum, r) => sum + r.discovered, 0);
      const totalNewLeads = results.reduce((sum, r) => sum + r.newLeads, 0);
      const totalExistingLeads = results.reduce((sum, r) => sum + r.existingLeads, 0);
      const totalConversions = results.reduce((sum, r) => sum + r.conversions, 0);
      
      const report: QueueDiscoveryReport = {
        timestamp: new Date(),
        totalDiscovered,
        totalNewLeads,
        totalExistingLeads,
        totalConversions,
        results,
        summary: `Discovery complete: ${totalDiscovered} leads (${totalNewLeads} new, ${totalExistingLeads} existing, ${totalConversions} conversions) in ${Math.round(totalDuration / 1000)}s`,
        totalProcessed: totalDiscovered,
        usersFound: totalDiscovered
      };
      
      logger.info(`✅ Lead discovery completed: ${report.summary}`);
      return report;
      
    } catch (error) {
      logger.error('❌ Lead discovery failed:', error);
      throw error;
    }
  }
  
  /**
   * Discover and score leads for a specific queue type
   * This populates user_call_scores, NOT call_queue
   */
  async discoverAndScoreLeads(queueType: QueueType): Promise<QueueDiscoveryResult> {
    const startTime = Date.now();
    logger.info(`📋 Discovering ${queueType} leads...`);
    
    try {
      // 1. Get eligible users from MySQL replica
      const eligibleUsers = await this.getEligibleUsers(queueType);
      
      // 2. Get existing scores for these users
      const existingScores = await prisma.userCallScore.findMany({
        where: {
          userId: { in: eligibleUsers.map(u => u.id) }
        },
        select: {
          id: true,
          userId: true,
          currentScore: true,
          currentQueueType: true,
          isActive: true
        }
      });
      
      const existingScoreMap = new Map(
        existingScores.map(score => [score.userId.toString(), score])
      );
      
      let newLeads = 0;
      let existingLeads = 0;
      let errors = 0;
      
      // 3. Process each eligible user
      for (const user of eligibleUsers) {
        try {
          const existingScore = existingScoreMap.get(user.id.toString());
          
          if (!existingScore) {
            // NEW LEAD: Add with score = 0
            await this.createNewLead(user, queueType);
            newLeads++;
            logger.debug(`✅ New lead: ${user.first_name} ${user.last_name} (${user.id}) - score = 0`);
            
          } else if (existingScore.currentQueueType !== queueType) {
            // QUEUE TYPE CHANGE: Reset score = 0
            await this.resetLeadScore(existingScore, queueType);
            newLeads++; // Count as new for this queue
            logger.debug(`🔄 Queue change: ${user.first_name} ${user.last_name} (${user.id}) - ${existingScore.currentQueueType} → ${queueType}, score reset to 0`);
            
          } else {
            // EXISTING LEAD: Keep current score, update timestamp
            await this.updateExistingLead(existingScore);
            existingLeads++;
            logger.debug(`📋 Existing lead: ${user.first_name} ${user.last_name} (${user.id}) - keeping score ${existingScore.currentScore}`);
          }
          
        } catch (error) {
          errors++;
          logger.error(`❌ Failed to process user ${user.id}:`, error);
        }
      }
      
      const duration = Date.now() - startTime;
      
      const result: QueueDiscoveryResult = {
        queueType,
        discovered: eligibleUsers.length,
        newLeads,
        existingLeads,
        conversions: 0, // Handled separately
        errors,
        duration
      };
      
      logger.info(`📋 ${queueType} discovery: ${result.discovered} found, ${result.newLeads} new, ${result.existingLeads} existing, ${result.errors} errors`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Failed to discover ${queueType} leads:`, error);
      throw error;
    }
  }
  
  /**
   * Get eligible users from MySQL replica for a specific queue type
   */
  private async getEligibleUsers(queueType: QueueType) {
    switch (queueType) {
      case 'unsigned_users':
        return await replicaDb.user.findMany({
          where: {
            is_enabled: true,
            current_signature_file_id: null,
            claims: {
              some: {
                status: { not: 'complete' }
              }
            }
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
        
      case 'outstanding_requests':
        return await replicaDb.user.findMany({
          where: {
            is_enabled: true,
            current_signature_file_id: { not: null },
            claims: {
              some: {
                status: { not: 'complete' },
                requirements: {
                  some: { status: 'PENDING' }
                }
              }
            }
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
        
      default:
        throw new Error(`Unknown queue type: ${queueType}`);
    }
  }
  
  /**
   * Create new lead with score = 0
   */
  private async createNewLead(user: any, queueType: QueueType) {
    const queueReason = this.getQueueReason(queueType, user);
    
    await prisma.userCallScore.create({
      data: {
        userId: user.id,
        currentScore: 0, // NEW LEADS START AT 0
        currentQueueType: queueType,
        lastCallAt: null,
        nextCallAfter: new Date(),
        totalAttempts: 0,
        successfulCalls: 0
      }
    });
  }
  
  /**
   * Reset lead score to 0 when queue type changes
   */
  private async resetLeadScore(existingScore: any, newQueueType: QueueType) {
    await prisma.userCallScore.update({
      where: { id: existingScore.id },
      data: {
        currentScore: 0, // RESET TO 0 ON QUEUE TYPE CHANGE
        queueType: newQueueType,
        queueReason: await this.getQueueReasonForUser(existingScore.userId, newQueueType),
        updatedAt: new Date()
      }
    });
  }
  
  /**
   * Update existing lead timestamp (keep score)
   */
  private async updateExistingLead(existingScore: any) {
    await prisma.userCallScore.update({
      where: { id: existingScore.id },
      data: {
        updatedAt: new Date(),
        isActive: true
      }
    });
  }
  
  /**
   * Apply daily aging to all active leads (+1 point per day, skip Sundays)
   */
  private async applyDailyAging() {
    logger.info('📅 Applying daily aging to all active users...');
    
    const today = new Date();
    const isSunday = today.getDay() === 0;
    
    if (isSunday) {
      logger.info('📅 Skipping aging on Sunday');
      return;
    }
    
    const result = await prisma.userCallScore.updateMany({
      where: {
        isActive: true,
        currentScore: { lt: 200 } // Don't age users at max score
      },
      data: {
        currentScore: {
          increment: 1 // Daily aging: +1 point
        },
        updatedAt: new Date()
      }
    });
    
    logger.info(`📅 Daily aging complete: ${result.count} users aged`);
  }
  
  /**
   * Detect conversions (users who disappeared from eligibility)
   */
  private async detectConversions() {
    logger.info('🔄 Checking for lost users to reactivate...');
    
    // Get all active scores
    const activeScores = await prisma.userCallScore.findMany({
      where: { isActive: true }
    });
    
    // Check which users are still eligible
    const userIds = activeScores.map(score => score.userId);
    const stillEligibleIds = new Set();
    
    // Check unsigned_users eligibility
    const unsignedUsers = await this.getEligibleUsers('unsigned_users');
    unsignedUsers.forEach(user => stillEligibleIds.add(user.id.toString()));
    
    // Check outstanding_requests eligibility  
    const outstandingUsers = await this.getEligibleUsers('outstanding_requests');
    outstandingUsers.forEach(user => stillEligibleIds.add(user.id.toString()));
    
    // Find users who are no longer eligible = conversions
    let conversions = 0;
    for (const score of activeScores) {
      if (!stillEligibleIds.has(score.userId.toString())) {
        // LOG CONVERSION
        await this.logConversion(score);
        conversions++;
      }
    }
    
    logger.info(`🔄 Reactivation complete: ${conversions} users reactivated`);
  }
  
  /**
   * Log a conversion when user disappears from eligibility
   */
  private async logConversion(score: any) {
    try {
      await prisma.conversion.create({
        data: {
          userId: score.userId,
          queueType: score.queueType,
          finalScore: score.currentScore,
          convertedAt: new Date(),
          conversionReason: 'No longer eligible for queue'
        }
      });
      
      // Mark user_call_score as inactive
      await prisma.userCallScore.update({
        where: { id: score.id },
        data: { isActive: false }
      });
      
      logger.info(`🎯 Conversion logged: User ${score.userId} from ${score.queueType} (score: ${score.currentScore})`);
      
    } catch (error) {
      logger.error(`❌ Failed to log conversion for user ${score.userId}:`, error);
    }
  }
  
  /**
   * Get queue reason for a user and queue type
   */
  private getQueueReason(queueType: QueueType, user: any): string {
    switch (queueType) {
      case 'unsigned_users':
        return 'Missing signature to proceed with claim';
      case 'outstanding_requests':
        const pendingCount = user.claims?.reduce((acc: number, claim: any) => 
          acc + (claim.requirements?.length || 0), 0) || 0;
        return `${pendingCount} pending requirement(s)`;
      default:
        return 'Unknown queue reason';
    }
  }
  
  /**
   * Get queue reason for existing user
   */
  private async getQueueReasonForUser(userId: bigint, queueType: QueueType): Promise<string> {
    try {
      const user = await replicaDb.user.findUnique({
        where: { id: userId },
        include: {
          claims: {
            include: {
              requirements: {
                where: { status: 'PENDING' }
              }
            }
          }
        }
      });
      
      if (!user) return 'User not found';
      
      return this.getQueueReason(queueType, user);
      
    } catch (error) {
      logger.error(`Failed to get queue reason for user ${userId}:`, error);
      return 'Unknown reason';
    }
  }
  
  /**
   * Cleanup invalid entries
   */
  private async cleanupInvalidEntries() {
    logger.info('🧹 Cleaning up invalid queue entries...');
    
    // This method can be expanded to clean up any inconsistent data
    // For now, just log that cleanup is complete
    
    logger.info('🧹 Cleanup complete');
  }
} 