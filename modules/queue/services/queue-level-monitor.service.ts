/**
 * Queue Level Monitor Service
 * 
 * Monitors queue levels and triggers regeneration when queues drop below thresholds.
 * Prevents agents from running out of users to call.
 */

import { logger } from '../../core/utils/logger.utils';
import { prisma } from '../../../lib/db';
import { UnsignedUsersQueueGenerationService } from './unsigned-users-queue-generation.service';
import { OutstandingRequestsQueueGenerationService } from './outstanding-requests-queue-generation.service';
import { UnsignedUsersQueueService } from './unsigned-users-queue.service';
import { OutstandingRequestsQueueService } from './outstanding-requests-queue.service';

interface QueueLevelConfig {
  lowThreshold: number;           // Trigger regeneration when queue drops below this
  minRegenerationInterval: number; // Minimum minutes between regenerations
  enableAutoRegeneration: boolean; // Master switch
}

interface QueueLevelStatus {
  queueType: 'unsigned_users' | 'outstanding_requests';
  currentLevel: number;
  threshold: number;
  needsRegeneration: boolean;
  lastRegeneration?: Date;
  canRegenerate: boolean;
}

interface QueueLevelReport {
  timestamp: string;
  unsigned_users: QueueLevelStatus;
  outstanding_requests: QueueLevelStatus;
  regenerationTriggered: boolean;
  reason?: string;
  regenerationDetails?: {
    unsigned_users?: any;
    outstanding_requests?: any;
  };
}

export class QueueLevelMonitorService {
  
  private config: QueueLevelConfig = {
    lowThreshold: 20,                // Regenerate when < 20 users
    minRegenerationInterval: 15,     // Wait 15 minutes between regenerations
    enableAutoRegeneration: true     // Enable auto-regeneration
  };
  
  private lastRegenerations: Map<string, Date> = new Map();
  private unsignedGenerator: UnsignedUsersQueueGenerationService;
  private outstandingGenerator: OutstandingRequestsQueueGenerationService;
  private unsignedService: UnsignedUsersQueueService;
  private outstandingService: OutstandingRequestsQueueService;
  
  constructor() {
    // Initialize generation services
    this.unsignedGenerator = new UnsignedUsersQueueGenerationService();
    this.outstandingGenerator = new OutstandingRequestsQueueGenerationService();
    
    // Initialize queue services with proper dependencies
    const dependencies = {
      prisma: prisma,
      replicaDb: null, // Not needed for stats
      logger: { 
        info: console.log, 
        warn: console.warn, 
        error: console.error 
      }
    };
    
    this.unsignedService = new UnsignedUsersQueueService(dependencies);
    this.outstandingService = new OutstandingRequestsQueueService(dependencies);
  }
  
  /**
   * Check queue levels and trigger regeneration if needed
   * Called periodically (every 5-10 minutes) or on-demand
   */
  async checkAndRegenerateQueues(): Promise<QueueLevelReport> {
    const timestamp = new Date().toISOString();
    
    logger.info('🔍 [QUEUE-MONITOR] Checking queue levels...');
    
    try {
      // Get current queue statistics from actual services
      const [unsignedStats, outstandingStats] = await Promise.all([
        this.unsignedService.getQueueStats(),
        this.outstandingService.getQueueStats()
      ]);
      
      // Analyze each queue
      const unsignedStatus = this.analyzeQueueLevel('unsigned_users', unsignedStats.pending);
      const outstandingStatus = this.analyzeQueueLevel('outstanding_requests', outstandingStats.pending);
      
      logger.info(`📊 [QUEUE-MONITOR] Queue levels: Unsigned=${unsignedStats.pending}, Outstanding=${outstandingStats.pending}`);
      
      let regenerationTriggered = false;
      let reason = '';
      let regenerationDetails: any = {};
      
      if (this.config.enableAutoRegeneration) {
        // Check and regenerate unsigned users queue
        if (unsignedStatus.needsRegeneration && unsignedStatus.canRegenerate) {
          logger.info(`🚨 [QUEUE-MONITOR] Triggering unsigned users queue regeneration (${unsignedStats.pending} < ${this.config.lowThreshold})`);
          
          try {
            const result = await this.unsignedGenerator.populateUnsignedUsersQueue();
            regenerationDetails.unsigned_users = result;
            this.updateLastRegeneration('unsigned_users');
            regenerationTriggered = true;
            
            logger.info(`✅ [QUEUE-MONITOR] Unsigned users queue regenerated: ${result.queuePopulated} users`);
          } catch (error) {
            logger.error('❌ [QUEUE-MONITOR] Failed to regenerate unsigned users queue:', error);
            regenerationDetails.unsigned_users = { error: error instanceof Error ? error.message : String(error) };
          }
        }
        
        // Check and regenerate outstanding requests queue
        if (outstandingStatus.needsRegeneration && outstandingStatus.canRegenerate) {
          logger.info(`🚨 [QUEUE-MONITOR] Triggering outstanding requests queue regeneration (${outstandingStats.pending} < ${this.config.lowThreshold})`);
          
          try {
            const result = await this.outstandingGenerator.populateOutstandingRequestsQueue();
            regenerationDetails.outstanding_requests = result;
            this.updateLastRegeneration('outstanding_requests');
            regenerationTriggered = true;
            
            logger.info(`✅ [QUEUE-MONITOR] Outstanding requests queue regenerated: ${result.queuePopulated} users`);
          } catch (error) {
            logger.error('❌ [QUEUE-MONITOR] Failed to regenerate outstanding requests queue:', error);
            regenerationDetails.outstanding_requests = { error: error instanceof Error ? error.message : String(error) };
          }
        }
        
        // Build regeneration reason
        if (regenerationTriggered) {
          reason = this.buildRegenerationReason(unsignedStatus, outstandingStatus);
        }
      }
      
      if (regenerationTriggered) {
        logger.info(`🚨 [QUEUE-MONITOR] Queue regeneration completed: ${reason}`);
      } else {
        logger.info(`✅ [QUEUE-MONITOR] Queue levels adequate or regeneration not needed`);
      }
      
      return {
        timestamp,
        unsigned_users: unsignedStatus,
        outstanding_requests: outstandingStatus,
        regenerationTriggered,
        reason: reason || undefined,
        regenerationDetails: Object.keys(regenerationDetails).length > 0 ? regenerationDetails : undefined
      };
      
    } catch (error) {
      logger.error('❌ [QUEUE-MONITOR] Queue level check failed:', error);
      throw new Error(`Failed to check queue levels: ${error}`);
    }
  }
  
  /**
   * Analyze individual queue level and regeneration eligibility
   */
  private analyzeQueueLevel(queueType: 'unsigned_users' | 'outstanding_requests', currentLevel: number): QueueLevelStatus {
    const lastRegeneration = this.lastRegenerations.get(queueType);
    const needsRegeneration = currentLevel < this.config.lowThreshold;
    
    let canRegenerate = true;
    if (lastRegeneration) {
      const minInterval = this.config.minRegenerationInterval * 60 * 1000; // Convert to milliseconds
      const timeSinceLastRegen = Date.now() - lastRegeneration.getTime();
      canRegenerate = timeSinceLastRegen >= minInterval;
    }
    
    return {
      queueType,
      currentLevel,
      threshold: this.config.lowThreshold,
      needsRegeneration,
      lastRegeneration,
      canRegenerate
    };
  }
  
  /**
   * Build human-readable regeneration reason
   */
  private buildRegenerationReason(unsigned: QueueLevelStatus, outstanding: QueueLevelStatus): string {
    const reasons: string[] = [];
    
    if (unsigned.needsRegeneration && unsigned.canRegenerate) {
      reasons.push(`Unsigned queue low (${unsigned.currentLevel} < ${unsigned.threshold})`);
    }
    
    if (outstanding.needsRegeneration && outstanding.canRegenerate) {
      reasons.push(`Outstanding queue low (${outstanding.currentLevel} < ${outstanding.threshold})`);
    }
    
    return reasons.join(', ');
  }
  
  /**
   * Update last regeneration timestamp
   */
  private updateLastRegeneration(queueType: string): void {
    this.lastRegenerations.set(queueType, new Date());
  }
  
  /**
   * Get current configuration
   */
  getConfiguration(): QueueLevelConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<QueueLevelConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('🔧 [QUEUE-MONITOR] Configuration updated:', this.config);
  }
  
  /**
   * Health check for queue monitoring system
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    config: QueueLevelConfig;
    lastRegenerations: Record<string, string>;
  }> {
    return {
      healthy: this.config.enableAutoRegeneration,
      config: this.config,
      lastRegenerations: Object.fromEntries(
        Array.from(this.lastRegenerations.entries()).map(([key, date]) => [key, date.toISOString()])
      )
    };
  }
} 