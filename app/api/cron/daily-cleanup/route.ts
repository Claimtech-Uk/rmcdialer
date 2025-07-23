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
    console.log('🧹 [CRON] Daily Cleanup starting...');
    
    // Log start
    await logCronExecution('daily-cleanup', 'running', 0, { 
      message: 'Daily cleanup started',
      timestamp: new Date().toISOString()
    });
    
    let cleanupStats = {
      staleQueueEntriesRemoved: 0,
      inactiveScoresArchived: 0,
      oldCallSessionsCleaned: 0,
      orphanedRecordsFixed: 0
    };

    // 1. Remove stale queue entries (older than 6 hours with no activity)
    const staleEntries = await prisma.callQueue.deleteMany({
      where: {
        status: 'pending',
        createdAt: {
          lt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
        },
        updatedAt: {
          lt: new Date(Date.now() - 2 * 60 * 60 * 1000) // No activity in 2 hours
        }
      }
    });
    cleanupStats.staleQueueEntriesRemoved = staleEntries.count;

    // 2. Archive inactive user scores (users not in any queue for 24+ hours)
    const inactiveScores = await prisma.userCallScore.updateMany({
      where: {
        isActive: true,
        lastQueueCheck: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
        }
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });
    cleanupStats.inactiveScoresArchived = inactiveScores.count;

    // 3. Clean up old call sessions (older than 7 days)
    const oldSessions = await prisma.callSession.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
        },
        status: { in: ['completed', 'failed', 'cancelled'] }
      }
    });
    cleanupStats.oldCallSessionsCleaned = oldSessions.count;

    // 4. Fix orphaned records (users with scores but no queue entries - reactivate if needed)
    const orphanedScores = await prisma.userCallScore.findMany({
      where: {
        isActive: false,
        userId: {
          in: (await prisma.callQueue.findMany({
            where: { status: 'pending' },
            select: { userId: true },
            distinct: ['userId']
          })).map(q => q.userId)
        }
      }
    });

    if (orphanedScores.length > 0) {
      const reactivated = await prisma.userCallScore.updateMany({
        where: {
          userId: { in: orphanedScores.map(s => s.userId) }
        },
        data: {
          isActive: true,
          lastQueueCheck: new Date()
        }
      });
      cleanupStats.orphanedRecordsFixed = reactivated.count;
    }
    
    const duration = Date.now() - startTime;
    const summary = `Removed ${cleanupStats.staleQueueEntriesRemoved} stale queues, archived ${cleanupStats.inactiveScoresArchived} scores, cleaned ${cleanupStats.oldCallSessionsCleaned} sessions, fixed ${cleanupStats.orphanedRecordsFixed} orphaned records`;
    
    console.log(`✅ [CRON] Daily Cleanup completed: ${summary} (${duration}ms)`);
    
    // Log success
    await logCronExecution('daily-cleanup', 'success', duration, {
      cleanupStats,
      summary,
      totalOperations: Object.values(cleanupStats).reduce((a, b) => a + b, 0)
    });
    
    return NextResponse.json({
      success: true,
      cleanupStats,
      summary,
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime()
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON] Daily Cleanup failed:', error);
    
    // Log failure
    await logCronExecution('daily-cleanup', 'failed', duration, {
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
  const targetMinutes = [10, 25, 40, 55];
  
  const nextMinute = targetMinutes.find(min => min > currentMinute) || (targetMinutes[0] + 60);
  const minutesUntil = nextMinute > 60 ? nextMinute - 60 : nextMinute - currentMinute;
  
  return `${minutesUntil} minutes`;
}
