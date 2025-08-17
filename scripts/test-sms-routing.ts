/**
 * SMS Routing Test Script
 * 
 * Tests the smart SMS routing logic with various scenarios
 * Run this BEFORE deploying to production to ensure routing works correctly
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestScenario {
  name: string;
  originalDestination: string | null;
  expectedResponse: string;
  description: string;
}

const testScenarios: TestScenario[] = [
  {
    name: 'AI Test Number Route',
    originalDestination: '+447723495560',
    expectedResponse: '+447723495560',
    description: 'Customer texted AI test number → respond from same'
  },
  {
    name: 'Main Number Route', 
    originalDestination: '+447488879172',
    expectedResponse: '+447488879172',
    description: 'Customer texted main number → respond from same'
  },
  {
    name: 'Unknown Number Fallback',
    originalDestination: '+447999999999',
    expectedResponse: '+447723495560',
    description: 'Customer texted unknown number → fallback to AI test'
  },
  {
    name: 'Null Destination Fallback',
    originalDestination: null,
    expectedResponse: '+447723495560', 
    description: 'No destination stored → fallback to AI test'
  },
  {
    name: 'E164 Format Handling',
    originalDestination: '447723495560', // Without +
    expectedResponse: '+447723495560',
    description: 'Handle numbers without + prefix'
  }
];

function getSmartResponseNumber(originalDestination: string | null): string {
  const aiTestNumber = process.env.AI_SMS_TEST_NUMBER || '+447723495560';
  const mainNumber = process.env.TWILIO_PHONE_NUMBER || '+447488879172';
  
  console.log('🔍 Smart routing analysis:', {
    originalDestination,
    availableNumbers: { aiTestNumber, mainNumber }
  });
  
  // Routing logic: Match original destination if available and valid
  if (originalDestination) {
    // Clean the destination number for comparison
    const cleanDestination = originalDestination.replace(/^\+/, '');
    const cleanAiTest = aiTestNumber.replace(/^\+/, '');
    const cleanMain = mainNumber.replace(/^\+/, '');
    
    if (cleanDestination === cleanAiTest || originalDestination === aiTestNumber) {
      console.log('✅ Routing to AI test number (original destination)');
      return aiTestNumber;
    }
    
    if (cleanDestination === cleanMain || originalDestination === mainNumber) {
      console.log('✅ Routing to main number (original destination)');
      return mainNumber;
    }
    
    // If original destination matches neither known number, log for investigation
    console.log('⚠️ Unknown original destination, using fallback:', {
      originalDestination,
      knownNumbers: [aiTestNumber, mainNumber],
      fallback: aiTestNumber
    });
  }
  
  // Safe fallback: Use AI test number (current behavior)
  console.log('🔄 Using fallback routing (AI test number)');
  return aiTestNumber;
}

async function runRoutingTests(): Promise<void> {
  console.log('🧪 Running SMS Smart Routing Tests...\n');
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const scenario of testScenarios) {
    console.log(`📋 Testing: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    
    const result = getSmartResponseNumber(scenario.originalDestination);
    
    if (result === scenario.expectedResponse) {
      console.log(`   ✅ PASS: ${result}`);
      passedTests++;
    } else {
      console.log(`   ❌ FAIL: Expected ${scenario.expectedResponse}, got ${result}`);
      failedTests++;
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log('📊 Test Results:');
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   📈 Success Rate: ${Math.round((passedTests / testScenarios.length) * 100)}%`);
  
  if (failedTests > 0) {
    console.log('\n🚨 Some tests failed! Do not deploy until all tests pass.');
    process.exit(1);
  } else {
    console.log('\n🎉 All routing tests passed! Safe to deploy.');
  }
}

async function testDatabaseConnectivity(): Promise<void> {
  console.log('🔗 Testing database connectivity...');
  
  try {
    // Test basic connection
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    
    // Test if destination_number field exists
    try {
      await prisma.$queryRaw`SELECT destination_number FROM sms_messages LIMIT 1`;
      console.log('✅ destination_number field exists');
    } catch (error) {
      console.log('⚠️ destination_number field does not exist - run migration first');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await testDatabaseConnectivity();
    await runRoutingTests();
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { getSmartResponseNumber, runRoutingTests };
