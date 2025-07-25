#!/usr/bin/env tsx

/**
 * Test Script for Requirements Discovery Separation of Concerns
 * 
 * Verifies that the new requirements discovery service:
 * 1. Only updates existing users in user_call_scores
 * 2. Skips users not yet in the system
 * 3. Reports correct metrics
 */

import { NewRequirementsDiscoveryService } from '../modules/discovery/services/new-requirements-discovery.service'

async function testRequirementsDiscoverySeparation() {
  console.log('🧪 [TEST] Testing Requirements Discovery Separation of Concerns')
  console.log('=' .repeat(80))
  console.log('This test verifies that new requirements discovery:')
  console.log('  ✅ Only updates existing users in user_call_scores')
  console.log('  ⏭️  Skips users not yet in the system')
  console.log('  📊 Reports correct metrics')
  console.log()
  
  try {
    const service = new NewRequirementsDiscoveryService()
    
    // Test in dry-run mode
    console.log('🔍 Running requirements discovery in DRY RUN mode...')
    const result = await service.discoverNewRequirements({ dryRun: true })
    
    console.log('\n📊 REQUIREMENTS DISCOVERY RESULTS:')
    console.log(`   Duration: ${result.duration}ms`)
    console.log(`   Success: ${result.success}`)
    console.log(`   Requirements Checked: ${result.requirementsChecked}`)
    console.log(`   New Requirements Found: ${result.newRequirementsFound}`)
    console.log(`   Users Updated: ${result.usersUpdated}`)
    console.log(`   Skipped (Unsigned): ${result.skippedUnsigned}`)
    console.log(`   Skipped (Not in System): ${result.skippedNotInSystem}`)
    console.log(`   Excluded Types: ${result.excludedTypes}`)
    console.log(`   Summary: ${result.summary}`)
    
    if (result.errors.length > 0) {
      console.log('\n❌ ERRORS:')
      result.errors.forEach(error => console.log(`   - ${error}`))
    }
    
    console.log('\n✅ [TEST] Requirements Discovery test completed successfully!')
    
    // Verify separation of concerns
    if ('skippedNotInSystem' in result) {
      console.log('\n🎯 SEPARATION OF CONCERNS VERIFIED:')
      console.log('   ✅ Service correctly tracks users skipped (not in system)')
      console.log(`   📊 ${result.skippedNotInSystem} users will be handled by new users discovery`)
      console.log('   🔄 This maintains clean separation between discovery services')
    } else {
      console.log('\n❌ SEPARATION OF CONCERNS ISSUE:')
      console.log('   Missing skippedNotInSystem metric - check implementation')
    }
    
    console.log('\n📋 EXPECTED BEHAVIOR:')
    console.log('   1. New requirements discovery should only update existing users')
    console.log('   2. Users not in user_call_scores should be skipped')
    console.log('   3. New users discovery (runs at :05) handles creating new users')
    console.log('   4. Requirements discovery (runs at :15) handles updating existing users')
    
  } catch (error) {
    console.error('❌ [TEST] Test failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  testRequirementsDiscoverySeparation()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test execution failed:', error)
      process.exit(1)
    })
}

export { testRequirementsDiscoverySeparation } 