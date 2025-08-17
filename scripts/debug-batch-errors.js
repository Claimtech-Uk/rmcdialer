// Debug batch processing errors
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function debugBatchErrors() {
  console.log('🔍 Debugging Batch Processing Errors\n');
  
  try {
    // Check stuck processing batches
    const stuckBatches = await prisma.smsBatchStatus.findMany({
      where: {
        processingStarted: true,
        processingCompleted: false
      },
      orderBy: { processingStartedAt: 'desc' }
    });
    
    console.log('⚠️ Stuck Batches (started but not completed):');
    if (stuckBatches.length === 0) {
      console.log('   ✅ No stuck batches');
    } else {
      stuckBatches.forEach(batch => {
        const stuckTime = batch.processingStartedAt ? 
          Math.floor((Date.now() - batch.processingStartedAt.getTime()) / 1000) : 0;
        console.log(`   - ${batch.batchId}: stuck for ${stuckTime}s (${batch.messageCount} messages)`);
        if (batch.errorMessage) {
          console.log(`     Error: ${batch.errorMessage}`);
        }
      });
    }
    
    // Check messages in stuck batches
    if (stuckBatches.length > 0) {
      console.log('\n📱 Messages in stuck batches:');
      const stuckBatchIds = stuckBatches.map(b => b.batchId);
      
      const stuckMessages = await prisma.smsMessage.findMany({
        where: {
          batchId: { in: stuckBatchIds }
        },
        select: {
          batchId: true,
          phoneNumber: true,
          body: true,
          messageSid: true,
          twilioMessageSid: true,
          conversationId: true,
          userId: true
        }
      });
      
      stuckMessages.forEach(msg => {
        console.log(`   ${msg.batchId}: "${msg.body?.substring(0, 40)}..."`);
        console.log(`     Phone: ${msg.phoneNumber}, Conversation: ${msg.conversationId}`);
        console.log(`     MessageSid: ${msg.messageSid || msg.twilioMessageSid || 'MISSING'}`);
      });
    }
    
    // Check for batches with errors
    const errorBatches = await prisma.smsBatchStatus.findMany({
      where: {
        errorMessage: { not: null }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log('\n❌ Recent Error Batches:');
    if (errorBatches.length === 0) {
      console.log('   ✅ No error batches');
    } else {
      errorBatches.forEach(batch => {
        console.log(`   - ${batch.batchId}: ${batch.errorMessage}`);
      });
    }
    
    // Check feature flag status
    const { FEATURE_FLAGS } = require('@/lib/config/features');
    console.log('\n🏁 Feature Flag Status:');
    console.log(`   ENABLE_AI_SMS_AGENT: ${FEATURE_FLAGS?.ENABLE_AI_SMS_AGENT || 'undefined'}`);
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (stuckBatches.length > 0) {
      console.log('   🔧 Fix: Reset stuck batches and check for errors');
      console.log('   📞 Test: Call cron endpoint manually to see logs');
    } else {
      console.log('   ✅ No obvious blocking issues found');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugBatchErrors();
