import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { PreCallValidationService } from '@/modules/queue/services/pre-call-validation.service';

export async function GET() {
  try {
    const validationService = new PreCallValidationService();
    
    const [queueStats, replicaHealth, queueHealthChecks] = await Promise.all([
      // Get queue statistics
      Promise.all([
        prisma.callQueue.count({ where: { queueType: 'unsigned_users', status: 'pending' } }),
        prisma.callQueue.count({ where: { queueType: 'outstanding_requests', status: 'pending' } }),
        prisma.callQueue.count({ where: { status: 'invalid' } })
      ]),
      
      // Test MySQL replica connection
      replicaDb.user.count({ where: { is_enabled: true } }),
      
      // Run health checks on each queue (sample size)
      Promise.all([
        validationService.validateQueueHealth('unsigned_users', 10),
        validationService.validateQueueHealth('outstanding_requests', 10)
      ])
    ]);

    const [unsignedCount, outstandingCount, invalidCount] = queueStats;
    const [unsignedHealth, outstandingHealth] = queueHealthChecks;

    const totalInvalidFound = unsignedHealth.invalidUsers + outstandingHealth.invalidUsers;
    const totalValidFound = unsignedHealth.validUsers + outstandingHealth.validUsers;
    const healthPercentage = totalValidFound + totalInvalidFound > 0 
      ? Math.round((totalValidFound / (totalValidFound + totalInvalidFound)) * 100) 
      : 100;

    return NextResponse.json({
      status: healthPercentage >= 80 ? 'healthy' : 'degraded',
      healthPercentage,
      queues: {
        unsigned_users: {
          pending: unsignedCount,
          validationSample: {
            checked: unsignedHealth.totalChecked,
            valid: unsignedHealth.validUsers,
            invalid: unsignedHealth.invalidUsers
          }
        },
        outstanding_requests: {
          pending: outstandingCount,
          validationSample: {
            checked: outstandingHealth.totalChecked,
            valid: outstandingHealth.validUsers,
            invalid: outstandingHealth.invalidUsers
          }
        },
        total_invalid_entries: invalidCount
      },
      replica: {
        connection: 'healthy',
        enabled_users: replicaHealth
      },
      recommendations: generateHealthRecommendations(healthPercentage, totalInvalidFound),
      last_check: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      last_check: new Date().toISOString()
    }, { status: 500 });
  }
}

function generateHealthRecommendations(healthPercentage: number, invalidCount: number): string[] {
  const recommendations: string[] = [];
  
  if (healthPercentage < 80) {
    recommendations.push('Queue health below 80% - consider running discovery job');
  }
  
  if (invalidCount > 20) {
    recommendations.push('High number of invalid entries detected - run cleanup job');
  }
  
  if (healthPercentage >= 95 && invalidCount < 5) {
    recommendations.push('Queue health excellent - system operating optimally');
  }
  
  return recommendations;
} 