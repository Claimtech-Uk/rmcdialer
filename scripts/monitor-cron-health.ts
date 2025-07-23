#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface HealthMetrics {
  timestamp: string;
  database: {
    queueEntries: number;
    userScores: number;
    orphanedQueues: number;
    healthPercentage: number;
  };
  lastActivity: {
    lastQueueUpdate: string | null;
    lastScoreUpdate: string | null;
    timeSinceLastUpdate: number;
  };
  recommendations: string[];
}

async function getSystemHealth(): Promise<HealthMetrics> {
  console.log('🔍 Analyzing system health...');
  
  const [
    queueCount,
    scoreCount,
    orphanedResult,
    lastQueueUpdate,
    lastScoreUpdate
  ] = await Promise.all([
    prisma.callQueue.count({ where: { status: 'pending' } }),
    prisma.userCallScore.count(),
    prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM call_queue cq
      LEFT JOIN user_call_scores ucs ON cq.user_id = ucs.user_id
      WHERE cq.status = 'pending' AND ucs.user_id IS NULL
    ` as Array<{count: bigint}>,
    prisma.callQueue.findFirst({
      where: { status: 'pending' },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true }
    }),
    prisma.userCallScore.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true }
    })
  ]);
  
  const orphanedQueues = Number(orphanedResult[0]?.count || 0);
  const healthPercentage = queueCount > 0 ? Math.round(((queueCount - orphanedQueues) / queueCount) * 100) : 100;
  
  const now = new Date();
  const timeSinceLastUpdate = lastQueueUpdate 
    ? now.getTime() - lastQueueUpdate.updatedAt.getTime()
    : 0;
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (orphanedQueues > 0) {
    recommendations.push(`Run scoring maintenance: ${orphanedQueues} queue entries need scoring records`);
  }
  
  if (timeSinceLastUpdate > 2 * 60 * 60 * 1000) { // 2 hours
    recommendations.push('Queue entries are stale - check if hourly discovery is running');
  }
  
  if (queueCount === 0) {
    recommendations.push('No pending queue entries - run queue discovery to find eligible users');
  }
  
  if (healthPercentage < 80) {
    recommendations.push('System health below 80% - immediate maintenance required');
  }
  
  return {
    timestamp: now.toISOString(),
    database: {
      queueEntries: queueCount,
      userScores: scoreCount,
      orphanedQueues,
      healthPercentage
    },
    lastActivity: {
      lastQueueUpdate: lastQueueUpdate?.updatedAt.toISOString() || null,
      lastScoreUpdate: lastScoreUpdate?.updatedAt.toISOString() || null,
      timeSinceLastUpdate
    },
    recommendations
  };
}

async function printHealthReport() {
  try {
    const health = await getSystemHealth();
    
    console.log('\n📊 RMC DIALLER SYSTEM HEALTH REPORT');
    console.log('====================================');
    console.log(`📅 Generated: ${health.timestamp}`);
    
    console.log('\n📋 DATABASE METRICS:');
    console.log(`   📬 Pending queue entries: ${health.database.queueEntries}`);
    console.log(`   📈 User call scores: ${health.database.userScores}`);
    console.log(`   ⚠️  Orphaned queues: ${health.database.orphanedQueues}`);
    
    const healthIcon = health.database.healthPercentage >= 90 ? '🟢' : 
                      health.database.healthPercentage >= 70 ? '🟡' : '🔴';
    console.log(`   ${healthIcon} System health: ${health.database.healthPercentage}%`);
    
    console.log('\n⏰ ACTIVITY TIMELINE:');
    if (health.lastActivity.lastQueueUpdate) {
      const hoursAgo = Math.round(health.lastActivity.timeSinceLastUpdate / (1000 * 60 * 60));
      console.log(`   📬 Last queue update: ${health.lastActivity.lastQueueUpdate} (${hoursAgo}h ago)`);
    } else {
      console.log(`   📬 Last queue update: Never`);
    }
    
    if (health.lastActivity.lastScoreUpdate) {
      console.log(`   📈 Last score update: ${health.lastActivity.lastScoreUpdate}`);
    } else {
      console.log(`   📈 Last score update: Never`);
    }
    
    if (health.recommendations.length > 0) {
      console.log('\n🛠️  RECOMMENDATIONS:');
      health.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    } else {
      console.log('\n✅ ALL SYSTEMS HEALTHY - No action required');
    }
    
    // Quick action commands
    if (health.recommendations.length > 0) {
      console.log('\n🚀 QUICK FIXES:');
      if (health.database.orphanedQueues > 0) {
        console.log('   npx tsx scripts/test-cron-system.ts  # Test all systems');
        console.log('   curl -X POST "http://localhost:3000/api/cron/scoring-maintenance" \\');
        console.log('     -H "Authorization: Bearer your-cron-secret"');
      }
      if (health.database.queueEntries === 0) {
        console.log('   curl -X POST "http://localhost:3000/api/cron/discover-new-leads" \\');
        console.log('     -H "Authorization: Bearer your-cron-secret"');
      }
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

printHealthReport();
