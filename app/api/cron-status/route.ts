import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking cron system status...');
    
    const [
      pendingQueueUsers,
      userScores,
      lastHourQueueUpdates
    ] = await Promise.all([
      // Count users in queue
      prisma.callQueue.count({ where: { status: 'pending' } }),
      
      // Count user scores
      prisma.userCallScore.count(),
      
      // Check for recent queue activity (last hour)
      prisma.callQueue.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        }
      })
    ]);

    const healthStatus = {
      timestamp: new Date().toISOString(),
      queueUsers: pendingQueueUsers,
      userScores: userScores,
      scoringGap: pendingQueueUsers - userScores,
      lastHourActivity: lastHourQueueUpdates,
      status: pendingQueueUsers > 0 && userScores === 0 ? 'needs_scoring_fix' : 'healthy',
      nextCronJobs: {
        discovery: 'Every hour at :00',
        scoring: 'Every hour at :15', 
        cleanup: 'Daily at 2 AM UTC'
      }
    };

    console.log(`✅ Status check completed: ${healthStatus.status}`);
    
    return NextResponse.json(healthStatus);
    
  } catch (error: any) {
    console.error('❌ Status check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
    
  } finally {
    await prisma.$disconnect();
  }
}
