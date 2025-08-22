import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking cron system health...');
    
    const startTime = Date.now();
    
    // Simple health checks without complex queries
    const [
      totalPendingQueues,
      totalUserScores,
      activeUserScores
    ] = await Promise.all([
      prisma.callQueue.count({ where: { status: 'pending' } }),
      prisma.userCallScore.count(),
      prisma.userCallScore.count({ where: { isActive: true } })
    ]);

    // Calculate basic health metrics
    const healthPercentage = totalPendingQueues > 0 && totalUserScores > 0 ? 100 : 0;
    const responseTime = Date.now() - startTime;
    
    // Determine status
    let status = 'healthy';
    let issues: string[] = [];
    
    if (totalPendingQueues > 0 && totalUserScores === 0) {
      status = 'degraded';
      issues.push('Queues exist but no user scores found');
    }
    
    if (totalPendingQueues === 0 && totalUserScores === 0) {
      status = 'empty';
      issues.push('No data in system');
    }
    
    const healthReport = {
      status,
      healthPercentage,
      responseTime,
      timestamp: new Date().toISOString(),
      
      queues: {
        total_pending: totalPendingQueues
      },
      
      scoring: {
        total_scores: totalUserScores,
        active_users: activeUserScores
      },
      
      integrity: {
        issues: issues.length > 0 ? issues : null
      },
      
      recommendations: issues.length > 0 ? [
        'Run scoring maintenance cron job to create missing user scores'
      ] : null
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
