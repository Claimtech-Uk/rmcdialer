import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Weekly Score Aging Cron Job
 * 
 * Runs every night to find users created exactly 1 week ago and increase
 * their score by +5 to prevent stale leads from staying high priority forever.
 * 
 * Example: Tuesday night, get all users from last Wednesday and age them +5
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🕐 [WEEKLY-AGING] Starting weekly score aging process...');
    
    // Calculate exactly 1 week ago (7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Get the full day range for "exactly 1 week ago"
    const startOfTargetDay = new Date(oneWeekAgo);
    startOfTargetDay.setHours(0, 0, 0, 0);
    
    const endOfTargetDay = new Date(oneWeekAgo);
    endOfTargetDay.setHours(23, 59, 59, 999);
    
    console.log(`🔍 [WEEKLY-AGING] Targeting users created on ${startOfTargetDay.toDateString()}`);
    console.log(`📅 [WEEKLY-AGING] Date range: ${startOfTargetDay.toISOString()} to ${endOfTargetDay.toISOString()}`);
    
    // Find active users created exactly 1 week ago (not yet converted)
    const candidateUsers = await prisma.userCallScore.findMany({
      where: {
        createdAt: {
          gte: startOfTargetDay,
          lte: endOfTargetDay
        },
        isActive: true,
        currentScore: { lt: 200 }  // Don't age users who are already frozen/converted
      },
      select: {
        userId: true,
        currentScore: true,
        currentQueueType: true,
        createdAt: true
      }
    });
    
    console.log(`👥 [WEEKLY-AGING] Found ${candidateUsers.length} candidate users for aging`);
    
    if (candidateUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users found for weekly aging',
        usersAged: 0,
        targetDate: startOfTargetDay.toDateString(),
        duration: Date.now() - startTime
      });
    }
    
    // Apply the +5 weekly aging penalty
    const result = await prisma.$transaction(async (tx) => {
      // Update user_call_scores with +5 aging
      const scoreUpdate = await tx.userCallScore.updateMany({
        where: {
          userId: { in: candidateUsers.map(u => u.userId) },
          isActive: true,  // Double-check they're still active
          currentScore: { lt: 200 }  // Double-check they're not already converted
        },
        data: {
          currentScore: { increment: 5 },
          updatedAt: new Date()
        }
      });
      
      // Sync the queue tables to match new scores
      const callQueueSync = await tx.callQueue.updateMany({
        where: {
          userId: { in: candidateUsers.map(u => u.userId) },
          status: 'pending'
        },
        data: {
          priorityScore: { increment: 5 },
          updatedAt: new Date()
        }
      });
      
      // Sync unsigned users queue if exists
      const unsignedQueueSync = await tx.unsignedUsersQueue.updateMany({
        where: {
          userId: { in: candidateUsers.map(u => u.userId) },
          status: 'pending'
        },
        data: {
          priorityScore: { increment: 5 },
          updatedAt: new Date()
        }
      });
      
      // Sync outstanding requests queue if exists  
      const outstandingQueueSync = await tx.outstandingRequestsQueue.updateMany({
        where: {
          userId: { in: candidateUsers.map(u => u.userId) },
          status: 'pending'
        },
        data: {
          priorityScore: { increment: 5 },
          updatedAt: new Date()
        }
      });
      
      return {
        scoreUpdates: scoreUpdate.count,
        callQueueSync: callQueueSync.count,
        unsignedQueueSync: unsignedQueueSync.count,
        outstandingQueueSync: outstandingQueueSync.count
      };
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [WEEKLY-AGING] Successfully aged ${result.scoreUpdates} users (+5 each)`);
    console.log(`🔄 [WEEKLY-AGING] Synced queues: call_queue=${result.callQueueSync}, unsigned=${result.unsignedQueueSync}, outstanding=${result.outstandingQueueSync}`);
    console.log(`⏱️ [WEEKLY-AGING] Completed in ${duration}ms`);
    
    // Log detailed breakdown
    const scoreDistribution = candidateUsers.reduce((acc, user) => {
      const newScore = user.currentScore + 5;
      const bracket = newScore < 10 ? '0-9' : newScore < 20 ? '10-19' : newScore < 50 ? '20-49' : '50+';
      acc[bracket] = (acc[bracket] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`📊 [WEEKLY-AGING] New score distribution after aging:`, scoreDistribution);
    
    return NextResponse.json({
      success: true,
      usersAged: result.scoreUpdates,
      targetDate: startOfTargetDay.toDateString(),
      duration,
      queueSyncResults: {
        callQueue: result.callQueueSync,
        unsignedQueue: result.unsignedQueueSync,
        outstandingQueue: result.outstandingQueueSync
      },
      scoreDistribution,
      summary: `Applied +5 weekly aging to ${result.scoreUpdates} users from ${startOfTargetDay.toDateString()}`
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ [WEEKLY-AGING] Process failed:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Weekly aging process failed',
      details: error.message,
      duration
    }, { status: 500 });
  }
}
