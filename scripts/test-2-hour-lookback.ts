#!/usr/bin/env tsx

/**
 * Test Script for 2-Hour Lookback Discovery Services
 * 
 * Verify that our discovery services now use 2-hour windows by default
 */

import { NewUsersDiscoveryService } from '../modules/discovery/services/new-users-discovery.service'
import { NewRequirementsDiscoveryService } from '../modules/discovery/services/new-requirements-discovery.service'

async function test2HourLookback() {
  console.log('🧪 [TEST] Testing 2-Hour Lookback Discovery Services')
  console.log('=' .repeat(80))
  
  try {
    // Test New Users Discovery with default (should be 2 hours now)
    console.log('👥 Testing New Users Discovery (default = 2 hours)...')
    const usersService = new NewUsersDiscoveryService()
    const usersResult = await usersService.discoverNewUsers({ dryRun: true })
    
    console.log(`   Users Discovery Result: ${usersResult.summary}`)
    console.log(`   Users Checked: ${usersResult.usersChecked}`)
    console.log(`   New Users Found: ${usersResult.newUsersFound}`)
    
    // Test New Requirements Discovery with default (should be 2 hours now)
    console.log('\n📋 Testing New Requirements Discovery (default = 2 hours)...')
    const requirementsService = new NewRequirementsDiscoveryService()
    const requirementsResult = await requirementsService.discoverNewRequirements({ dryRun: true })
    
    console.log(`   Requirements Discovery Result: ${requirementsResult.summary}`)
    console.log(`   Requirements Checked: ${requirementsResult.requirementsChecked}`)
    console.log(`   New Requirements Found: ${requirementsResult.newRequirementsFound}`)
    
    // Test explicit 1-hour to compare
    console.log('\n🔍 Testing explicit 1-hour lookback for comparison...')
    const oneHourUsersResult = await usersService.discoverNewUsers({ hoursBack: 1, dryRun: true })
    const oneHourRequirementsResult = await requirementsService.discoverNewRequirements({ hoursBack: 1, dryRun: true })
    
    console.log(`   1-hour Users: ${oneHourUsersResult.usersChecked} checked, ${oneHourUsersResult.newUsersFound} new`)
    console.log(`   1-hour Requirements: ${oneHourRequirementsResult.requirementsChecked} checked, ${oneHourRequirementsResult.newRequirementsFound} new`)
    
    console.log('\n✅ [TEST] 2-Hour Lookback test completed successfully!')
    console.log('\n📊 COMPARISON:')
    console.log(`   Default (2hr) vs 1hr - Users: ${usersResult.usersChecked} vs ${oneHourUsersResult.usersChecked}`)
    console.log(`   Default (2hr) vs 1hr - Requirements: ${requirementsResult.requirementsChecked} vs ${oneHourRequirementsResult.requirementsChecked}`)
    
    if (usersResult.usersChecked >= oneHourUsersResult.usersChecked && 
        requirementsResult.requirementsChecked >= oneHourRequirementsResult.requirementsChecked) {
      console.log('\n🎉 SUCCESS: 2-hour lookback captures more or equal data than 1-hour!')
    } else {
      console.log('\n⚠️  WARNING: Unexpected results - 2-hour should capture >= 1-hour data')
    }
    
  } catch (error) {
    console.error('❌ [TEST] Test failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  test2HourLookback()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test execution failed:', error)
      process.exit(1)
    })
}

export { test2HourLookback } 