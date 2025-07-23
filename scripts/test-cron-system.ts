#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const cronSecret = process.env.CRON_SECRET || 'test-secret';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration: number;
  details?: any;
}

const cronJobs = [
  {
    name: 'Queue Discovery',
    path: '/api/cron/discover-new-leads',
    description: 'Finds new eligible users and adds them to queues',
    expectedKeys: ['report', 'timestamp']
  },
  {
    name: 'Scoring Maintenance', 
    path: '/api/cron/scoring-maintenance',
    description: 'Creates missing user_call_scores and syncs queue priorities',
    expectedKeys: ['maintenanceStats', 'summary']
  },
  {
    name: 'Daily Cleanup',
    path: '/api/cron/daily-cleanup', 
    description: 'Removes stale data and processes conversions',
    expectedKeys: ['cleanupStats', 'summary']
  }
];

async function testCronJob(job: typeof cronJobs[0]): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`\n🔄 Testing ${job.name}...`);
    console.log(`📋 ${job.description}`);
    
    const response = await fetch(`${baseUrl}${job.path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        name: job.name,
        success: false,
        message: `HTTP ${response.status}: ${result.error || 'Unknown error'}`,
        duration,
        details: result
      };
    }

    // Check if expected keys are present
    const missingKeys = job.expectedKeys.filter(key => !(key in result));
    if (missingKeys.length > 0) {
      return {
        name: job.name,
        success: false,
        message: `Missing expected keys: ${missingKeys.join(', ')}`,
        duration,
        details: result
      };
    }

    return {
      name: job.name,
      success: true,
      message: result.summary || result.report?.summary || 'Completed successfully',
      duration,
      details: result
    };
    
  } catch (error) {
    return {
      name: job.name,
      success: false,
      message: `Network error: ${error}`,
      duration: Date.now() - startTime
    };
  }
}

async function testDatabaseHealth(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('\n🔍 Testing database health...');
    
    const [queueCount, scoreCount, agentCount] = await Promise.all([
      prisma.callQueue.count({ where: { status: 'pending' } }),
      prisma.userCallScore.count(),
      prisma.agent.count()
    ]);
    
    const healthData = {
      pendingQueueEntries: queueCount,
      userCallScores: scoreCount,
      totalAgents: agentCount,
      timestamp: new Date().toISOString()
    };
    
    return {
      name: 'Database Health',
      success: true,
      message: `${queueCount} pending queues, ${scoreCount} scores, ${agentCount} agents`,
      duration: Date.now() - startTime,
      details: healthData
    };
    
  } catch (error) {
    return {
      name: 'Database Health',
      success: false,
      message: `Database error: ${error}`,
      duration: Date.now() - startTime
    };
  }
}

async function testSystemIntegrity(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('\n�� Testing system integrity...');
    
    // Check for orphaned queue entries (no scoring records)
    const orphanedQueues = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM call_queue cq
      LEFT JOIN user_call_scores ucs ON cq.user_id = ucs.user_id
      WHERE cq.status = 'pending' AND ucs.user_id IS NULL
    ` as Array<{count: bigint}>;
    
    const orphanCount = Number(orphanedQueues[0]?.count || 0);
    
    // Check for inactive users in active queues
    const inactiveInQueues = await prisma.callQueue.count({
      where: {
        status: 'pending',
        userCallScore: {
          isActive: false
        }
      }
    });
    
    const issues = [];
    if (orphanCount > 0) issues.push(`${orphanCount} orphaned queue entries`);
    if (inactiveInQueues > 0) issues.push(`${inactiveInQueues} inactive users in queues`);
    
    const isHealthy = issues.length === 0;
    
    return {
      name: 'System Integrity',
      success: isHealthy,
      message: isHealthy ? 'All systems healthy' : `Issues found: ${issues.join(', ')}`,
      duration: Date.now() - startTime,
      details: {
        orphanedQueues: orphanCount,
        inactiveInQueues,
        issues,
        isHealthy
      }
    };
    
  } catch (error) {
    return {
      name: 'System Integrity',
      success: false,
      message: `Integrity check error: ${error}`,
      duration: Date.now() - startTime
    };
  }
}

async function runAllTests() {
  console.log('🧪 RMC Dialler Cron System Test Suite');
  console.log('=====================================');
  console.log(`🌐 Testing against: ${baseUrl}`);
  console.log(`🔐 Using cron secret: ${cronSecret.slice(0, 8)}...`);
  
  const results: TestResult[] = [];
  
  // Test database health first
  results.push(await testDatabaseHealth());
  
  // Test system integrity
  results.push(await testSystemIntegrity());
  
  // Test all cron jobs
  for (const job of cronJobs) {
    results.push(await testCronJob(job));
  }
  
  // Print summary
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('========================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const time = `(${result.duration}ms)`;
    console.log(`${icon} ${result.name}: ${result.message} ${time}`);
  });
  
  console.log(`\n🎯 OVERALL: ${passed}/${results.length} tests passed`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`\n${result.name}:`);
      console.log(`  Error: ${result.message}`);
      if (result.details) {
        console.log(`  Details:`, JSON.stringify(result.details, null, 2));
      }
    });
  }
  
  const allPassed = failed === 0;
  console.log(`\n${allPassed ? '🎉' : '🚨'} ${allPassed ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED!'}`);
  
  return allPassed;
}

// Run the tests
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
