/**
 * Queue Level Monitor Service
 * 
 * Monitors queue levels and triggers regeneration when queues drop below thresholds.
 * Prevents agents from running out of users to call.
 */

import { logger } from '../../core/utils/logger.utils';
import { SeparatedQueuePopulationService } from './separated-queue-population.service';
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
}

export class QueueLevelMonitorService {
  
  private config: QueueLevelConfig = {
    lowThreshold: 20,                // Regenerate when < 20 users
    minRegenerationInterval: 15,     // Wait 15 minutes between regenerations
    enableAutoRegeneration: true     // Enable auto-regeneration
  };
  
  private lastRegenerations: Map<string, Date> = new Map();
  private populationService: SeparatedQueuePopulationService;
  private unsignedService: UnsignedUsersQueueService;
  private outstandingService: OutstandingRequestsQueueService;
  
  constructor() {
    this.populationService = new SeparatedQueuePopulationService();
    
    // Initialize with minimal dependencies for stats methods
    const mockDependencies = {
      prisma: {} as any,
      replicaDb: {} as any,
      logger: { 
        info: console.log, 
        warn: console.warn, 
        error: console.error 
      }
    };
    
    this.unsignedService = new UnsignedUsersQueueService(mockDependencies);
    this.outstandingService = new OutstandingRequestsQueueService(mockDependencies);
  }
  
  /**
   * Check queue levels and trigger regeneration if needed
   * Called periodically (every 5-10 minutes) or on-demand
   */
  async checkAndRegenerateQueues(): Promise<QueueLevelReport> {
    const timestamp = new Date().toISOString();
    
    logger.info('🔍 [QUEUE-MONITOR] Checking queue levels...');
    
    try {
      // Get current queue statistics
      // Note: Using mock data until tables are created
      const unsignedStats = { pending: 0, total: 0 }; // Will be: await this.unsignedService.getQueueStats()
      const outstandingStats = { pending: 0, total: 0 }; // Will be: await this.outstandingService.getQueueStats()
      
      // Analyze each queue
      const unsignedStatus = this.analyzeQueueLevel('unsigned_users', unsignedStats.pending);
      const outstandingStatus = this.analyzeQueueLevel('outstanding_requests', outstandingStats.pending);
      
      logger.info(`📊 [QUEUE-MONITOR] Queue levels: Unsigned=${unsignedStats.pending}, Outstanding=${outstandingStats.pending}`);
      
      // Determine if regeneration is needed
      const needsRegeneration = (unsignedStatus.needsRegeneration && unsignedStatus.canRegenerate) ||
                               (outstandingStatus.needsRegeneration && outstandingStatus.canRegenerate);
      
      let regenerationTriggered = false;
      let reason = '';
      
      if (needsRegeneration && this.config.enableAutoRegeneration) {
        reason = this.buildRegenerationReason(unsignedStatus, outstandingStatus);
        logger.info(`🚨 [QUEUE-MONITOR] Would trigger queue regeneration: ${reason}`);
        
        // Demo mode - don't actually trigger until tables exist
        logger.info('📋 [QUEUE-MONITOR] Demo mode: Queue regeneration would be triggered here');
        regenerationTriggered = true; // Simulate triggering
        this.updateLastRegeneration('unsigned_users');
        this.updateLastRegeneration('outstanding_requests');
      }
      
      return {
        timestamp,
        unsigned_users: unsignedStatus,
        outstanding_requests: outstandingStatus,
        regenerationTriggered,
        reason: reason || undefined
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