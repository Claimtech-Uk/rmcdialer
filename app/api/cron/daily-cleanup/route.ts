import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🧹 Starting daily cleanup...');
    
    const startTime = Date.now();
    let cleanupStats = {
      staleQueueEntriesRemoved: 0,
      convertedUsersProcessed: 0,
      inactiveScoresArchived: 0,
      oldCallSessionsCleaned: 0
    };

    // 1. Remove stale queue entries (older than 24 hours, status still pending)
    const staleEntries = await prisma.callQueue.deleteMany({
      where: {
        status: 'pending',
        createdAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
        },
        updatedAt: {
          lt: new Date(Date.now() - 6 * 60 * 60 * 1000) // No activity in 6 hours
        }
      }
    });
    cleanupStats.staleQueueEntriesRemoved = staleEntries.count;

    // 2. Handle users with scores >= 200 (should be converted)
    const highScoreUsers = await prisma.userCallScore.findMany({
      where: {
        currentScore: { gte: 200 },
        isActive: true
      },
      take: 100
    });

    for (const user of highScoreUsers) {
      try {
        await prisma.$transaction(async (tx) => {
          // Create conversion record
          await tx.conversion.create({
            data: {
              userId: user.userId,
              previousQueueType: user.currentQueueType || 'unknown',
              conversionType: 'scored_out',
              conversionReason: `Automatic conversion - score reached ${user.currentScore}`,
              finalScore: user.currentScore,
              totalCallAttempts: user.totalAttempts,
              lastCallAt: user.lastCallAt,
              convertedAt: new Date()
            }
          });

          // Mark user as inactive
          await tx.userCallScore.update({
            where: { userId: user.userId },
            data: {
              isActive: false,
              updatedAt: new Date()
            }
          });

          // Remove from queues
          await tx.callQueue.updateMany({
            where: {
              userId: user.userId,
              status: 'pending'
            },
            data: {
              status: 'converted',
              updatedAt: new Date()
            }
          });
        });

        cleanupStats.convertedUsersProcessed++;
      } catch (error) {
        console.error(`Failed to convert user ${user.userId}:`, error);
      }
    }

    // 3. Archive old inactive user scores (older than 30 days)
    const oldInactiveScores = await prisma.userCallScore.updateMany({
      where: {
        isActive: false,
        updatedAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        }
      },
      data: {
        // Mark as archived by setting a special flag in existing field
        timePenaltyScore: -1 // Use as archived flag
      }
    });
    cleanupStats.inactiveScoresArchived = oldInactiveScores.count;

    // 4. Clean up old completed call sessions (older than 7 days)
    const oldSessions = await prisma.callSession.deleteMany({
      where: {
        status: 'completed',
        endedAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
        }
      }
    });
    cleanupStats.oldCallSessionsCleaned = oldSessions.count;

    const duration = Date.now() - startTime;
    const summary = `Cleanup: ${cleanupStats.staleQueueEntriesRemoved} stale queues, ${cleanupStats.convertedUsersProcessed} conversions, ${cleanupStats.inactiveScoresArchived} archived in ${Math.round(duration/1000)}s`;

    console.log(`✅ Daily cleanup completed: ${summary}`);
    
    return NextResponse.json({
      success: true,
      cleanupStats,
      summary,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Daily cleanup failed:', error);
    
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
