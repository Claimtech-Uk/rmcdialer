/**
 * Queue Services Index (Simplified)
 * 
 * Centralized exports for all queue-related services.
 * Provides a service factory for organized instantiation based on migration phase.
 */

// ============================================================================
// NEW SIMPLIFIED QUEUE SERVICES
// ============================================================================

export { UnsignedUsersQueueService } from './unsigned-users-queue.service';
export { OutstandingRequestsQueueService } from './outstanding-requests-queue.service';
export { QueueAdapterService } from './queue-adapter.service';

// ============================================================================
// LEGACY QUEUE SERVICES (for backward compatibility)
// ============================================================================

// export { QueueService } from './queue.service'; // Removed - using QueueAdapterService instead
export { QueueGenerationService } from './queue-generation.service';
export { LeadScoringService } from './lead-scoring.service';
export { LeadDiscoveryOptimizedService } from './lead-discovery-optimized.service';
export { DailyAgingService } from './daily-aging.service';
export { PreCallValidationService } from './pre-call-validation.service'; // @deprecated - Remove in Phase 3

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export * from '../types/separated-queue.types';
export * from '../types/queue.types';

// Re-export specific types to resolve ambiguity
export type { QueueStats } from '../types/separated-queue.types';

// ============================================================================
// SERVICE DEPENDENCIES
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { 
  QueueServiceDependencies,
  QueueHealthStatus 
} from '../types/separated-queue.types';
import { UnsignedUsersQueueService } from './unsigned-users-queue.service';
import { OutstandingRequestsQueueService } from './outstanding-requests-queue.service';
import { QueueAdapterService } from './queue-adapter.service';
import { shouldUseNewQueues, getCurrentMigrationPhase } from '../../../lib/config/features';

// ============================================================================
// QUEUE SERVICE FACTORY (Simplified)
// ============================================================================

/**
 * Factory for creating queue services based on current migration phase
 */
export class QueueServiceFactory {
  private dependencies: QueueServiceDependencies;

  constructor(dependencies: QueueServiceDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Create the main queue adapter (primary interface)
   */
  createQueueAdapter(): QueueAdapterService {
    return new QueueAdapterService(this.dependencies);
  }

  /**
   * Create unsigned users queue service
   */
  createUnsignedUsersService(): UnsignedUsersQueueService {
    return new UnsignedUsersQueueService(this.dependencies);
  }

  /**
   * Create outstanding requests queue service  
   */
  createOutstandingRequestsService(): OutstandingRequestsQueueService {
    return new OutstandingRequestsQueueService(this.dependencies);
  }

  /**
   * Create legacy queue service (for migration/fallback)
   * Note: Type compatibility will be resolved in Phase 3
   */
  createLegacyQueueService(): any {
    try {
      // Legacy service is disabled during new queue migration
      this.dependencies.logger?.warn('⚠️ Legacy QueueService not available during new queue migration');
      return null;
    } catch (error) {
      this.dependencies.logger?.warn('⚠️ Legacy QueueService not available during simplified setup');
      return null;
    }
  }

  /**
   * Get current migration status and recommendations
   */
  getMigrationStatus(): {
    phase: string;
    useNewQueues: boolean;
    availableServices: string[];
    recommendations: string[];
  } {
    const phase = getCurrentMigrationPhase();
    const useNewQueues = shouldUseNewQueues();
    
    const availableServices = [
      'QueueAdapterService',
      'UnsignedUsersQueueService', 
      'OutstandingRequestsQueueService'
    ];

    if (!useNewQueues) {
      availableServices.push('LegacyQueueService');
    }

    const recommendations: string[] = [];
    
    if (phase === 'pre-migration') {
      recommendations.push('Ready to enable new queue services');
      recommendations.push('Use QueueAdapterService for all queue operations');
    } else if (phase === 'new-only') {
      recommendations.push('Migration complete - using new separated queues');
      recommendations.push('Consider removing legacy queue service dependencies');
    }

    return {
      phase,
      useNewQueues,
      availableServices,
      recommendations
    };
  }

  /**
   * Get health summary across all queue systems
   */
  async getSystemHealthSummary(): Promise<{
    overall: 'healthy' | 'degraded' | 'critical';
    queueHealths: QueueHealthStatus[];
    totalUsers: number;
    totalPending: number;
    issues: number;
  }> {
    try {
      const adapter = this.createQueueAdapter();
      const queueHealths = await adapter.getOverallQueueHealth();
      
      const totalUsers = queueHealths.reduce((sum, h) => sum + h.totalUsers, 0);
      const totalPending = queueHealths.reduce((sum, h) => sum + h.pendingUsers, 0);
      const totalIssues = queueHealths.reduce((sum, h) => sum + h.issues.length, 0);
      
      const criticalIssues = queueHealths.some(h => h.issues.some(i => i.severity === 'critical'));
      const highIssues = queueHealths.some(h => h.issues.some(i => i.severity === 'high'));
      
      let overall: 'healthy' | 'degraded' | 'critical';
      if (criticalIssues) {
        overall = 'critical';
      } else if (highIssues || totalIssues > 3) {
        overall = 'degraded'; 
      } else {
        overall = 'healthy';
      }

      return {
        overall,
        queueHealths,
        totalUsers,
        totalPending,
        issues: totalIssues
      };

    } catch (error) {
      return {
        overall: 'critical',
        queueHealths: [],
        totalUsers: 0,
        totalPending: 0,
        issues: 1
      };
    }
  }
}

// ============================================================================
// CONVENIENCE FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a queue service factory with standard dependencies
 */
export function createQueueServiceFactory(prisma: PrismaClient, logger: any): QueueServiceFactory {
  const dependencies: QueueServiceDependencies = {
    prisma,
    logger
  };
  
  return new QueueServiceFactory(dependencies);
}

/**
 * Create a queue adapter directly (most common use case)
 */
export function createQueueAdapter(prisma: PrismaClient, logger: any): QueueAdapterService {
  const factory = createQueueServiceFactory(prisma, logger);
  return factory.createQueueAdapter();
}

/**
 * Get quick system status for monitoring dashboards
 */
export async function getQuickSystemStatus(prisma: PrismaClient, logger: any): Promise<{
  status: 'operational' | 'degraded' | 'down';
  phase: string;
  totalUsers: number;
  pendingUsers: number;
  lastCheck: Date;
}> {
  try {
    const factory = createQueueServiceFactory(prisma, logger);
    const health = await factory.getSystemHealthSummary();
    const migration = factory.getMigrationStatus();
    
    let status: 'operational' | 'degraded' | 'down';
    if (health.overall === 'critical') {
      status = 'down';
    } else if (health.overall === 'degraded') {
      status = 'degraded';
    } else {
      status = 'operational';
    }

    return {
      status,
      phase: migration.phase,
      totalUsers: health.totalUsers,
      pendingUsers: health.totalPending,
      lastCheck: new Date()
    };

  } catch (error) {
    logger?.error('❌ Failed to get quick system status:', error);
    return {
      status: 'down',
      phase: 'unknown',
      totalUsers: 0,
      pendingUsers: 0,
      lastCheck: new Date()
    };
  }
} 