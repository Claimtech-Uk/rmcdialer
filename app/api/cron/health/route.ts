import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('�� Checking cron system health...');
    
    const startTime = Date.now();
    
    // Get comprehensive system metrics
    const [
      queueStats,
      scoreStats,
      orphanedQueues,
      recentActivity,
      systemIntegrity
    ] = await Promise.all([
      // Queue statistics
      Promise.all([
        prisma.callQueue.count({ where: { status: 'pending', queueType: 'unsigned_users' } }),
        prisma.callQueue.count({ where: { status: 'pending', queueType: 'outstanding_requests' } }),
        prisma.callQueue.count({ where: { status: 'pending' } }),
        prisma.callQueue.count({ where: { status: 'completed' } }),
      ]),
      
      // Scoring statistics  
      Promise.all([
        prisma.userCallScore.count({ where: { isActive: true } }),
        prisma.userCallScore.count({ where: { isActive: false } }),
        prisma.userCallScore.count(),
      ]),
      
      // Orphaned queue entries (missing scoring records)
      prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM call_queue cq
        LEFT JOIN user_call_scores ucs ON cq.user_id = ucs.user_id
        WHERE cq.status = 'pending' AND ucs.user_id IS NULL
      ` as Array<{count: bigint}>,
      
      // Recent activity (last 24 hours)
      Promise.all([
        prisma.callQueue.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        prisma.userCallScore.count({
          where: {
            updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
      ]),
      
      // System integrity checks
      Promise.all([
        prisma.callQueue.count({
          where: {
            status: 'pending',
            userCallScore: { isActive: false }
          }
        }),
        prisma.callQueue.findFirst({
          where: { status: 'pending' },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true }
        })
      ])
    ]);
    
    const [unsignedPending, outstandingPending, totalPending, totalCompleted] = queueStats;
    const [activeScores, inactiveScores, totalScores] = scoreStats;
    const orphanCount = Number(orphanedQueues[0]?.count || 0);
    const [newQueues24h, updatedScores24h] = recentActivity;
    const [inactiveInQueues, lastQueueUpdate] = systemIntegrity;
    
    // Calculate health metrics
    const healthPercentage = totalPending > 0 ? Math.round(((totalPending - orphanCount) / totalPending) * 100) : 100;
    const timeSinceLastUpdate = lastQueueUpdate 
      ? Date.now() - lastQueueUpdate.updatedAt.getTime()
      : null;
    
    // Determine overall status
    let status = 'healthy';
    let issues: string[] = [];
    
    if (orphanCount > 0) {
      status = 'degraded';
      issues.push(`${orphanCount} orphaned queue entries`);
    }
    
    if (inactiveInQueues > 0) {
      status = 'degraded';  
      issues.push(`${inactiveInQueues} inactive users in queues`);
    }
    
    if (timeSinceLastUpdate && timeSinceLastUpdate > 2 * 60 * 60 * 1000) {
      status = 'unhealthy';
      issues.push('No queue updates in 2+ hours');
    }
    
    if (healthPercentage < 50) {
      status = 'unhealthy';
      issues.push(`System health at ${healthPercentage}%`);
    }
    
    const responseTime = Date.now() - startTime;
    
    const healthReport = {
      status,
      healthPercentage,
      responseTime,
      timestamp: new Date().toISOString(),
      
      queues: {
        unsigned_users: unsignedPending,
        outstanding_requests: outstandingPending,
        total_pending: totalPending,
        total_completed: totalCompleted,
        orphaned: orphanCount
      },
      
      scoring: {
        active_users: activeScores,
        inactive_users: inactiveScores,
        total_scores: totalScores,
        coverage: totalPending > 0 ? Math.round(((totalPending - orphanCount) / totalPending) * 100) : 100
      },
      
      activity: {
        new_queues_24h: newQueues24h,
        updated_scores_24h: updatedScores24h,
        last_queue_update: lastQueueUpdate?.updatedAt.toISOString() || null,
        hours_since_last_update: timeSinceLastUpdate ? Math.round(timeSinceLastUpdate / (1000 * 60 * 60)) : null
      },
      
      integrity: {
        inactive_in_queues: inactiveInQueues,
        orphaned_queues: orphanCount,
        issues: issues.length > 0 ? issues : null
      },
      
      recommendations: issues.length > 0 ? [
        orphanCount > 0 ? 'Run scoring maintenance cron job' : null,
        inactiveInQueues > 0 ? 'Remove inactive users from queues' : null,
        timeSinceLastUpdate && timeSinceLastUpdate > 2 * 60 * 60 * 1000 ? 'Check hourly discovery cron job' : null
      ].filter(Boolean) : null
    };
    
    console.log(`✅ Cron health check completed: ${status} (${responseTime}ms)`);
    
    return NextResponse.json(healthReport, {
      status: status === 'healthy' ? 200 : status === 'degraded' ? 206 : 503
    });
    
  } catch (error: any) {
    console.error('❌ Cron health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
    
  } finally {
    await prisma.$disconnect();
  }
}

// Allow POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}
