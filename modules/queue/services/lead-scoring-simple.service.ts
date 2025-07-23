import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import type { QueueType } from '@/modules/queue/types/queue.types';
import { logger } from '@/modules/core/utils/logger.utils';

interface LeadScoringReport {
  timestamp: Date;
  totalEligible: number;
  totalNewLeads: number;
  totalExistingLeads: number;
  summary: string;
  usersFound: number;
  totalProcessed: number;
  batchesProcessed: number;
  timeoutHit: boolean;
}

/**
 * TIMEOUT-FIXED Simple Lead Scoring Service
 * 
 * Handles timeout issues by processing in small batches
 */
export class LeadScoringSimpleService {
  
  private readonly BATCH_SIZE = 50;
  private readonly MAX_EXECUTION_TIME = 20000; // 20 seconds
  private startTime: number = 0;

  async runLeadScoring(): Promise<LeadScoringReport> {
    this.startTime = Date.now();
    logger.info('🎯 Starting TIMEOUT-FIXED lead scoring...');
    
    const report: LeadScoringReport = {
      timestamp: new Date(),
      totalEligible: 0,
      totalNewLeads: 0,
      totalExistingLeads: 0,
      summary: '',
      usersFound: 0,
      totalProcessed: 0,
      batchesProcessed: 0,
      timeoutHit: false
    };

    try {
      // Step 1: Daily aging (quick)
      await this.performDailyAging();
      
      // Step 2: Process users in batches
      let offset = 0;
      let batchNumber = 1;
      let hasMore = true;
      
      while (hasMore && !this.isTimeoutApproaching()) {
        const batchUsers = await this.getUsersBatch(offset, this.BATCH_SIZE);
        
        if (batchUsers.length === 0) {
          hasMore = false;
          break;
        }
        
        logger.info(`📦 Processing batch ${batchNumber}: ${batchUsers.length} users`);
        
        const batchResult = await this.processBatch(batchUsers);
        
        report.totalEligible += batchUsers.length;
        report.totalNewLeads += batchResult.newLeads;
        report.totalExistingLeads += batchResult.existingLeads;
        report.batchesProcessed += 1;
        
        offset += this.BATCH_SIZE;
        batchNumber++;
        
        // Safety delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (batchUsers.length < this.BATCH_SIZE) {
          hasMore = false;
        }
      }
      
      if (this.isTimeoutApproaching()) {
        report.timeoutHit = true;
        logger.warn('⏰ Timeout approaching, stopping early');
      }
      
      report.usersFound = report.totalEligible;
      report.totalProcessed = report.totalNewLeads + report.totalExistingLeads;
      report.summary = `Processed ${report.totalProcessed} users (${report.totalNewLeads} new, ${report.totalExistingLeads} existing) in ${report.batchesProcessed} batches`;
      
      const duration = Date.now() - this.startTime;
      logger.info(`✅ Lead scoring completed in ${duration}ms: ${report.summary}`);
      
    } catch (error) {
      logger.error('❌ Lead scoring failed:', error);
      throw error;
    }
    
    return report;
  }

  private isTimeoutApproaching(): boolean {
    return (Date.now() - this.startTime) > this.MAX_EXECUTION_TIME;
  }

  private async performDailyAging(): Promise<void> {
    try {
      logger.info('📅 Applying daily aging...');
      
      const aged = await prisma.userCallScore.updateMany({
        data: { 
          currentScore: { increment: 1 },
          updatedAt: new Date()
        }
      });
      
      logger.info(`📅 Daily aging complete: ${aged.count} users aged`);
    } catch (error) {
      logger.warn('⚠️ Daily aging skipped');
    }
  }

  private async getUsersBatch(offset: number, limit: number) {
    try {
      return await replicaDb.user.findMany({
        where: {
          is_enabled: true,
          phone_number: { not: null },
          first_name: { not: null }
        },
        select: {
          id: true,
          first_name: true,
          last_name: true
        },
        skip: offset,
        take: limit,
        orderBy: { id: 'asc' }
      });
    } catch (error) {
      logger.error('❌ Failed to get users batch:', error);
      return [];
    }
  }

  private async processBatch(users: any[]) {
    const result = { newLeads: 0, existingLeads: 0 };
    
    if (users.length === 0) return result;
    
    try {
      const userIds = users.map(u => u.id);
      const existingScores = await prisma.userCallScore.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true }
      });
      
      const existingSet = new Set(existingScores.map(s => s.userId));
      
      for (const user of users) {
        try {
          if (!existingSet.has(user.id)) {
            // NEW LEAD
            await prisma.userCallScore.create({
              data: {
                userId: user.id,
                currentScore: 0
              }
            });
            result.newLeads++;
          } else {
            // EXISTING LEAD
            result.existingLeads++;
          }
        } catch (userError) {
          logger.error(`❌ Failed to process user ${user.id}:`, userError);
        }
      }
      
    } catch (batchError) {
      logger.error('❌ Batch processing failed:', batchError);
    }
    
    return result;
  }
} 