// Reset stuck batches for reprocessing
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function resetStuckBatches() {
  console.log('🔧 Resetting Stuck Batches\n');
  
  try {
    // Find stuck batches
    const stuckBatches = await prisma.smsBatchStatus.findMany({
      where: {
        processingStarted: true,
        processingCompleted: false
      }
    });
    
    console.log(`📦 Found ${stuckBatches.length} stuck batches`);
    
    if (stuckBatches.length === 0) {
      console.log('✅ No stuck batches to reset');
      return;
    }
    
    // Reset batch statuses
    const resetBatches = await prisma.smsBatchStatus.updateMany({
      where: {
        processingStarted: true,
        processingCompleted: false
      },
      data: {
        processingStarted: false,
        processingStartedAt: null,
        errorMessage: null
      }
    });
    
    console.log(`✅ Reset ${resetBatches.count} batch statuses`);
    
    // Reset associated messages
    const stuckBatchIds = stuckBatches.map(b => b.batchId);
    const resetMessages = await prisma.smsMessage.updateMany({
      where: {
        batchId: { in: stuckBatchIds },
        batchProcessed: true,
        batchResponseSent: false
      },
      data: {
        batchProcessed: false
      }
    });
    
    console.log(`✅ Reset ${resetMessages.count} message statuses`);
    
    // Show what will be reprocessed
    console.log('\n📋 Batches ready for reprocessing:');
    stuckBatches.forEach(batch => {
      console.log(`   - ${batch.batchId} (${batch.phoneNumber}, ${batch.messageCount} messages)`);
    });
    
    console.log('\n🎯 Next steps:');
    console.log('   1. The next cron run will pick up these batches');
    console.log('   2. Or trigger manually: curl -X GET https://rmcdialer.vercel.app/api/cron/process-sms-batches');
    console.log('   3. Monitor status: curl https://rmcdialer.vercel.app/api/debug/sms-batch-status');
    
  } catch (error) {
    console.error('❌ Reset failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetStuckBatches();
