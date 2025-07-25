#!/usr/bin/env tsx

/**
 * Test Script for Outstanding Requirements Conversion Cleanup Service
 * 
 * This script allows testing the new service in dry-run mode to verify logic
 */

import { OutstandingRequirementsConversionCleanupService } from '../modules/discovery/services/outstanding-requirements-conversion-cleanup.service'

async function testOutstandingRequirementsCleanup() {
  console.log('🧪 [TEST] Starting Outstanding Requirements Conversion Cleanup Service Test')
  console.log('=' .repeat(80))
  
  try {
    const service = new OutstandingRequirementsConversionCleanupService()
    
    // Test in dry-run mode first
    console.log('🔍 Running in DRY RUN mode...')
    const dryRunResult = await service.cleanupOutstandingRequirementsConversions({
      dryRun: true,
      batchSize: 50 // Smaller batch for testing
    })
    
    console.log('\n📊 DRY RUN RESULTS:')
    console.log(`   Duration: ${dryRunResult.duration}ms`)
    console.log(`   Success: ${dryRunResult.success}`)
    console.log(`   Total Outstanding Users: ${dryRunResult.totalOutstandingUsers}`)
    console.log(`   Users Checked: ${dryRunResult.usersChecked}`)
    console.log(`   Conversions Found: ${dryRunResult.conversionsFound}`)
    console.log(`   Would Update: ${dryRunResult.usersUpdated}`)
    console.log(`   Batches Processed: ${dryRunResult.batchesProcessed}`)
    console.log(`   Strategy: ${dryRunResult.processingStrategy}`)
    console.log(`   Completed: ${dryRunResult.completed}`)
    console.log(`   Summary: ${dryRunResult.summary}`)
    
    if (dryRunResult.errors.length > 0) {
      console.log('\n❌ ERRORS:')
      dryRunResult.errors.forEach(error => console.log(`   - ${error}`))
    }
    
    if (dryRunResult.conversions.length > 0) {
      console.log('\n🔄 SAMPLE CONVERSIONS:')
      dryRunResult.conversions.slice(0, 5).forEach((conversion, index) => {
        console.log(`   ${index + 1}. User ${conversion.userId}: completed at ${conversion.completedAt}`)
      })
      
      if (dryRunResult.conversions.length > 5) {
        console.log(`   ... and ${dryRunResult.conversions.length - 5} more`)
      }
    }
    
    console.log('\n✅ [TEST] Outstanding Requirements Cleanup test completed successfully!')
    
    // Uncomment to run actual cleanup (not dry run)
    // console.log('\n🚀 Running ACTUAL cleanup...')
    // const realResult = await service.cleanupOutstandingRequirementsConversions({
    //   dryRun: false,
    //   batchSize: 50
    // })
    // console.log(`Real run result: ${realResult.summary}`)
    
  } catch (error) {
    console.error('❌ [TEST] Test failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  testOutstandingRequirementsCleanup()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test execution failed:', error)
      process.exit(1)
    })
}

export { testOutstandingRequirementsCleanup } 