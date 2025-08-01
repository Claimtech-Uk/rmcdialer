#!/usr/bin/env tsx

/**
 * Cleanup Script: Remove Invalid Conversions
 * 
 * This script removes conversions that should not have been counted as conversions:
 * - opted_out (users who opted out)
 * - no_longer_eligible (users with no valid claim)
 * 
 * These are disqualifications, not conversions.
 */

import { prisma } from '../lib/db'

async function main() {
  console.log('🧹 Starting cleanup of invalid conversions...')
  
  try {
    // Find all invalid conversion types
    const invalidConversions = await prisma.conversion.findMany({
      where: {
        conversionType: {
          in: ['opted_out', 'no_longer_eligible']
        }
      },
      select: {
        id: true,
        conversionType: true,
        convertedAt: true,
        userId: true
      }
    })
    
    console.log(`📊 Found ${invalidConversions.length} invalid conversions:`)
    
    // Group by type for reporting
    const typeCount = invalidConversions.reduce((acc, conv) => {
      acc[conv.conversionType] = (acc[conv.conversionType] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} records`)
    })
    
    if (invalidConversions.length === 0) {
      console.log('✅ No invalid conversions found. Database is clean!')
      return
    }
    
    // Ask for confirmation
    console.log('\n⚠️  These conversions will be DELETED as they represent disqualifications, not conversions.')
    console.log('💡 Users will remain in the system with their opt-out/ineligible status preserved.')
    
    // In a real environment, you'd want user confirmation here
    // For now, we'll proceed with a dry run
    console.log('\n🧪 DRY RUN: Would delete the following conversions:')
    
    invalidConversions.forEach(conv => {
      console.log(`   - ${conv.id}: ${conv.conversionType} (User ${conv.userId}) on ${conv.convertedAt.toISOString().split('T')[0]}`)
    })
    
    // Uncomment the following lines to actually perform the deletion:
    /*
    const deleteResult = await prisma.conversion.deleteMany({
      where: {
        conversionType: {
          in: ['opted_out', 'no_longer_eligible']
        }
      }
    })
    
    console.log(`✅ Successfully deleted ${deleteResult.count} invalid conversions`)
    */
    
    console.log('\n📝 To actually perform the cleanup:')
    console.log('   1. Uncomment the deletion code in this script')
    console.log('   2. Run the script again')
    console.log('   3. Verify analytics reflect accurate conversion numbers')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 