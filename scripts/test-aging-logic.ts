#!/usr/bin/env npx tsx
/**
 * Test Script for Day-of-Week Weekly Aging Logic
 * 
 * This script demonstrates and validates the new aging system:
 * - Shows which users would be aged on each day
 * - Validates the 7-day minimum age requirement
 * - Tests the day-of-week extraction logic
 * 
 * Run with: npx tsx scripts/test-aging-logic.ts
 */

import { prisma } from '@/lib/db';

interface TestUser {
  id: number;
  userId: number;
  createdAt: Date;
  currentScore: number;
  dayOfWeek: number;
  dayName: string;
  ageInDays: number;
  wouldBeAged: boolean;
}

async function testAgingLogic() {
  console.log('🧪 Testing Day-of-Week Weekly Aging Logic\n');
  
  const now = new Date();
  const todayDayOfWeek = now.getDay();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[todayDayOfWeek];
  
  console.log(`📅 Today is ${todayName} (${todayDayOfWeek})`);
  console.log(`📅 Cutoff date: ${sevenDaysAgo.toISOString()}`);
  console.log(`📅 Will age: ${todayName}-born users who are 7+ days old\n`);
  
  try {
    // Get a sample of users to test the logic
    const sampleUsers = await prisma.userCallScore.findMany({
      where: {
        currentQueueType: 'unsigned_users',
        isActive: true,
        currentScore: { lt: 200 }
      },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        currentScore: true
      },
      take: 20,
      orderBy: { createdAt: 'desc' }
    });
    
    if (sampleUsers.length === 0) {
      console.log('⚠️ No sample users found in user_call_scores table');
      console.log('💡 Create some test users first, then run this script');
      return;
    }
    
    // Process each user to show aging logic
    const testResults: TestUser[] = sampleUsers.map(user => {
      const userDayOfWeek = user.createdAt.getDay();
      const ageInDays = (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const wouldBeAged = userDayOfWeek === todayDayOfWeek && user.createdAt < sevenDaysAgo;
      
      return {
        id: user.id,
        userId: user.userId,
        createdAt: user.createdAt,
        currentScore: user.currentScore,
        dayOfWeek: userDayOfWeek,
        dayName: dayNames[userDayOfWeek],
        ageInDays: Math.floor(ageInDays * 10) / 10,
        wouldBeAged
      };
    });
    
    // Display results
    console.log('📊 Sample Users and Aging Logic:');
    console.log('─'.repeat(100));
    console.log(`${'User ID'.padEnd(8)} | ${'Created'.padEnd(12)} | ${'Day'.padEnd(9)} | ${'Age (days)'.padEnd(10)} | ${'Score'.padEnd(5)} | ${'Aged Today?'.padEnd(10)}`);
    console.log('─'.repeat(100));
    
    testResults.forEach(user => {
      const createdDate = user.createdAt.toISOString().split('T')[0];
      const agedIcon = user.wouldBeAged ? '✅ YES' : '❌ NO';
      const ageColor = user.ageInDays >= 7 ? '🟢' : '🔴';
      
      console.log(
        `${user.userId.toString().padEnd(8)} | ` +
        `${createdDate.padEnd(12)} | ` +
        `${user.dayName.padEnd(9)} | ` +
        `${ageColor} ${user.ageInDays.toString().padEnd(7)} | ` +
        `${user.currentScore.toString().padEnd(5)} | ` +
        `${agedIcon.padEnd(10)}`
      );
    });
    
    // Summary statistics
    const usersToAge = testResults.filter(u => u.wouldBeAged);
    const usersByDay = testResults.reduce((acc, user) => {
      acc[user.dayName] = (acc[user.dayName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📈 Test Results Summary:');
    console.log(`👥 Total sample users: ${testResults.length}`);
    console.log(`🎯 Users that would be aged today (${todayName}): ${usersToAge.length}`);
    console.log(`⏰ Users under 7 days old: ${testResults.filter(u => u.ageInDays < 7).length}`);
    console.log(`✅ Users 7+ days old: ${testResults.filter(u => u.ageInDays >= 7).length}`);
    
    console.log('\n📊 Distribution by Day of Week:');
    dayNames.forEach(day => {
      const count = usersByDay[day] || 0;
      const icon = day === todayName ? '👈 TODAY' : '';
      console.log(`  ${day}: ${count} users ${icon}`);
    });
    
    // Test the SQL query that would be used
    console.log('\n🔍 Testing Actual SQL Query:');
    const actualQuery = `
      SELECT COUNT(*) as count
      FROM user_call_scores 
      WHERE current_queue_type = 'unsigned_users'
        AND is_active = true 
        AND current_score < 200
        AND EXTRACT(DOW FROM created_at) = $1
        AND created_at < $2
    `;
    
    const actualCount = await prisma.$queryRawUnsafe(
      actualQuery,
      todayDayOfWeek,
      sevenDaysAgo
    ) as any[];
    
    const realUsersToAge = parseInt(actualCount[0].count);
    console.log(`📋 Real users that would be aged: ${realUsersToAge}`);
    
    if (realUsersToAge !== usersToAge.length) {
      console.log(`⚠️ Note: Sample shows ${usersToAge.length}, but full query shows ${realUsersToAge}`);
      console.log(`   This is normal - we only sampled ${testResults.length} users for testing`);
    }
    
    console.log('\n✅ Aging logic test completed successfully!');
    console.log(`🎯 System is ready to age ${realUsersToAge} ${todayName}-born users`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAgingLogic().catch(console.error);
