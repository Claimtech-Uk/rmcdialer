// Simple test to isolate the issue
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function simpleTest() {
  console.log('🔧 Simple Batch Processing Test\n');
  
  try {
    // First, reset one of the stuck batches for manual testing
    const stuckBatch = await prisma.smsBatchStatus.findFirst({
      where: {
        processingStarted: true,
        processingCompleted: false
      }
    });
    
    if (!stuckBatch) {
      console.log('❌ No stuck batches found to test');
      return;
    }
    
    console.log(`🔧 Found stuck batch: ${stuckBatch.batchId}`);
    console.log(`   Phone: ${stuckBatch.phoneNumber}`);
    console.log(`   Messages: ${stuckBatch.messageCount}`);
    
    // Get messages for this batch
    const messages = await prisma.smsMessage.findMany({
      where: { batchId: stuckBatch.batchId },
      select: {
        body: true,
        phoneNumber: true,
        userId: true,
        conversationId: true,
        messageSid: true,
        twilioMessageSid: true
      }
    });
    
    console.log('\n📱 Messages in batch:');
    messages.forEach((msg, i) => {
      console.log(`   ${i + 1}. "${msg.body?.substring(0, 50)}..."`);
    });
    
    // Test the exact data that would be sent to AI
    const combinedMessage = messages
      .map(msg => msg.body)
      .filter(Boolean)
      .join(' ');
      
    console.log('\n📝 Combined message for AI:');
    console.log(`"${combinedMessage}"`);
    console.log(`Length: ${combinedMessage.length} characters`);
    
    // Check if any required fields are missing
    const phoneNumber = messages[0]?.phoneNumber;
    const userId = messages[0]?.userId;
    const conversationId = messages[0]?.conversationId;
    const messageSid = messages[0]?.messageSid || messages[0]?.twilioMessageSid;
    
    console.log('\n🔍 Data validation:');
    console.log(`   Phone: ${phoneNumber || 'MISSING'}`);
    console.log(`   User ID: ${userId || 'MISSING'}`);
    console.log(`   Conversation ID: ${conversationId || 'MISSING'}`);
    console.log(`   Message SID: ${messageSid || 'MISSING'}`);
    console.log(`   AI Test Number: ${process.env.AI_SMS_TEST_NUMBER || 'MISSING'}`);
    
    // Try to manually trigger processing for this batch
    console.log('\n🚀 Attempting manual processing...');
    
    const response = await fetch('http://localhost:3000/api/cron/process-sms-batches', {
      method: 'GET'
    });
    
    console.log(`   Response status: ${response.status}`);
    if (response.ok) {
      const result = await response.json();
      console.log('   Result:', result);
    } else {
      const error = await response.text();
      console.log('   Error:', error.substring(0, 200));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

simpleTest();
