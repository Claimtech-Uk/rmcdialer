import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Continuous Weekly Score Aging Cron Job
 * 
 * Runs every night to age users who haven't been aged in 7+ days.
 * Uses lastQueueCheck to track aging intervals efficiently.
 * 
 * LOGIC:
 * - Find users where lastQueueCheck is 7+ days old (or NULL)
 * - Calculate weeks since creation and apply appropriate aging
 * - Update lastQueueCheck to prevent duplicate aging
 * 
 * VOLUME OPTIMIZED:
 * - Processes in batches of 500 users
 * - Uses efficient database queries
 * - Prevents duplicate aging via lastQueueCheck tracking
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🕐 [WEEKLY-AGING] Starting weekly score aging process...');
    
    // Calculate 7 days ago for aging eligibility
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    console.log(`🔍 [WEEKLY-AGING] Finding users who need aging (lastQueueCheck older than ${sevenDaysAgo.toISOString()})`);
    
    // SMART AGING: Find users who haven't been aged in 7+ days
    // Use lastQueueCheck as aging tracker (efficient and already indexed)
    const candidateUsers = await prisma.userCallScore.findMany({
      where: {
        isActive: true,
        currentScore: { lt: 200 },  // Don't age frozen/converted users
        createdAt: { lt: oneWeekAgo }, // Must be at least 1 week old
        OR: [
          { lastQueueCheck: null },  // Never been aged
          { lastQueueCheck: { lt: sevenDaysAgo } }  // Last aged 7+ days ago
        ]
      },
      select: {
        userId: true,
        currentScore: true,
        currentQueueType: true,
        createdAt: true,
        lastQueueCheck: true
      },
      orderBy: {
        createdAt: 'asc'  // Process oldest users first
      },
      take: 500  // Process max 500 users per night (volume control)
    });
    
    if (candidateUsers.length === 0) {
      console.log('✅ [WEEKLY-AGING] No users need aging tonight');
      return NextResponse.json({
        success: true,
        message: 'No users found for weekly aging',
        usersAged: 0,
        duration: Date.now() - startTime
      });
    }
    
    // Calculate aging for each user and batch process
    const now = new Date();
    const usersToAge = candidateUsers.map(user => {
      const weeksOld = Math.floor((now.getTime() - user.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const agingNeeded = Math.max(0, weeksOld) * 5; // 5 points per week
      
      return {
        ...user,
        weeksOld,
        agingToApply: 5, // Always apply 5 points per aging run (weekly increments)
        totalAgingExpected: agingNeeded
      };
    });
    
    console.log(`🔄 [WEEKLY-AGING] Processing ${usersToAge.length} users (ages: ${Math.min(...usersToAge.map(u => u.weeksOld))}-${Math.max(...usersToAge.map(u => u.weeksOld))} weeks)`);
    
    // Apply +5 aging and track via lastQueueCheck
    const result = await prisma.$transaction(async (tx) => {
      // Update user_call_scores with +5 aging and tracking
      const scoreUpdate = await tx.userCallScore.updateMany({
        where: {
          userId: { in: usersToAge.map(u => u.userId) },
          isActive: true,  // Double-check they're still active
          currentScore: { lt: 200 }  // Double-check they're not already converted
        },
        data: {
          currentScore: { increment: 5 },
          lastQueueCheck: now,  // Track when aging was applied
          updatedAt: now
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
    
    // Log detailed breakdown by age groups
    const ageDistribution = usersToAge.reduce((acc, user) => {
      const ageGroup = `${user.weeksOld} week${user.weeksOld === 1 ? '' : 's'} old`;
      acc[ageGroup] = (acc[ageGroup] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Log score distribution after aging
    const scoreDistribution = usersToAge.reduce((acc, user) => {
      const newScore = user.currentScore + 5;
      const bracket = newScore < 10 ? '0-9' : newScore < 20 ? '10-19' : newScore < 50 ? '20-49' : '50+';
      acc[bracket] = (acc[bracket] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`📊 [WEEKLY-AGING] Age distribution:`, ageDistribution);
    console.log(`📊 [WEEKLY-AGING] New score distribution after aging:`, scoreDistribution);
    
    return NextResponse.json({
      success: true,
      usersAged: result.scoreUpdates,
      duration,
      ageDistribution,
      queueSyncResults: {
        callQueue: result.callQueueSync,
        unsignedQueue: result.unsignedQueueSync,
        outstandingQueue: result.outstandingQueueSync
      },
      scoreDistribution,
      agingDetails: {
        oldestUserWeeks: Math.max(...usersToAge.map(u => u.weeksOld)),
        averageAge: Math.round(usersToAge.reduce((sum, u) => sum + u.weeksOld, 0) / usersToAge.length * 10) / 10
      },
      summary: `Applied +5 weekly aging to ${result.scoreUpdates} users (ages ${Math.min(...usersToAge.map(u => u.weeksOld))}-${Math.max(...usersToAge.map(u => u.weeksOld))} weeks)`
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
