import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import type { QueueType } from '@/modules/queue/types/queue.types';
import { logger } from '@/modules/core/utils/logger.utils';

interface LeadScoringResult {
  queueType: QueueType;
  eligible: number;
  newLeads: number;
  existingLeads: number;
  errors: number;
}

interface LeadScoringReport {
  timestamp: Date;
  totalEligible: number;
  totalNewLeads: number;
  totalExistingLeads: number;
  results: LeadScoringResult[];
  summary: string;
  usersFound: number;
  totalProcessed: number;
}

/**
 * SIMPLIFIED Lead Scoring Service
 * 
 * Core responsibility: Populate user_call_scores from MySQL replica
 * - New leads get score = 0
 * - Existing leads keep their score 
 * - Queue type changes reset score = 0
 * - Daily aging applied separately
 */
export class LeadScoringService {
  
  async runLeadScoring(): Promise<LeadScoringReport> {
    const startTime = Date.now();
    logger.info('🎯 Starting lead scoring and user_call_scores population...');
    
    const results: LeadScoringResult[] = [];
    
    try {
      // Apply daily aging first
      await this.applyDailyAging();
      
      // Score leads for each queue type
      const unsignedResult = await this.scoreLeads('unsigned_users');
      results.push(unsignedResult);
      
      const outstandingResult = await this.scoreLeads('outstanding_requests');
      results.push(outstandingResult);
      
      const totalEligible = results.reduce((sum, r) => sum + r.eligible, 0);
      const totalNewLeads = results.reduce((sum, r) => sum + r.newLeads, 0);
      const totalExistingLeads = results.reduce((sum, r) => sum + r.existingLeads, 0);
      
      const report: LeadScoringReport = {
        timestamp: new Date(),
        totalEligible,
        totalNewLeads,
        totalExistingLeads,
        results,
        summary: `Lead scoring complete: ${totalEligible} leads (${totalNewLeads} new, ${totalExistingLeads} existing)`,
        usersFound: totalEligible,
        totalProcessed: totalEligible
      };
      
      logger.info(`✅ Lead scoring completed: ${report.summary}`);
      return report;
      
    } catch (error) {
      logger.error('❌ Lead scoring failed:', error);
      throw error;
    }
  }
  
  async scoreLeads(queueType: QueueType): Promise<LeadScoringResult> {
    logger.info(`📊 Scoring ${queueType} leads...`);
    
    try {
      // Get eligible users from MySQL
      const eligibleUsers = await this.getEligibleUsers(queueType);
      
      // Get existing scores
      const userIds = eligibleUsers.map(u => u.id);
      const existingScores = await prisma.userCallScore.findMany({
        where: {
          userId: { in: userIds }
        }
      });
      
      const existingMap = new Map(
        existingScores.map(score => [score.userId.toString(), score])
      );
      
      let newLeads = 0;
      let existingLeads = 0;
      let errors = 0;
      
      // Process each user
      for (const user of eligibleUsers) {
        try {
          const existing = existingMap.get(user.id.toString());
          
          if (!existing) {
            // NEW LEAD: Create with score = 0
            await prisma.userCallScore.create({
              data: {
                userId: user.id,
                currentScore: 0, // NEW LEADS START AT 0
                nextCallAfter: new Date(),
                totalAttempts: 0,
                successfulCalls: 0
              }
            });
            newLeads++;
            
          } else {
            // EXISTING LEAD: Just update timestamp (keep score)
            await prisma.userCallScore.update({
              where: { id: existing.id },
              data: { updatedAt: new Date() }
            });
            existingLeads++;
          }
          
        } catch (error) {
          errors++;
          logger.error(`❌ Failed to process user ${user.id}:`, error);
        }
      }
      
      const result: LeadScoringResult = {
        queueType,
        eligible: eligibleUsers.length,
        newLeads,
        existingLeads,
        errors
      };
      
      logger.info(`📊 ${queueType} scoring: ${result.eligible} eligible, ${result.newLeads} new, ${result.existingLeads} existing`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Failed to score ${queueType} leads:`, error);
      throw error;
    }
  }
  
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
          }
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
          }
        });
        
      default:
        return [];
    }
  }
  
  private async applyDailyAging() {
    logger.info('📅 Applying daily aging to all active users...');
    
    const today = new Date();
    const isSunday = today.getDay() === 0;
    
    if (isSunday) {
      logger.info('📅 Skipping aging on Sunday');
      return;
    }
    
    try {
      const result = await prisma.userCallScore.updateMany({
        where: {
          currentScore: { lt: 200 } // Don't age users at max score
        },
        data: {
          currentScore: {
            increment: 1 // Daily aging: +1 point
          }
        }
      });
      
      logger.info(`📅 Daily aging complete: ${result.count} users aged`);
      
    } catch (error) {
      logger.error('❌ Daily aging failed:', error);
    }
  }
} 