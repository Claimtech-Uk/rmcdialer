import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function logCronExecution(jobName: string, status: 'running' | 'success' | 'failed', duration: number, details: any, error?: string) {
  try {
    await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cron/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobName,
        status, 
        duration,
        details,
        error
      })
    });
  } catch (logError) {
    console.error('Failed to log cron execution:', logError);
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🔧 [CRON] Scoring Maintenance starting...');
    
    // Log start
    await logCronExecution('scoring-maintenance', 'running', 0, { 
      message: 'Scoring maintenance started',
      timestamp: new Date().toISOString()
    });
    
    let maintenanceStats = {
      missingScoresCreated: 0,
      scoresUpdated: 0,
      queuesSynced: 0
    };

    // Get all pending queue users and ensure they have scores
    const pendingQueueUsers = await prisma.callQueue.findMany({
      where: { status: 'pending' },
      select: { userId: true, queueType: true, createdAt: true },
      distinct: ['userId']
    });

    console.log(`📊 [CRON] Found ${pendingQueueUsers.length} unique pending queue users`);

    // Get existing user scores
    const existingScores = await prisma.userCallScore.findMany({
      select: { userId: true }
    });

    const existingUserIds = new Set(existingScores.map(score => score.userId.toString()));
    
    // Find users without scores
    const usersWithoutScores = pendingQueueUsers.filter(user => 
      !existingUserIds.has(user.userId.toString())
    );
    
    console.log(`🔧 [CRON] Creating scores for ${usersWithoutScores.length} users without scoring records`);

    // Create missing scores (starting at 0 for highest priority)
    for (const user of usersWithoutScores) {
      try {
        await prisma.userCallScore.create({
          data: {
            userId: user.userId,
            currentScore: 0, // Start at 0 (highest priority)
            totalAttempts: 0,
            successfulCalls: 0,
            currentQueueType: user.queueType,
            isActive: true,
            lastQueueCheck: new Date()
          }
        });
        maintenanceStats.missingScoresCreated++;
      } catch (createError) {
        console.warn(`⚠️ [CRON] Failed to create score for user ${user.userId}:`, createError);
      }
    }

    // Sync queue types for existing scores
    for (const queueUser of pendingQueueUsers) {
      try {
        const updated = await prisma.userCallScore.updateMany({
          where: { 
            userId: queueUser.userId,
            currentQueueType: { not: queueUser.queueType }
          },
          data: {
            currentQueueType: queueUser.queueType,
            lastQueueCheck: new Date()
          }
        });
        if (updated.count > 0) {
          maintenanceStats.scoresUpdated++;
        }
      } catch (updateError) {
        console.warn(`⚠️ [CRON] Failed to sync queue type for user ${queueUser.userId}:`, updateError);
      }
    }

    maintenanceStats.queuesSynced = pendingQueueUsers.length;
    
    const duration = Date.now() - startTime;
    const summary = `Created ${maintenanceStats.missingScoresCreated} scores, updated ${maintenanceStats.scoresUpdated} queue types, synced ${maintenanceStats.queuesSynced} users`;
    
    console.log(`✅ [CRON] Scoring Maintenance completed: ${summary} (${duration}ms)`);
    
    // Log success
    await logCronExecution('scoring-maintenance', 'success', duration, {
      maintenanceStats,
      summary,
      pendingUsers: pendingQueueUsers.length,
      existingScores: existingScores.length
    });
    
    return NextResponse.json({
      success: true,
      maintenanceStats,
      summary,
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime()
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON] Scoring Maintenance failed:', error);
    
    // Log failure
    await logCronExecution('scoring-maintenance', 'failed', duration, {
      errorMessage: error.message,
      errorStack: error.stack
    }, error.message);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime()
    }, { status: 500 });
  }
}

// For manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}

function getNextRunTime() {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const targetMinutes = [5, 20, 35, 50];
  
  const nextMinute = targetMinutes.find(min => min > currentMinute) || (targetMinutes[0] + 60);
  const minutesUntil = nextMinute > 60 ? nextMinute - 60 : nextMinute - currentMinute;
  
  return `${minutesUntil} minutes`;
}
