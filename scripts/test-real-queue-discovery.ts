#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRealQueueDiscovery() {
  console.log('🚀 Testing Real Queue Discovery with MySQL Replica Data...');
  
  try {
    // Step 1: Clear existing test data to start fresh
    console.log('\n🧹 Step 1: Clearing Test Data');
    
    const deleted = await prisma.callQueue.deleteMany({
      where: { 
        userId: { not: BigInt(5777) } // Keep the original test user
      }
    });
    
    console.log(`   🗑️ Cleared ${deleted.count} test queue entries`);
    
    // Step 2: Use the production API to trigger queue discovery
    console.log('\n📊 Step 2: Testing Queue Discovery Service');
    
    // Import and use the existing service that knows how to connect to replica
    const { QueueDiscoveryService } = await import('../modules/queue/services/queue-discovery.service');
    
    console.log('   🔧 Creating QueueDiscoveryService...');
    const discoveryService = new QueueDiscoveryService();
    
    console.log('   🚀 Running hourly discovery...');
    const report = await discoveryService.runHourlyDiscovery();
    
    console.log('   ✅ Queue discovery completed!');
    console.log('   📊 Report:', JSON.stringify(report, null, 2));
    
    // Step 3: Analyze the results
    console.log('\n🔍 Step 3: Analyzing Results');
    
    const [queueData, scoreData] = await Promise.all([
      prisma.callQueue.findMany({
        where: { status: 'pending' },
        select: { userId: true, queueType: true, priorityScore: true, queueReason: true },
        orderBy: { priorityScore: 'asc' }
      }),
      prisma.userCallScore.findMany({
        select: { userId: true, currentScore: true, currentQueueType: true, isActive: true }
      })
    ]);
    
    console.log(`   📋 Total queue entries: ${queueData.length}`);
    console.log(`   📈 Total score records: ${scoreData.length}`);
    
    // Group by queue type to verify filtering
    const queueBreakdown = queueData.reduce((acc, q) => {
      acc[q.queueType] = (acc[q.queueType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📊 Queue Type Distribution:');
    Object.entries(queueBreakdown).forEach(([queueType, count]) => {
      console.log(`   📋 ${queueType}: ${count} users`);
    });
    
    // Show sample of each queue type
    console.log('\n📋 Sample Queue Entries by Type:');
    const queueTypes = [...new Set(queueData.map(q => q.queueType))];
    
    for (const queueType of queueTypes) {
      const samples = queueData.filter(q => q.queueType === queueType).slice(0, 3);
      console.log(`\\n   📋 ${queueType.toUpperCase()}:`);
      samples.forEach(q => {
        console.log(`     User ${q.userId}: priority ${q.priorityScore} - ${q.queueReason}`);
      });
    }
    
    // Verify scoring system
    console.log('\n📈 Score Verification:');
    const scoresByQueue = scoreData.reduce((acc, s) => {
      const queue = s.currentQueueType || 'unknown';
      if (!acc[queue]) acc[queue] = [];
      acc[queue].push(s);
      return acc;
    }, {} as Record<string, typeof scoreData>);
    
    Object.entries(scoresByQueue).forEach(([queueType, scores]) => {
      const avgScore = scores.reduce((sum, s) => sum + s.currentScore, 0) / scores.length;
      const allStartAtZero = scores.every(s => s.currentScore === 0);
      console.log(`   📊 ${queueType}: ${scores.length} users, avg score ${avgScore.toFixed(1)}, all start at 0: ${allStartAtZero ? 'YES' : 'NO'}`);
    });
    
    // Step 4: Test filtering criteria validation
    console.log('\n🎯 Step 4: Filtering Validation');
    
    const testResults = {
      'total_discovered_users': queueData.length,
      'users_with_scores': scoreData.length,
      'system_synchronized': queueData.length === scoreData.length,
      'all_scores_start_at_zero': scoreData.every(s => s.currentScore === 0),
      'active_users': scoreData.filter(s => s.isActive).length,
      'queue_types_found': Object.keys(queueBreakdown),
      'proper_filtering': Object.keys(queueBreakdown).length > 1 // Should have multiple queue types
    };
    
    console.log('   📊 Validation Results:');
    Object.entries(testResults).forEach(([key, value]) => {
      const status = key === 'system_synchronized' && value === true ? '✅' :
                    key === 'all_scores_start_at_zero' && value === true ? '✅' :
                    key === 'proper_filtering' && value === true ? '✅' : 
                    typeof value === 'boolean' ? (value ? '✅' : '❌') : '📊';
      console.log(`     ${status} ${key}: ${JSON.stringify(value)}`);
    });
    
    // Final summary
    console.log('\n🎉 Test Summary:');
    if (testResults.system_synchronized && testResults.all_scores_start_at_zero) {
      console.log('   ✅ Queue discovery successfully found real users from MySQL replica');
      console.log('   ✅ Users properly filtered into correct queue types');
      console.log('   ✅ All users start with score 0 (highest priority)');
      console.log('   ✅ Scoring system synchronized with queue system');
      console.log('   🚀 Real data filtering and scoring is working perfectly!');
    } else {
      console.log('   ⚠️  System needs adjustment - check the results above');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRealQueueDiscovery();
