// Test the BatchSmsProcessor directly
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function testBatchProcessor() {
  console.log('🧪 Testing BatchSmsProcessor Directly\n');
  
  try {
    // Test 1: Check if BatchSmsProcessor can be imported
    console.log('1️⃣ Testing imports...');
    
    let BatchSmsProcessor, SMSService, MagicLinkService;
    try {
      const aiAgents = await import('../modules/ai-agents/index.js');
      BatchSmsProcessor = aiAgents.BatchSmsProcessor;
      
      const communications = await import('../modules/communications/index.js');
      SMSService = communications.SMSService;
      MagicLinkService = communications.MagicLinkService;
      
      console.log('   ✅ All imports successful');
    } catch (importError) {
      console.log('   ❌ Import failed:', importError.message);
      return;
    }
    
    // Test 2: Create processor instance
    console.log('\n2️⃣ Creating BatchSmsProcessor...');
    
    let processor;
    try {
      processor = new BatchSmsProcessor(
        new SMSService({
          authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) }
        }),
        new MagicLinkService({
          authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) }
        })
      );
      console.log('   ✅ BatchSmsProcessor created successfully');
    } catch (constructorError) {
      console.log('   ❌ Constructor failed:', constructorError.message);
      return;
    }
    
    // Test 3: Test processBatch method
    console.log('\n3️⃣ Testing processBatch method...');
    
    const testInput = {
      fromPhone: '447738585850',
      message: 'Test message for batch processing',
      userId: undefined,
      replyFromE164: '+447723495560',
      messageSid: 'TEST_BATCH_MSG'
    };
    
    console.log('   Input:', testInput);
    
    try {
      console.log('   🚀 Calling processor.processBatch...');
      const startTime = Date.now();
      
      const result = await processor.processBatch(testInput);
      
      const duration = Date.now() - startTime;
      console.log(`   ✅ processBatch completed in ${duration}ms`);
      console.log('   Result:', {
        hasReply: !!result.reply?.text,
        replyLength: result.reply?.text?.length || 0,
        actionCount: result.actions?.length || 0
      });
      
    } catch (processingError) {
      console.log('   ❌ processBatch failed:', processingError.message);
      console.log('   Stack:', processingError.stack);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBatchProcessor();
