#!/usr/bin/env tsx

/**
 * Test Script for New Cron Schedule
 * 
 * Tests that all cron jobs report correct next run times according to the new schedule:
 * - 00: Signature Cleanup
 * - 05: New Users Discovery  
 * - 10: Outstanding Requirements Cleanup
 * - 15: New Requirements Discovery
 */

async function testCronSchedule() {
  console.log('🕐 [TEST] Testing New Cron Schedule')
  console.log('=' .repeat(80))
  console.log('Expected schedule:')
  console.log('  :00 - Signature Conversion Cleanup')
  console.log('  :05 - Smart New Users Discovery')
  console.log('  :10 - Outstanding Requirements Conversion Cleanup')
  console.log('  :15 - Discover New Requirements')
  console.log()
  
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  
  const cronJobs = [
    { name: 'Signature Cleanup', path: '/api/cron/signature-conversion-cleanup', expectedMinute: 0 },
    { name: 'New Users Discovery', path: '/api/cron/smart-new-users-discovery', expectedMinute: 5 },
    { name: 'Outstanding Cleanup', path: '/api/cron/outstanding-requirements-conversion-cleanup', expectedMinute: 10 },
    { name: 'New Requirements', path: '/api/cron/discover-new-requirements', expectedMinute: 15 }
  ]
  
  console.log('🧪 Testing each cron job for correct next run timing...\n')
  
  for (const job of cronJobs) {
    try {
      console.log(`📋 Testing ${job.name}...`)
      
      const response = await fetch(`${baseUrl}${job.path}`, {
        method: 'POST', // Use POST for manual testing
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) {
        console.log(`   ❌ HTTP Error: ${response.status}`)
        continue
      }
      
      const result = await response.json()
      
      console.log(`   📊 Success: ${result.success}`)
      console.log(`   ⏱️  Duration: ${result.duration}ms`)
      console.log(`   🔄 Next Run: ${result.nextRun}`)
      console.log(`   📝 Summary: ${result.summary || 'N/A'}`)
      
      // Basic validation
      if (result.nextRun) {
        const minutesMatch = result.nextRun.match(/(\d+) minutes/)
        if (minutesMatch) {
          const minutesUntil = parseInt(minutesMatch[1])
          const currentTime = new Date()
          const currentMinute = currentTime.getMinutes()
          
          // Calculate expected minutes until next run
          let expectedMinutesUntil
          if (currentMinute <= job.expectedMinute) {
            expectedMinutesUntil = job.expectedMinute - currentMinute
          } else {
            expectedMinutesUntil = (60 - currentMinute) + job.expectedMinute
          }
          
          const tolerance = 2 // Allow 2 minute tolerance for timing
          if (Math.abs(minutesUntil - expectedMinutesUntil) <= tolerance) {
            console.log(`   ✅ Timing correct (expected ~${expectedMinutesUntil} min, got ${minutesUntil} min)`)
          } else {
            console.log(`   ⚠️  Timing might be off (expected ~${expectedMinutesUntil} min, got ${minutesUntil} min)`)
          }
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    console.log()
  }
  
  console.log('✅ [TEST] Cron schedule test completed!')
  console.log('\n📅 Vercel.json should contain:')
  console.log('  "0 * * * *"  - Signature Cleanup')
  console.log('  "5 * * * *"  - New Users Discovery')
  console.log('  "10 * * * *" - Outstanding Cleanup')
  console.log('  "15 * * * *" - New Requirements')
}

// Run if called directly
if (require.main === module) {
  testCronSchedule()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test execution failed:', error)
      process.exit(1)
    })
}

export { testCronSchedule } 