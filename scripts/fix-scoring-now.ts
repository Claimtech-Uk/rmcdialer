#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixScoringSystem() {
  console.log('🚨 EMERGENCY FIX: Populating missing user_call_scores...');

  try {
    // Get all users in queues (simpler approach)
    const queueUsers = await prisma.callQueue.findMany({
      where: { status: 'pending' },
      select: { 
        userId: true, 
        queueType: true, 
        createdAt: true,
        priorityScore: true 
      },
      distinct: ['userId']
    });

    console.log(`📊 Found ${queueUsers.length} users in queues`);

    // Get existing user scores  
    const existingScores = await prisma.userCallScore.findMany({
      select: { userId: true }
    });

    const existingUserIds = new Set(existingScores.map(score => score.userId));
    
    // Find users without scores
    const usersWithoutScores = queueUsers.filter(user => !existingUserIds.has(user.userId));
    
    console.log(`❗ Found ${usersWithoutScores.length} users without scores`);

    let created = 0;
    
    // Create missing scores
    for (const user of usersWithoutScores) {
      try {
        await prisma.userCallScore.create({
          data: {
            userId: user.userId,
            currentScore: user.priorityScore || 0,
            isActive: true,
            currentQueueType: user.queueType,
            lastResetDate: new Date(),
            lastQueueCheck: new Date(),
            totalAttempts: 0,
            successfulCalls: 0,
            baseScore: user.priorityScore || 0,
            outcomePenaltyScore: 0,
            timePenaltyScore: 0,
            createdAt: user.createdAt
          }
        });
        created++;
        console.log(`✅ Created score for user ${user.userId} (${user.queueType})`);
      } catch (error: any) {
        if (error.code !== 'P2002') { // Ignore unique constraint errors
          console.error(`❌ Failed to create score for user ${user.userId}:`, error.message);
        }
      }
    }

    console.log(`\n🎉 FIXED! Created ${created} user_call_scores records`);
    console.log('�� The scoring system is now synchronized with the queue system');
    
    // Verify the fix
    const [queueCount, scoreCount] = await Promise.all([
      prisma.callQueue.count({ where: { status: 'pending' } }),
      prisma.userCallScore.count()
    ]);

    console.log(`\n📊 Final Status:`);
    console.log(`   📋 Users in queue: ${queueCount}`);
    console.log(`   📈 User scores: ${scoreCount}`);
    console.log(`   💯 Gap closed: ${queueCount - scoreCount} remaining`);

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixScoringSystem();
