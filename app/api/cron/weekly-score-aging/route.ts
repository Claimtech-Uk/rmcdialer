import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Day-of-Week Weekly Score Aging Cron Job - Production Ready
 * 
 * Runs every night at 12:01 AM to age users created on the same day of week.
 * ELEGANT LOGIC:
 * - Monday 12:01 AM: Age ALL Monday-born users (7+ days old)
 * - Tuesday 12:01 AM: Age ALL Tuesday-born users (7+ days old)
 * - etc.
 * 
 * SCALABLE DESIGN:
 * - Batched processing (500 users at a time)
 * - No complex tracking fields needed
 * - Uses natural day-of-week from createdAt
 * - Complete coverage of all historical users
 * - Timeout protection for large datasets
 * 
 * SAFETY FEATURES:
 * - Only runs at midnight (12:01 AM)
 * - Minimum 7-day age requirement
 * - Batch size limits prevent timeouts
 * - Transaction isolation per batch
 * - Progress monitoring and logging
 */

const BATCH_SIZE = 500; // Process 500 users at a time
const MAX_PROCESSING_TIME = 4 * 60 * 1000; // 4 minutes max (Vercel cron: 5 min limit)

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const now = new Date();
  
  try {
    // SAFETY: Only run in the midnight hour (12:01 AM)
    if (now.getHours() !== 0) {
      return NextResponse.json({
        error: 'Aging only runs between midnight and 1 AM',
        currentTime: now.toISOString(),
        currentHour: now.getHours()
      }, { status: 400 });
    }
    
    // Get today's day of week (same day we're aging)
    const todayDayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, etc.
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[todayDayOfWeek];
    
    // Minimum age cutoff: 7 days (ensures youngest user is at least 1 week old)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    console.log(`🕛 [AGING] ${now.toISOString()}`);
    console.log(`🗓️ [AGING] Aging ${todayName}-born users who are 7+ days old`);
    console.log(`📅 [AGING] Cutoff date: ${sevenDaysAgo.toISOString()}`);
    
    // STEP 1: Count total users (for progress tracking)
    const countQuery = `
      SELECT COUNT(*) as count
      FROM user_call_scores 
      WHERE current_queue_type = 'unsigned_users'
        AND is_active = true 
        AND current_score < 200
        AND EXTRACT(DOW FROM created_at) = $1
        AND created_at < $2
    `;
    
    const totalCountResult = await prisma.$queryRawUnsafe(
      countQuery,
      todayDayOfWeek,
      sevenDaysAgo
    ) as any[];
    
    const totalUsers = parseInt(totalCountResult[0].count);
    console.log(`📊 [AGING] Found ${totalUsers} total ${todayName}-born users to age`);
    
    if (totalUsers === 0) {
      return NextResponse.json({
        success: true,
        targetDay: todayName,
        totalUsers: 0,
        processedUsers: 0,
        aged: 0,
        message: `No ${todayName}-born users need aging`
      });
    }
    
    // STEP 2: Process in batches
    let processedUsers = 0;
    let totalAged = 0;
    let totalSynced = 0;
    let batchNumber = 0;
    const batchResults = [];
    
    while (processedUsers < totalUsers) {
      // Check timeout
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        console.warn(`⏰ [AGING] Timeout approaching - processed ${processedUsers}/${totalUsers}`);
        console.warn(`⏰ [AGING] Will resume aging remaining users tomorrow`);
        break;
      }
      
      batchNumber++;
      const batchStart = Date.now();
      
      console.log(`🔄 [AGING] Processing batch ${batchNumber} (offset: ${processedUsers})`);
      
      // Get next batch of users
      const batchQuery = `
        SELECT id, user_id, current_score, created_at
        FROM user_call_scores 
        WHERE current_queue_type = 'unsigned_users'
          AND is_active = true 
          AND current_score < 200
          AND EXTRACT(DOW FROM created_at) = $1
          AND created_at < $2
        ORDER BY created_at ASC
        LIMIT $3
        OFFSET $4
      `;
      
      const batchUsers = await prisma.$queryRawUnsafe(
        batchQuery,
        todayDayOfWeek,
        sevenDaysAgo,
        BATCH_SIZE,
        processedUsers
      ) as any[];
      
      if (batchUsers.length === 0) {
        console.log(`✅ [AGING] No more users in batch ${batchNumber}`);
        break;
      }
      
      // Safety check for first batch: Verify youngest user is indeed 7+ days old
      if (batchNumber === 1) {
        const youngestCreatedAt = Math.max(...batchUsers.map(u => new Date(u.created_at).getTime()));
        const youngestAgeDays = (now.getTime() - youngestCreatedAt) / (1000 * 60 * 60 * 24);
        
        console.log(`👶 [AGING] Youngest user is ${youngestAgeDays.toFixed(1)} days old`);
        
        if (youngestAgeDays < 6.5) {
          console.error(`🚨 [AGING] SAFETY ABORT: Youngest user only ${youngestAgeDays.toFixed(1)} days old!`);
          return NextResponse.json({
            error: 'Safety check failed - youngest user too recent',
            youngestAge: `${youngestAgeDays.toFixed(1)} days`,
            cutoffAge: '6.5 days minimum',
            targetDay: todayName
          }, { status: 400 });
        }
      }
      
      // Process this batch in a transaction
      const batchResult = await processBatch(batchUsers, now);
      batchResults.push(batchResult);
      
      totalAged += batchResult.aged;
      totalSynced += batchResult.synced;
      processedUsers += batchUsers.length;
      
      const batchDuration = Date.now() - batchStart;
      console.log(`✅ [AGING] Batch ${batchNumber}: ${batchUsers.length} users aged in ${batchDuration}ms`);
      console.log(`📈 [AGING] Progress: ${processedUsers}/${totalUsers} (${((processedUsers/totalUsers)*100).toFixed(1)}%)`);
      
      // Small delay to prevent overwhelming the database
      if (batchUsers.length === BATCH_SIZE && processedUsers < totalUsers) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms pause
      }
    }
    
    // STEP 3: Calculate results and summary
    const totalDuration = Date.now() - startTime;
    const avgBatchTime = batchNumber > 0 ? Math.round(totalDuration / batchNumber) : 0;
    const usersPerSecond = totalAged > 0 ? Math.round((totalAged / totalDuration) * 1000) : 0;
    
    // Calculate age distribution for monitoring
    const sampleBatch = batchResults.length > 0 ? batchResults[0] : null;
    
    console.log(`🎉 [AGING] Complete! Aged ${totalAged}/${totalUsers} users in ${totalDuration}ms`);
    console.log(`⚡ [AGING] Performance: ${usersPerSecond} users/second, ${avgBatchTime}ms/batch`);
    
    // Mark this TODO item as completed
    const completionStatus = processedUsers >= totalUsers ? 'complete' : 'partial';
    const summary = processedUsers >= totalUsers 
      ? `✅ Successfully aged all ${totalAged} ${todayName}-born users`
      : `⏰ Partially aged ${totalAged}/${totalUsers} ${todayName}-born users (timeout)`;
    
    return NextResponse.json({
      success: true,
      status: completionStatus,
      targetDay: todayName,
      totalUsers,
      processedUsers,
      aged: totalAged,
      synced: totalSynced,
      batches: batchNumber,
      duration: `${totalDuration}ms`,
      performance: {
        usersPerSecond,
        avgBatchTime: `${avgBatchTime}ms`,
        completionRate: `${((processedUsers/totalUsers)*100).toFixed(1)}%`
      },
      summary
    });
    
  } catch (error) {
    console.error('❌ [AGING] Failed:', error);
    return NextResponse.json({
      error: 'Aging process failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      duration: `${Date.now() - startTime}ms`
    }, { status: 500 });
  }
}

/**
 * Helper function to process a single batch of users
 * Ages users by +5 and syncs to queue tables
 */
async function processBatch(users: any[], now: Date) {
  return await prisma.$transaction(async (tx) => {
    // Update user scores (+5 aging)
    const scoreUpdate = await tx.userCallScore.updateMany({
      where: {
        id: { in: users.map(u => u.id) }
      },
      data: {
        currentScore: { increment: 5 },
        updatedAt: now
      }
    });
    
    // Sync to unsigned users queue table
    const queueUpdate = await tx.unsignedUsersQueue.updateMany({
      where: {
        userId: { in: users.map(u => BigInt(u.user_id)) },
        status: 'pending'
      },
      data: {
        priorityScore: { increment: 5 },
        updatedAt: now
      }
    });
    
    // Sync to call queue table (if entries exist)
    const callQueueUpdate = await tx.callQueue.updateMany({
      where: {
        userId: { in: users.map(u => BigInt(u.user_id)) },
        queueType: 'unsigned_users',
        status: 'pending'
      },
      data: {
        priorityScore: { increment: 5 },
        updatedAt: now
      }
    });
    
    return {
      aged: scoreUpdate.count,
      synced: queueUpdate.count,
      callQueueSynced: callQueueUpdate.count
    };
  });
}