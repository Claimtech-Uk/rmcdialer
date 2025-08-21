import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Force dynamic rendering to prevent build-time database calls
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check user_call_scores
    const userScore = await prisma.userCallScore.findFirst({
      where: { userId: BigInt(16185) }
    });

    // Check if in unsigned_users_queue
    const queueEntry = await prisma.unsignedUsersQueue.findFirst({
      where: { userId: BigInt(16185) }
    });

    // Check recent queue population logs
    const recentLogs = await prisma.cronExecutionLog.findMany({
      where: { 
        jobName: 'populate-separated-queues',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    return NextResponse.json({
      userScore,
      queueEntry,
      recentQueuePopulation: recentLogs.map(log => ({
        status: log.status,
        createdAt: log.createdAt,
        details: log.details
      })),
      debug: {
        isEligible: userScore && 
          userScore.currentScore === 0 && 
          userScore.currentQueueType === 'unsigned_users' && 
          userScore.isActive,
        inQueue: !!queueEntry,
        shouldBeInQueue: userScore && 
          userScore.currentScore === 0 && 
          userScore.currentQueueType === 'unsigned_users' && 
          userScore.isActive && 
          !queueEntry
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Debug failed' }, { status: 500 });
  }
}
