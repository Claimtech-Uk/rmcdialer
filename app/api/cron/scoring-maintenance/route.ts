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
      scoresUpdated: 0
    };

    // Simple approach: Get all pending queue users and ensure they have scores
    const pendingQueueUsers = await prisma.callQueue.findMany({
      where: { status: 'pending' },
      select: { userId: true, queueType: true, createdAt: true },
      distinct: ['userId']
    });

    console.log(`📊 Found ${pendingQueueUsers.length} unique pending queue users`);

    // Get existing user scores
    const existingScores = await prisma.userCallScore.findMany({
      select: { userId: true }
    });

    const existingUserIds = new Set(existingScores.map(score => score.userId.toString()));

    // Create missing scores
    for (const queueUser of pendingQueueUsers) {
      if (!existingUserIds.has(queueUser.userId.toString())) {
        try {
          await prisma.userCallScore.create({
            data: {
              userId: queueUser.userId,
              currentScore: 0,
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
    }

    const duration = Date.now() - startTime;
    const summary = `Maintenance: ${maintenanceStats.missingScoresCreated} scores created in ${Math.round(duration/1000)}s`;

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
export async function POST(request: NextRequest) {
  return GET(request);
}
