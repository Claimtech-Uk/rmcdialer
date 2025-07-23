import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔧 Starting scoring system maintenance...');
    
    const startTime = Date.now();
    let maintenanceStats = {
      missingScoresCreated: 0,
      orphanedQueuesFound: 0,
      scoresUpdated: 0,
      inactiveUsersChecked: 0
    };

    // 1. Find queue users without scoring records and create them
    const queueUsersWithoutScores = await prisma.callQueue.findMany({
      where: {
        status: 'pending',
        userCallScore: null
      },
      select: {
        userId: true,
        queueType: true,
        createdAt: true
      },
      distinct: ['userId'],
      take: 1000
    });

    console.log(`📊 Found ${queueUsersWithoutScores.length} queue users without scoring records`);

    for (const queueUser of queueUsersWithoutScores) {
      try {
        await prisma.userCallScore.create({
          data: {
            userId: queueUser.userId,
            currentScore: 0, // Fresh start
            isActive: true,
            currentQueueType: queueUser.queueType,
            lastResetDate: new Date(),
            lastQueueCheck: new Date(),
            totalAttempts: 0,
            successfulCalls: 0,
            baseScore: 0,
            outcomePenaltyScore: 0,
            timePenaltyScore: 0,
            createdAt: queueUser.createdAt
          }
        });
        maintenanceStats.missingScoresCreated++;
      } catch (error: any) {
        if (error.code !== 'P2002') { // Ignore unique constraint errors
          console.error(`Failed to create score for user ${queueUser.userId}:`, error.message);
        }
      }
    }

    // 2. Update queue priority scores to match user_call_scores
    const usersToUpdate = await prisma.userCallScore.findMany({
      where: {
        isActive: true,
        callQueue: {
          some: {
            status: 'pending'
          }
        }
      },
      select: {
        userId: true,
        currentScore: true
      }
    });

    for (const user of usersToUpdate) {
      await prisma.callQueue.updateMany({
        where: {
          userId: user.userId,
          status: 'pending'
        },
        data: {
          priorityScore: user.currentScore
        }
      });
      maintenanceStats.scoresUpdated++;
    }

    const duration = Date.now() - startTime;
    const summary = `Maintenance: ${maintenanceStats.missingScoresCreated} scores created, ${maintenanceStats.scoresUpdated} updated in ${Math.round(duration/1000)}s`;

    console.log(`✅ Scoring maintenance completed: ${summary}`);
    
    return NextResponse.json({
      success: true,
      maintenanceStats,
      summary,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Scoring maintenance failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// For manual testing
export async function POST() {
  return GET();
}
