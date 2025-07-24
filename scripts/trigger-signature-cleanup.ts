#!/usr/bin/env npx tsx
// Manual trigger for signature conversion cleanup
// Run with: npx tsx scripts/trigger-signature-cleanup.ts

// Load environment variables first
import { config } from 'dotenv'
config({ path: '.env.local' })

import { SignatureConversionCleanupService } from '../modules/discovery/services/signature-conversion-cleanup.service'

async function main() {
  console.log('🧹 [MANUAL TRIGGER] Starting signature conversion cleanup...')
  console.log(`🕐 Current time: ${new Date().toISOString()}`)
  console.log(`🔗 Database: ${process.env.REPLICA_DATABASE_URL ? 'Connected' : 'Not configured'}`)
  console.log('')

  try {
    const cleanupService = new SignatureConversionCleanupService()
    const result = await cleanupService.cleanupSignatureConversions({
      dryRun: false // Set to true for testing without making changes
    })

    console.log('🎉 [MANUAL TRIGGER] Signature conversion cleanup completed!')
    console.log('📊 Results:', JSON.stringify(result, null, 2))

    if (result.conversionsFound > 0) {
      console.log('')
      console.log(`✅ Found ${result.conversionsFound} signature conversions`)
      console.log(`💾 Updated ${result.usersUpdated} users`)
      console.log(`📝 Created ${result.conversionsFound} conversion records`)
      console.log('')
      console.log('🔍 Check your database "conversions" table to see the new records!')
    } else {
      console.log('')
      console.log(`ℹ️  No signature conversions found (all unsigned users still unsigned)`)
    }

  } catch (error) {
    console.error('❌ [MANUAL TRIGGER] Failed:', error)
    process.exit(1)
  }
}

main().catch(console.error) 