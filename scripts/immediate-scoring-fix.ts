#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingScores() {
  console.log('🔧 Fixing missing user_call_scores immediately...');

  try {
    // Get all pending queue users
    const allQueueUsers = await prisma.callQueue.findMany({
      where: { status: 'pending' },
      select: {
        userId: true,
        queueType: true,
        priorityScore: true,
        createdAt: true
      },
      distinct: ['userId']
    });

    console.log(`📋 Found ${allQueueUsers.length} unique users in queues`);

    // Get existing user_call_scores
    const existingScores = await prisma.userCallScore.findMany({
      select: { userId: true }
    });

    const existingUserIds = new Set(existingScores.map(score => score.userId.toString()));
    
    // Find users without scoring records
    const usersWithoutScores = allQueueUsers.filter(user => 
      !existingUserIds.has(user.userId.toString())
    );

    console.log(`📊 Found ${usersWithoutScores.length} queue users without scoring records`);

    if (usersWithoutScores.length === 0) {
      console.log('✅ All queue users already have scoring records!');
      return;
    }

    let created = 0;

    for (const queueUser of usersWithoutScores) {
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
            createdAt: queueUser.createdAt,
            updatedAt: new Date()
          }
        });

        created++;
        if (created % 10 === 0) {
          console.log(`✅ Created ${created}/${usersWithoutScores.length} scoring records...`);
        }

      } catch (error: any) {
        if (error.code !== 'P2002') {
          console.error(`❌ Failed for user ${queueUser.userId}:`, error.message);
        }
      }
    }

    console.log(`\n🎯 IMMEDIATE FIX COMPLETED:`);
    console.log(`   ✅ Created: ${created} scoring records`);
    console.log(`   📊 Total queue users now have scores!`);

    // Verify the fix
    const verification = await prisma.userCallScore.count();
    console.log(`\n📈 Verification: ${verification} total user_call_scores records`);

  } catch (error) {
    console.error('❌ Failed to fix missing scores:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingScores().catch(console.error);
