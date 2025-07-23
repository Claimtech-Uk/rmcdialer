#!/usr/bin/env tsx

// Test script to manually run all cron jobs locally

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const cronSecret = process.env.CRON_SECRET || 'your-local-cron-secret';

const cronJobs = [
  {
    name: 'Queue Discovery',
    path: '/api/cron/discover-new-leads',
    description: 'Finds new eligible users and adds them to queues'
  },
  {
    name: 'Scoring Maintenance', 
    path: '/api/cron/scoring-maintenance',
    description: 'Creates missing user_call_scores and syncs queue priorities'
  },
  {
    name: 'Daily Cleanup',
    path: '/api/cron/daily-cleanup', 
    description: 'Removes stale data and processes conversions'
  }
];

async function testCronJob(job: typeof cronJobs[0]) {
  console.log(`\n🔄 Testing ${job.name}...`);
  console.log(`📋 ${job.description}`);
  
  try {
    const response = await fetch(`${baseUrl}${job.path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${job.name} completed successfully`);
      console.log(`📊 Result:`, result.summary || result.report?.summary || 'Success');
    } else {
      console.log(`❌ ${job.name} failed:`, result.error);
    }
    
  } catch (error) {
    console.log(`❌ ${job.name} error:`, error);
  }
}

async function testAllCronJobs() {
  console.log('🧪 Testing all cron jobs locally...');
  console.log(`🌐 Base URL: ${baseUrl}`);
  
  for (const job of cronJobs) {
    await testCronJob(job);
  }
  
  console.log('\n✅ All cron job tests completed!');
}

// Run the tests
testAllCronJobs().catch(console.error);
