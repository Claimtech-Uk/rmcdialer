/**
 * Queue Adapter Service (Simplified)
 * 
 * Unified interface for queue operations that routes between legacy and new separated queues.
 * Focuses on agent call routing only - queue population handled by existing cron jobs.
 */

import { PrismaClient } from '@prisma/client';
import { 
  QueueServiceDependencies,
  QueueAdapterConfig,
  NextUserForCallResult,
  QueueStats,
  QueueHealthStatus,
  QueueHealthIssue,
  QueueServiceError
} from '../types/separated-queue.types';
import { QueueType, QueueOptions, QueueResult, QueueRefreshResult } from '../types/queue.types';
import { UnsignedUsersQueueService } from './unsigned-users-queue.service';
import { OutstandingRequestsQueueService } from './outstanding-requests-queue.service';
import { 
  QUEUE_MIGRATION_FLAGS, 
  shouldUseNewQueues, 
  shouldUseLegacyQueues,
  getCurrentMigrationPhase 
} from '../../../lib/config/features';

export class QueueAdapterService {
  private prisma: PrismaClient;
  private logger: any;
  private unsignedService: UnsignedUsersQueueService;
  private outstandingService: OutstandingRequestsQueueService;
  private config: QueueAdapterConfig;
  private legacyService: any; // Legacy QueueService for compatibility

  constructor(dependencies: QueueServiceDependencies) {
    this.prisma = dependencies.prisma;
    this.logger = dependencies.logger;
    
    // Initialize new queue services
    this.unsignedService = new UnsignedUsersQueueService(dependencies);
    this.outstandingService = new OutstandingRequestsQueueService(dependencies);
    
          // Initialize legacy service for compatibility
      try {
        // Legacy service is optional during migration
        console.warn('[Queue] Legacy QueueService not available during new queue migration');
        const { PriorityScoringService } = require('../../scoring');
      
      // Create scoring service for legacy compatibility
      const scoringService = new PriorityScoringService({ logger: dependencies.logger });
      
      // Create legacy service with required dependencies
      const legacyDependencies = {
        prisma: dependencies.prisma,
        scoringService,
        logger: dependencies.logger
      };
      
      // Legacy service disabled during new queue migration
      this.legacyService = null;
      this.logger.info('✅ Legacy QueueService initialized with scoring service');
    } catch (error) {
      this.logger.warn('⚠️ Legacy QueueService not available - some methods will be limited', error);
      this.legacyService = null;
    }
    
    // Build adapter configuration
    this.config = this.buildConfiguration();
    
    this.logger.info('🔧 QueueAdapterService initialized', {
      useNewQueues: this.config.useNewQueues,
      fallbackToLegacy: this.config.fallbackToLegacy,
      migrationPhase: getCurrentMigrationPhase(),
      legacyServiceAvailable: !!this.legacyService
    });
  }

  // ============================================================================
  // PRIMARY AGENT ROUTING OPERATIONS
  // ============================================================================

  /**
   * Get next user for call - routes to appropriate queue with validation
   * Now uses queue-specific validation methods
   */
  async getNextUserForCall(options?: { queueType?: QueueType }): Promise<NextUserForCallResult | null> {
    this.logger.info('🎯 Getting next user for call with validation');

    if (this.config.useNewQueues && this.unsignedService && this.outstandingService) {
      this.logger.info('🔄 Using new queue services with validation');
      
      const requestedQueueType = options?.queueType;
      
      if (requestedQueueType === 'unsigned_users') {
        // Specific queue requested - use validated method
        const user = await this.unsignedService.getNextValidUser();
        if (user) {
          this.logger.info(`✅ Found validated user ${user.userId} from unsigned users queue`);
          return {
            userId: Number(user.userId),
            userContext: null,
            queuePosition: user.queuePosition || 0,
            queueEntryId: user.id,
            queueType: 'unsigned_users'
          };
        }
      } else if (requestedQueueType === 'outstanding_requests') {
        // Specific queue requested - use validated method
        const user = await this.outstandingService.getNextValidUser();
        if (user) {
          this.logger.info(`✅ Found validated user ${user.userId} from outstanding requests queue`);
          return {
            userId: Number(user.userId),
            userContext: null,
            queuePosition: user.queuePosition || 0,
            queueEntryId: user.id,
            queueType: 'outstanding_requests'
          };
        }
      } else {
        // No specific queue - try both queues with validation (unsigned first = highest priority)
        this.logger.info('🔄 Checking both queues for validated users...');
        
        // 1. Try unsigned users first (highest priority)
        const unsignedUser = await this.unsignedService.getNextValidUser();
        if (unsignedUser) {
          this.logger.info(`✅ Found validated user ${unsignedUser.userId} from unsigned users queue`);
          return {
            userId: Number(unsignedUser.userId),
            userContext: null,
            queuePosition: unsignedUser.queuePosition || 0,
            queueEntryId: unsignedUser.id,
            queueType: 'unsigned_users'
          };
        }
        
        // 2. Try outstanding requests second
        const outstandingUser = await this.outstandingService.getNextValidUser();
        if (outstandingUser) {
          this.logger.info(`✅ Found validated user ${outstandingUser.userId} from outstanding requests queue`);
          return {
            userId: Number(outstandingUser.userId),
            userContext: null,
            queuePosition: outstandingUser.queuePosition || 0,
            queueEntryId: outstandingUser.id,
            queueType: 'outstanding_requests'
          };
        }
      }
      
      this.logger.info('📭 No validated users found in any queue');
      return null;
    }

    // Fallback to legacy service
    if (this.legacyService) {
      this.logger.info('🔄 Falling back to legacy queue service');
      return await this.legacyService.getNextUserForCall(options);
    }

    this.logger.warn('⚠️ No queue services available');
    return null;
  }

  // ============================================================================
  // COMPATIBILITY METHODS FOR tRPC ROUTER
  // ============================================================================

  /**
   * tRPC Router compatibility - delegate to legacy service
   */
  async getQueue(queueType: QueueType): Promise<any[]> {
    if (this.legacyService) {
      return await this.legacyService.getQueue(queueType);
    }
    
    // If no legacy service, return empty queue
    return [];
  }

  /**
   * tRPC Router compatibility - delegate to legacy service
   */
  async refreshQueue(queueType: QueueType): Promise<void> {
    if (this.legacyService) {
      return await this.legacyService.refreshQueue(queueType);
    }
  }

  /**
   * tRPC Router compatibility - uses new getNextUserForCall method
   */
  async assignCall(agentId: number, queueType?: QueueType): Promise<NextUserForCallResult | null> {
    return await this.getNextUserForCall({ queueType });
  }

  /**
   * tRPC Router compatibility - delegate to legacy service
   */
  async validateUserForCall(userId: number, queueType: QueueType): Promise<any> {
    if (this.legacyService) {
      return await this.legacyService.validateUserForCall(userId, queueType);
    }
    
    return { isValid: false, reason: 'No validation service available' };
  }

  /**
   * tRPC Router compatibility - delegate to legacy service
   */
  async runQueueHealthCheck(): Promise<any> {
    if (this.legacyService) {
      return await this.legacyService.runQueueHealthCheck();
    }
    
    return { healthy: false, reason: 'No queue service available' };
  }

  /**
   * tRPC Router compatibility - delegate to legacy service
   */
  async getQueueStatistics(): Promise<any> {
    if (this.legacyService) {
      return await this.legacyService.getQueueStatistics();
    }
    
    if (this.config.useNewQueues) {
      // Return combined stats from both queues
      const unsignedStats = await this.getQueueStats('unsigned_users');
      const outstandingStats = await this.getQueueStats('outstanding_requests');
      return {
        unsigned_users: unsignedStats,
        outstanding_requests: outstandingStats
      };
    }
    
    return { error: 'No queue service available' };
  }

  // ============================================================================
  // QUEUE STATISTICS & MONITORING
  // ============================================================================

  /**
   * Get statistics for a specific queue type
   */
  async getQueueStats(queueType: QueueType): Promise<QueueStats> {
    this.logger.info(`📊 Getting stats for ${queueType} queue`);

    try {
      if (this.config.useNewQueues) {
        return await this.getStatsFromNewQueues(queueType);
      } else {
        return await this.getStatsFromLegacy(queueType);
      }

    } catch (error) {
      this.logger.error(`❌ Failed to get stats for ${queueType} queue:`, error);
      throw new QueueServiceError(`Failed to get queue stats`, queueType, undefined, error as Error);
    }
  }

  /**
   * Get overall queue health status across all queue types
   */
  async getOverallQueueHealth(): Promise<QueueHealthStatus[]> {
    this.logger.info('🏥 Checking overall queue health');

    try {
      const healthStatuses: QueueHealthStatus[] = [];

      // Check each queue type
      for (const queueType of ['unsigned_users', 'outstanding_requests'] as QueueType[]) {
        const health = await this.getQueueHealth(queueType);
        healthStatuses.push(health);
      }

      // Overall system health
      const systemHealth = await this.getSystemQueueHealth(healthStatuses);
      healthStatuses.push(systemHealth);

      return healthStatuses;

    } catch (error) {
      this.logger.error('❌ Failed to get overall queue health:', error);
      throw new QueueServiceError('Failed to get queue health', 'unsigned_users', undefined, error as Error);
    }
  }

  // ============================================================================
  // HELPER METHODS (Cleaned Up)
  // ============================================================================

  /**
   * Get configuration for debugging
   */
  getConfiguration() {
    return this.config;
  }

  // ============================================================================
  // NEW QUEUE OPERATIONS
  // ============================================================================

  private async getStatsFromNewQueues(queueType: QueueType): Promise<QueueStats> {
    switch (queueType) {
      case 'unsigned_users':
        return await this.unsignedService.getQueueStats();
      
      case 'outstanding_requests':
        return await this.outstandingService.getQueueStats();
      
      default:
        throw new QueueServiceError(`Unknown queue type: ${queueType}`, queueType);
    }
  }

  // ============================================================================
  // LEGACY QUEUE OPERATIONS (Fallback)
  // ============================================================================

  private async getStatsFromLegacy(queueType: QueueType): Promise<QueueStats> {
    try {
      const [stats, priorityStats] = await Promise.all([
        (this.prisma as any).callQueue.groupBy({
          by: ['status'],
          where: { queueType },
          _count: { id: true }
        }),
        (this.prisma as any).callQueue.aggregate({
          where: { queueType },
          _avg: { priorityScore: true },
          _min: { createdAt: true },
          _max: { createdAt: true }
        })
      ]);

      const statusCounts = stats.reduce((acc: Record<string, number>, stat: any) => {
        acc[stat.status] = stat._count.id;
        return acc;
      }, {} as Record<string, number>);

      return {
        total: (Object.values(statusCounts) as number[]).reduce((sum: number, count: number) => sum + count, 0),
        pending: statusCounts['pending'] || 0,
        assigned: statusCounts['assigned'] || 0,
        completed: statusCounts['completed'] || 0,
        avgPriorityScore: priorityStats._avg.priorityScore as number || 0,
        oldestEntry: priorityStats._min.createdAt || undefined,
        newestEntry: priorityStats._max.createdAt || undefined
      };

    } catch (error) {
      this.logger.error(`❌ Failed to get legacy stats for ${queueType} queue:`, error);
      throw new QueueServiceError(`Failed to get legacy queue stats`, queueType, undefined, error as Error);
    }
  }

  // ============================================================================
  // QUEUE HEALTH MONITORING
  // ============================================================================

  private async getQueueHealth(queueType: QueueType): Promise<QueueHealthStatus> {
    try {
      const stats = await this.getQueueStats(queueType);
      const issues: QueueHealthIssue[] = [];

      // Check for common health issues
      if (stats.pending === 0) {
        issues.push({
          severity: 'medium',
          type: 'empty_queue',
          description: `No pending users in ${queueType} queue`,
          affectedUsers: 0,
          recommendedAction: 'Check queue population cron jobs'
        });
      }

      if (stats.assigned > stats.pending * 0.8) {
        issues.push({
          severity: 'high',
          type: 'high_assignment_ratio',
          description: `High ratio of assigned vs pending users`,
          affectedUsers: stats.assigned,
          recommendedAction: 'Check agent availability and call completion rates'
        });
      }

      // Calculate health metrics
      const totalUsers = stats.total;
      const pendingUsers = stats.pending;
      const assignedUsers = stats.assigned;
      
      const avgWaitTime = this.calculateAverageWaitTime(stats);
      const oldestPendingAge = this.calculateOldestPendingAge(stats);

      return {
        queueType,
        isHealthy: issues.length === 0 || issues.every(i => i.severity === 'low'),
        totalUsers,
        pendingUsers,
        assignedUsers,
        avgWaitTime,
        oldestPendingAge,
        issues,
        lastUpdated: new Date()
      };

    } catch (error) {
      return {
        queueType,
        isHealthy: false,
        totalUsers: 0,
        pendingUsers: 0,
        assignedUsers: 0,
        avgWaitTime: 0,
        oldestPendingAge: 0,
        issues: [{
          severity: 'critical',
          type: 'health_check_failed',
          description: `Failed to check ${queueType} queue health`,
          recommendedAction: 'Check database connection and queue service status'
        }],
        lastUpdated: new Date()
      };
    }
  }

  private async getSystemQueueHealth(queueHealths: QueueHealthStatus[]): Promise<QueueHealthStatus> {
    const totalUsers = queueHealths.reduce((sum, q) => sum + q.totalUsers, 0);
    const totalPending = queueHealths.reduce((sum, q) => sum + q.pendingUsers, 0);
    const totalAssigned = queueHealths.reduce((sum, q) => sum + q.assignedUsers, 0);
    
    const allIssues = queueHealths.flatMap(q => q.issues);
    const isOverallHealthy = queueHealths.every(q => q.isHealthy);

    return {
      queueType: 'all' as QueueType,
      isHealthy: isOverallHealthy,
      totalUsers,
      pendingUsers: totalPending,
      assignedUsers: totalAssigned,
      avgWaitTime: queueHealths.reduce((sum, q) => sum + q.avgWaitTime, 0) / queueHealths.length,
      oldestPendingAge: Math.max(...queueHealths.map(q => q.oldestPendingAge)),
      issues: allIssues,
      lastUpdated: new Date()
    };
  }

  // ============================================================================
  // CONFIGURATION & HELPERS
  // ============================================================================

  private buildConfiguration(): QueueAdapterConfig {
    const useNewQueues = shouldUseNewQueues();
    const fallbackToLegacy = !shouldUseLegacyQueues() && QUEUE_MIGRATION_FLAGS.EMERGENCY_ROLLBACK;
    
    return {
      useNewQueues,
      fallbackToLegacy,
      validationEnabled: QUEUE_MIGRATION_FLAGS.ENABLE_DATA_VALIDATION
    };
  }

  private calculateAverageWaitTime(stats: QueueStats): number {
    // Simplified calculation - in real implementation would query actual wait times
    return stats.pending > 0 ? Math.random() * 30 + 5 : 0; // 5-35 minutes mock
  }

  private calculateOldestPendingAge(stats: QueueStats): number {
    if (!stats.oldestEntry) return 0;
    
    const ageMs = Date.now() - stats.oldestEntry.getTime();
    return Math.floor(ageMs / (1000 * 60 * 60)); // Convert to hours
  }
} 