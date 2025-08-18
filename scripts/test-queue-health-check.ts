// =============================================================================
// Direct Queue Health Check Test Script
// =============================================================================
// Test the queue health check system directly without HTTP layer

import { QueueHealthCheckService } from '@/modules/health/services/queue-health-check.service';

async function main() {
  console.log('🏥 Testing Queue Health Check System directly...');
  console.log('============================================');

  const healthService = new QueueHealthCheckService();

  try {
    // Test 1: Small dry run
    console.log('\n🧪 Test 1: Small dry run (20 users)...');
    const smallResult = await healthService.runHealthCheck({
      maxUsers: 20,
      dryRun: true,
      batchSize: 10
    });

    console.log('📊 Small test results:');
    console.log(`   Checked: ${smallResult.stats.checked} users`);
    console.log(`   Would update: ${smallResult.stats.updated} users`);
    console.log(`   Distribution: ${JSON.stringify(smallResult.stats.queueDistribution, null, 2)}`);
    console.log(`   Issues: ${JSON.stringify(smallResult.stats.issues, null, 2)}`);
    console.log(`   Summary: ${smallResult.summary}`);

    if (smallResult.recommendations && smallResult.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      smallResult.recommendations.forEach(rec => {
        console.log(`   ${rec.priority.toUpperCase()}: ${rec.issue} (${rec.count} users) - ${rec.action}`);
      });
    }

    // Test 2: Larger test if small one succeeded
    if (smallResult.success && smallResult.stats.checked > 0) {
      console.log('\n🚀 Test 2: Larger dry run (100 users)...');
      const largerResult = await healthService.runHealthCheck({
        maxUsers: 100,
        dryRun: true,
        batchSize: 25
      });

      console.log('📊 Larger test results:');
      console.log(`   Checked: ${largerResult.stats.checked} users`);
      console.log(`   Would update: ${largerResult.stats.updated} users`);
      console.log(`   Update percentage: ${largerResult.stats.checked > 0 ? ((largerResult.stats.updated / largerResult.stats.checked) * 100).toFixed(1) : '0.0'}%`);
      console.log(`   Batches processed: ${largerResult.batchesProcessed}`);
      console.log(`   Duration: ${largerResult.duration}ms`);
      console.log(`   Timeout hit: ${largerResult.timeoutHit}`);

      // If we find issues, ask if we should run a real fix
      if (largerResult.stats.updated > 0) {
        console.log('\n⚠️  Issues found! You can run a real fix with:');
        console.log('    npm run queue:health:fix');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }

  console.log('\n✅ Queue health check test completed!');
}

main()
  .then(() => {
    console.log('🏁 Script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
