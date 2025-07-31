#!/usr/bin/env tsx

/**
 * Debug Autodialler State Transitions
 * 
 * This script tests the autodialler state machine transitions to verify
 * that the call outcome routing fix is working properly.
 */

import { AutoDiallerService } from '../modules/autodialler/services/autodialler.service';

type AutoDiallerState = 'ready' | 'loading' | 'user_loaded' | 'calling' | 'disposing' | 'paused' | 'stopped';

async function testAutoDiallerTransitions() {
  console.log('🔍 Testing Autodialler State Transitions\n');
  
  const logger = {
    info: (message: string, meta?: any) => console.log(`[AutoDialler] ${message}`, meta),
    error: (message: string, error?: any) => console.error(`[AutoDialler ERROR] ${message}`, error),
    warn: (message: string, meta?: any) => console.warn(`[AutoDialler WARN] ${message}`, meta)
  };
  
  const service = new AutoDiallerService({ logger });
  
  // Test valid transitions for the call completion flow
  const testTransitions = [
    { from: 'ready', to: 'loading', expected: true },
    { from: 'loading', to: 'user_loaded', expected: true },
    { from: 'user_loaded', to: 'calling', expected: true },    // Key fix: this should work
    { from: 'calling', to: 'disposing', expected: true },      // Key fix: this should work
    { from: 'disposing', to: 'loading', expected: true },      // Key fix: this should work
    
    // Test invalid transitions
    { from: 'user_loaded', to: 'disposing', expected: false }, // This should fail (old bug)
    { from: 'ready', to: 'disposing', expected: false },       // This should fail
  ];
  
  console.log('Testing state transitions:\n');
  
  let allPassed = true;
  
  for (const test of testTransitions) {
    const result = service.canTransitionTo(test.from as AutoDiallerState, test.to as AutoDiallerState);
    const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
    
    if (result !== test.expected) {
      allPassed = false;
    }
    
    console.log(`${status} ${test.from} → ${test.to}: ${result ? 'allowed' : 'blocked'}`);
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 All state transition tests PASSED!');
    console.log('✅ The autodialler routing fix is working correctly.');
    console.log('\nExpected call flow:');
    console.log('  ready → loading → user_loaded → calling → disposing → loading');
  } else {
    console.log('❌ Some state transition tests FAILED!');
    console.log('⚠️  The autodialler may have routing issues.');
  }
  
  console.log('\n🔧 Key fixes implemented:');
  console.log('  1. Added handleCallStart() function to transition user_loaded → calling');
  console.log('  2. CallInterface now calls onCallStart when Twilio confirms call connected');
  console.log('  3. AutoDiallerDashboard passes handleCallStart to CallInterface');
  console.log('  4. This ensures handleCallComplete can properly transition calling → disposing');
}

// Run the test
testAutoDiallerTransitions().catch(console.error); 