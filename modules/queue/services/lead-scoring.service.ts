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
  batchesProcessed: number;
  timeoutHit: boolean;
}

/**
 * TIMEOUT-FIXED Lead Scoring Service
 * 
 * Core responsibility: Populate user_call_scores from MySQL replica
 * - BATCH PROCESSING: Handles large datasets within 30s timeout
 * - New leads get score = 0
 * - Existing leads keep their score
 */
export class LeadScoringService {
  
  private readonly BATCH_SIZE = 50; // Smaller batches for safety
  private readonly MAX_EXECUTION_TIME = 25000; // 25 seconds max
  private startTime: number = 0;

  /**
   * Main entry point - with timeout protection
   */
  async runLeadScoring(): Promise<LeadScoringReport> {
    this.startTime = Date.now();
    logger.info('🎯 Starting lead scoring and user_call_scores population...');
    
    const report: LeadScoringReport = {
      timestamp: new Date(),
      totalEligible: 0,
      totalNewLeads: 0,
      totalExistingLeads: 0,
      results: [],
      summary: '',
      usersFound: 0,
      totalProcessed: 0,
      batchesProcessed: 0,
      timeoutHit: false
    };

    try {
      // Step 1: Daily aging (quick operation)
      await this.performDailyAging();
      
      // Step 2: Score leads by queue type with batching
      const queueTypes: QueueType[] = ['unsigned_users', 'outstanding_requests'];
      
      for (const queueType of queueTypes) {
        if (this.isTimeoutApproaching()) {
          report.timeoutHit = true;
          logger.warn(`⏰ Timeout approaching, stopping at ${queueType}`);
          break;
        }
        
        const result = await this.scoreLeadsByTypeBatched(queueType);
        report.results.push(result);
        report.totalEligible += result.eligible;
        report.totalNewLeads += result.newLeads;
        report.totalExistingLeads += result.existingLeads;
        report.batchesProcessed += 1;
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

  /**
   * Check if we're approaching timeout
   */
  private isTimeoutApproaching(): boolean {
    return (Date.now() - this.startTime) > this.MAX_EXECUTION_TIME;
  }

  /**
   * Daily aging - simplified version
   */
  private async performDailyAging(): Promise<void> {
    const today = new Date();
    const isSunday = today.getDay() === 0;
    
    if (isSunday) {
      logger.info('📅 Skipping daily aging (Sunday)');
      return;
    }
    
    logger.info('📅 Applying daily aging to all active users...');
    
    try {
      const aged = await prisma.userCallScore.updateMany({
        data: { 
          currentScore: { increment: 1 },
          updatedAt: new Date()
        }
      });
      
      logger.info(`📅 Daily aging complete: ${aged.count} users aged`);
    } catch (error) {
      logger.warn('⚠️ Daily aging skipped due to schema issues');
    }
  }

  /**
   * Score leads for a specific queue type with batching  
   */
  private async scoreLeadsByTypeBatched(queueType: QueueType): Promise<LeadScoringResult> {
    logger.info(`📊 Scoring ${queueType} leads...`);
    
    const result: LeadScoringResult = {
      queueType,
      eligible: 0,
      newLeads: 0,
      existingLeads: 0,
      errors: 0
    };

    try {
      // Get eligible users in batches
      let offset = 0;
      let batchNumber = 1;
      let hasMore = true;
      
      while (hasMore && !this.isTimeoutApproaching()) {
        const batchUsers = await this.getEligibleUsersBatch(queueType, offset, this.BATCH_SIZE);
        
        if (batchUsers.length === 0) {
          hasMore = false;
          break;
        }
        
        logger.info(`📦 Processing batch ${batchNumber}: ${batchUsers.length} users (offset ${offset})`);
        
        const batchResult = await this.processBatchSafely(batchUsers, queueType);
        
        result.eligible += batchUsers.length;
        result.newLeads += batchResult.newLeads;
        result.existingLeads += batchResult.existingLeads;
        result.errors += batchResult.errors;
        
        offset += this.BATCH_SIZE;
        batchNumber++;
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Check if we got fewer users than batch size (end of data)
        if (batchUsers.length < this.BATCH_SIZE) {
          hasMore = false;
        }
      }
      
      logger.info(`📊 ${queueType} scoring complete: ${result.newLeads} new, ${result.existingLeads} existing, ${result.errors} errors`);
      
    } catch (error) {
      logger.error(`❌ Failed to score ${queueType} leads:`, error);
      result.errors++;
    }
    
    return result;
  }

  /**
   * Get a batch of eligible users with basic criteria
   */
  private async getEligibleUsersBatch(queueType: QueueType, offset: number, limit: number) {
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
          last_name: true,
          phone_number: true,
          email_address: true
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

  /**
   * Process a batch of users safely
   */
  private async processBatchSafely(users: any[], queueType: QueueType) {
    const result = { newLeads: 0, existingLeads: 0, errors: 0 };
    
    if (users.length === 0) return result;
    
    try {
      // Get existing scores for this batch
      const userIds = users.map(u => u.id);
      const existingScores = await prisma.userCallScore.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, currentScore: true }
      });
      
      const existingScoreMap = new Map(existingScores.map(s => [s.userId, s]));
      
      // Process each user
      for (const user of users) {
        try {
          const existingScore = existingScoreMap.get(user.id);
          
          if (!existingScore) {
            // NEW LEAD: Create with score = 0
            await prisma.userCallScore.create({
              data: {
                userId: user.id,
                currentScore: 0 // NEW LEADS START AT 0
              }
            });
            result.newLeads++;
            
          } else {
            // EXISTING LEAD: Keep current score, just count it
            result.existingLeads++;
          }
          
        } catch (userError) {
          logger.error(`❌ Failed to process user ${user.id}:`, userError);
          result.errors++;
        }
      }
      
    } catch (batchError) {
      logger.error('❌ Batch processing failed:', batchError);
      result.errors += users.length;
    }
    
    return result;
  }
} 