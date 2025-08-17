/**
 * Quick routing logic test (no database required)
 * Tests the smart routing function in isolation
 */

// Smart routing function (copied from batch processor)
function getSmartResponseNumber(originalDestination) {
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

// Test scenarios
const testScenarios = [
  {
    name: 'AI Test Number Route',
    originalDestination: '+447723495560',
    expected: '+447723495560'
  },
  {
    name: 'Main Number Route', 
    originalDestination: '+447488879172',
    expected: '+447488879172'
  },
  {
    name: 'Unknown Number Fallback',
    originalDestination: '+447999999999',
    expected: '+447723495560'
  },
  {
    name: 'Null Destination Fallback',
    originalDestination: null,
    expected: '+447723495560'
  }
];

console.log('🧪 Testing Smart SMS Routing Logic...\n');

let passed = 0;
let failed = 0;

testScenarios.forEach(scenario => {
  console.log(`📋 Testing: ${scenario.name}`);
  const result = getSmartResponseNumber(scenario.originalDestination);
  
  if (result === scenario.expected) {
    console.log(`   ✅ PASS: ${result}\n`);
    passed++;
  } else {
    console.log(`   ❌ FAIL: Expected ${scenario.expected}, got ${result}\n`);
    failed++;
  }
});

console.log('📊 Test Results:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 All routing tests passed! Smart routing logic is correct.');
  process.exit(0);
} else {
  console.log('\n🚨 Some tests failed! Fix routing logic before deploying.');
  process.exit(1);
}
