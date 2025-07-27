import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { UnsignedUsersQueueService, OutstandingRequestsQueueService } from '@/modules/queue';
import { logger } from '@/modules/core/utils/logger.utils';

export async function GET() {
  try {
    // Initialize queue services for health stats
    const servicesDeps = { prisma, logger };
    const unsignedQueueService = new UnsignedUsersQueueService(servicesDeps);
    const outstandingQueueService = new OutstandingRequestsQueueService(servicesDeps);
    
    const [queueStats, replicaHealth, newQueueStats] = await Promise.all([
      // Get legacy queue statistics
      Promise.all([
        prisma.callQueue.count({ where: { queueType: 'unsigned_users', status: 'pending' } }),
        prisma.callQueue.count({ where: { queueType: 'outstanding_requests', status: 'pending' } }),
        prisma.callQueue.count({ where: { status: 'invalid' } })
      ]),
      
      // Test MySQL replica connection
      replicaDb.user.count({ where: { is_enabled: true } }),
      
      // Get new queue service statistics
      Promise.all([
        unsignedQueueService.getQueueStats(),
        outstandingQueueService.getQueueStats()
      ])
    ]);

    const [unsignedCount, outstandingCount, invalidCount] = queueStats;
    const [unsignedStats, outstandingStats] = newQueueStats;

    // Calculate health based on queue availability
    const totalUsers = unsignedStats.total + outstandingStats.total;
    const healthPercentage = totalUsers > 0 ? 100 : 80; // Assume healthy if users available

    return NextResponse.json({
      status: healthPercentage >= 80 ? 'healthy' : 'degraded',
      healthPercentage,
      timestamp: new Date().toISOString(),
      
      // Legacy queue stats (for comparison during migration)
      legacy_queues: {
        unsigned_users: {
          pending: unsignedCount
        },
        outstanding_requests: {
          pending: outstandingCount
        },
        invalid: invalidCount
      },
      
      // New queue stats (with built-in validation)
      new_queues: {
        unsigned_users: {
          total: unsignedStats.total,
          pending: unsignedStats.pending,
          avgScore: unsignedStats.avgPriorityScore,
          oldestEntry: unsignedStats.oldestEntry
        },
        outstanding_requests: {
          total: outstandingStats.total,
          pending: outstandingStats.pending,
          avgScore: outstandingStats.avgPriorityScore,
          oldestEntry: outstandingStats.oldestEntry
        }
      },
      
      // System health
      replica_connection: {
        enabled_users: replicaHealth,
        status: replicaHealth > 0 ? 'connected' : 'disconnected'
      },
      
      // Migration status
      migration: {
        phase: 'queue-specific-validation',
        note: 'Using built-in queue validation instead of separate PreCallValidationService'
      }
    });

  } catch (error) {
    console.error('❌ Queue health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      healthPercentage: 0,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 