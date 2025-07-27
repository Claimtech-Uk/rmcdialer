/**
 * Separated Queue Population Service
 * 
 * Manages hourly generation of both separated queue tables from user_call_scores.
 * Combines UnsignedUsersQueueGenerationService and OutstandingRequestsQueueGenerationService.
 */

import { logger } from '../../core/utils/logger.utils';
import { UnsignedUsersQueueGenerationService } from './unsigned-users-queue-generation.service';
import { OutstandingRequestsQueueGenerationService } from './outstanding-requests-queue-generation.service';

interface CombinedQueueGenerationResult {
  success: boolean;
  totalDuration: number;
  results: {
    unsigned_users?: {
      totalEligible: number;
      queuePopulated: number;
      removed: number;
      duration: number;
      errors: number;
    };
    outstanding_requests?: {
      totalEligible: number;
      queuePopulated: number;
      removed: number;
      duration: number;
      errors: number;
    };
  };
  summary: string;
  timestamp: string;
}

export class SeparatedQueuePopulationService {
  
  private unsignedGenerator: UnsignedUsersQueueGenerationService;
  private outstandingGenerator: OutstandingRequestsQueueGenerationService;
  
  constructor() {
    this.unsignedGenerator = new UnsignedUsersQueueGenerationService();
    this.outstandingGenerator = new OutstandingRequestsQueueGenerationService();
  }
  
  /**
   * Generate fresh queues for both queue types from user_call_scores
   * Called hourly by cron job
   */
  async populateAllQueues(): Promise<CombinedQueueGenerationResult> {
    const startTime = Date.now();
    
    logger.info('🚀 [QUEUE-POPULATION] Starting hourly queue generation for both separated queues...');
    
    const result: CombinedQueueGenerationResult = {
      success: false,
      totalDuration: 0,
      results: {},
      summary: '',
      timestamp: new Date().toISOString()
    };
    
    let totalErrors = 0;
    let totalPopulated = 0;
    let totalEligible = 0;
    
    try {
      // Generate unsigned users queue
      logger.info('📋 [QUEUE-POPULATION] Step 1: Generating unsigned users queue...');
      try {
        const unsignedResult = await this.unsignedGenerator.populateUnsignedUsersQueue();
        result.results.unsigned_users = unsignedResult;
        totalErrors += unsignedResult.errors;
        totalPopulated += unsignedResult.queuePopulated;
        totalEligible += unsignedResult.totalEligible;
        
        logger.info(`✅ [QUEUE-POPULATION] Unsigned users queue: ${unsignedResult.queuePopulated} users populated`);
      } catch (error) {
        logger.error('❌ [QUEUE-POPULATION] Failed to generate unsigned users queue:', error);
        totalErrors++;
        result.results.unsigned_users = {
          totalEligible: 0,
          queuePopulated: 0,
          removed: 0,
          duration: 0,
          errors: 1
        };
      }
      
      // Generate outstanding requests queue  
      logger.info('📋 [QUEUE-POPULATION] Step 2: Generating outstanding requests queue...');
      try {
        const outstandingResult = await this.outstandingGenerator.populateOutstandingRequestsQueue();
        result.results.outstanding_requests = outstandingResult;
        totalErrors += outstandingResult.errors;
        totalPopulated += outstandingResult.queuePopulated;
        totalEligible += outstandingResult.totalEligible;
        
        logger.info(`✅ [QUEUE-POPULATION] Outstanding requests queue: ${outstandingResult.queuePopulated} users populated`);
      } catch (error) {
        logger.error('❌ [QUEUE-POPULATION] Failed to generate outstanding requests queue:', error);
        totalErrors++;
        result.results.outstanding_requests = {
          totalEligible: 0,
          queuePopulated: 0,
          removed: 0,
          duration: 0,
          errors: 1
        };
      }
      
      // Calculate final result
      result.totalDuration = Date.now() - startTime;
      result.success = totalErrors === 0;
      result.summary = `${totalPopulated} users queued from ${totalEligible} eligible (${totalErrors} errors)`;
      
      if (result.success) {
        logger.info(`🎉 [QUEUE-POPULATION] Hourly queue generation completed successfully: ${result.summary} in ${result.totalDuration}ms`);
      } else {
        logger.warn(`⚠️ [QUEUE-POPULATION] Queue generation completed with errors: ${result.summary} in ${result.totalDuration}ms`);
      }
      
      return result;
      
    } catch (error) {
      result.totalDuration = Date.now() - startTime;
      result.success = false;
      result.summary = `Queue generation failed: ${error}`;
      
      logger.error('❌ [QUEUE-POPULATION] Fatal error during queue generation:', error);
      throw error;
    }
  }
  
  /**
   * Get combined queue statistics for monitoring
   */
  async getCombinedQueueStats(): Promise<{
    unsigned_users: { total: number; pending: number; oldestEntry?: Date };
    outstanding_requests: { total: number; pending: number; oldestEntry?: Date };
    combined: { totalUsers: number; totalPending: number; oldestOverall?: Date };
  }> {
    try {
      const [unsignedStats, outstandingStats] = await Promise.all([
        this.unsignedGenerator.getQueueStats(),
        this.outstandingGenerator.getQueueStats()
      ]);
      
      // Calculate combined stats
      const totalUsers = unsignedStats.total + outstandingStats.total;
      const totalPending = unsignedStats.pending + outstandingStats.pending;
      
      // Find oldest entry across both queues
      let oldestOverall: Date | undefined;
      if (unsignedStats.oldestEntry && outstandingStats.oldestEntry) {
        oldestOverall = unsignedStats.oldestEntry < outstandingStats.oldestEntry 
          ? unsignedStats.oldestEntry 
          : outstandingStats.oldestEntry;
      } else if (unsignedStats.oldestEntry) {
        oldestOverall = unsignedStats.oldestEntry;
      } else if (outstandingStats.oldestEntry) {
        oldestOverall = outstandingStats.oldestEntry;
      }
      
      return {
        unsigned_users: unsignedStats,
        outstanding_requests: outstandingStats,
        combined: {
          totalUsers,
          totalPending,
          oldestOverall
        }
      };
      
    } catch (error) {
      logger.error('❌ [QUEUE-POPULATION] Failed to get combined queue stats:', error);
      throw error;
    }
  }
  
  /**
   * Health check for queue population system
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    stats: any;
  }> {
    const issues: string[] = [];
    
    try {
      const stats = await this.getCombinedQueueStats();
      
      // Check for potential issues
      if (stats.combined.totalUsers === 0) {
        issues.push('No users in any queue - check user_call_scores population');
      }
      
      if (stats.combined.totalPending === 0) {
        issues.push('No pending users - all users may be assigned or unavailable');
      }
      
      // Check if queues are too old (over 2 hours)
      if (stats.combined.oldestOverall) {
        const ageHours = (Date.now() - stats.combined.oldestOverall.getTime()) / (1000 * 60 * 60);
        if (ageHours > 2) {
          issues.push(`Oldest queue entry is ${ageHours.toFixed(1)} hours old - may need refresh`);
        }
      }
      
      return {
        healthy: issues.length === 0,
        issues,
        stats
      };
      
    } catch (error) {
      logger.error('❌ [QUEUE-POPULATION] Health check failed:', error);
      return {
        healthy: false,
        issues: [`Health check failed: ${error}`],
        stats: null
      };
    }
  }
} 