// Test script for the optimized getUserDataOptimized function
// Run with: node test-db-optimization.js

const { UserService } = require('./modules/users/services/user.service.ts');

async function testDatabaseOptimization() {
  console.log('🧪 Testing optimized database query performance...\n');
  
  const userService = new UserService();
  
  // Test with a few different user IDs to see the performance difference
  const testUserIds = [2064, 1234, 5678]; // Include the problematic user ID 2064
  
  for (const userId of testUserIds) {
    console.log(`📊 Testing user ID: ${userId}`);
    console.log('=' .repeat(50));
    
    try {
      const startTime = Date.now();
      
      // Test the getUserCallContext which uses our optimized getUserDataOptimized
      const context = await userService.getUserCallContext(userId);
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      console.log(`⏱️  Query completed in: ${queryTime}ms`);
      
      if (context) {
        console.log(`✅ User found: ${context.user.firstName || 'No name'} ${context.user.lastName || ''}`);
        console.log(`📋 Claims: ${context.claims.length}`);
        console.log(`📄 Pending requirements: ${context.claims.reduce((sum, c) => sum + c.requirements.length, 0)}`);
        console.log(`🔏 Has signature: ${context.user.current_signature_file_id ? 'Yes' : 'No'}`);
        
        // Test the data structure compatibility
        const hasSignature = Boolean(context.user.current_signature_file_id);
        const pendingCount = context.claims.reduce((sum, c) => sum + c.requirements.filter(r => r.status === 'PENDING').length, 0);
        const primaryStatus = context.claims[0]?.status;
        
        console.log(`🎯 SMS Context Data:`);
        console.log(`   - hasSignature: ${hasSignature}`);
        console.log(`   - pendingCount: ${pendingCount}`);
        console.log(`   - primaryStatus: ${primaryStatus || 'None'}`);
        
        // Performance assessment
        if (queryTime < 500) {
          console.log(`🚀 EXCELLENT performance! (${queryTime}ms)`);
        } else if (queryTime < 2000) {
          console.log(`✅ GOOD performance (${queryTime}ms)`);
        } else if (queryTime < 5000) {
          console.log(`⚠️  ACCEPTABLE performance (${queryTime}ms)`);
        } else {
          console.log(`❌ SLOW performance (${queryTime}ms) - needs further optimization`);
        }
        
      } else {
        console.log(`❌ User not found`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing user ${userId}:`, error.message);
    }
    
    console.log('\n');
  }
}

// Test specifically for SMS agent context building (what actually gets used)
async function testSMSContextBuilding() {
  console.log('📱 Testing SMS Agent Context Building...\n');
  
  const { AgentContextBuilder } = require('./modules/ai-agents/core/context-builder.ts');
  const contextBuilder = new AgentContextBuilder();
  
  // Test with a phone number (replace with a real one from your DB)
  const testPhone = '+447888123456'; // Replace with actual test phone
  
  try {
    const startTime = Date.now();
    
    const agentContext = await contextBuilder.buildFromPhone(testPhone);
    
    const endTime = Date.now();
    const queryTime = endTime - startTime;
    
    console.log(`⏱️  SMS Context built in: ${queryTime}ms`);
    console.log(`📊 Result:`, JSON.stringify(agentContext, null, 2));
    
    if (queryTime < 1000) {
      console.log(`🚀 EXCELLENT SMS context performance!`);
    } else {
      console.log(`⚠️  SMS context took ${queryTime}ms - could be faster`);
    }
    
  } catch (error) {
    console.error(`❌ Error building SMS context:`, error.message);
  }
}

// Run the tests
async function runTests() {
  try {
    await testDatabaseOptimization();
    await testSMSContextBuilding();
    console.log('✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

runTests();

