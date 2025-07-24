import { NextRequest, NextResponse } from 'next/server'
import { NullQueueBackfillMigrationService } from '@/modules/discovery/services/null-queue-backfill-migration.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large migration

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🔄 [MIGRATION] NULL Queue Backfill Migration STARTED')
    console.log('   🎯 Applying requirements discovery logic to all NULL queue users')
    console.log('   📊 Expected: ~10,000 users to analyze')
    
    const migrationService = new NullQueueBackfillMigrationService()
    
    // Run automatic migration with default settings
    const result = await migrationService.runNullQueueBackfill({
      dryRun: false,
      batchSize: 500,
      maxUsers: 15000
    })
    
    console.log('✅ [MIGRATION] NULL Queue Backfill Migration COMPLETED')
    console.log(`   ⏱️  Duration: ${(Date.now() - startTime) / 1000}s`)
    console.log(`   📊 Result: ${result.summary}`)
    
    return NextResponse.json({
      success: result.success,
      summary: result.summary,
      duration: result.duration,
      metrics: {
        totalNullUsers: result.totalNullUsers,
        signedUsers: result.signedUsers,
        unsignedUsers: result.unsignedUsers,
        usersWithRequirements: result.usersWithRequirements,
        usersWithoutRequirements: result.usersWithoutRequirements,
        usersUpdatedToOutstandingRequests: result.usersUpdatedToOutstandingRequests,
        usersSkippedUnsigned: result.usersSkippedUnsigned,
        usersSkippedNoRequirements: result.usersSkippedNoRequirements,
        batchesProcessed: result.batchesProcessed
      },
      progress: result.progress,
      errors: result.errors,
      nextRun: new Date(Date.now() + (60 * 60 * 1000)) // Not recurring
    }, { 
      status: result.success ? 200 : 500 
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.error('❌ [MIGRATION] NULL Queue Backfill Migration FAILED')
    console.error(`   ⏱️  Duration: ${duration / 1000}s`)
    console.error(`   💥 Error: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      summary: `❌ NULL Queue Backfill Migration failed: ${errorMessage}`,
      duration,
      errors: [errorMessage],
      nextRun: null
    }, { 
      status: 500 
    })
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { 
      dryRun = false, 
      batchSize = 500, 
      maxUsers = 15000,
      offset = 0 
    } = body
    
    console.log('🔄 [MIGRATION] NULL Queue Backfill Migration STARTED (Custom Settings)')
    console.log(`   🎯 Settings: dryRun=${dryRun}, batchSize=${batchSize}, maxUsers=${maxUsers}, offset=${offset}`)
    
    const migrationService = new NullQueueBackfillMigrationService()
    
    // Run migration with custom settings
    const result = await migrationService.runNullQueueBackfill({
      dryRun,
      batchSize,
      maxUsers,
      offset
    })
    
    console.log('✅ [MIGRATION] NULL Queue Backfill Migration COMPLETED')
    console.log(`   ⏱️  Duration: ${(Date.now() - startTime) / 1000}s`)
    console.log(`   📊 Result: ${result.summary}`)
    
    return NextResponse.json({
      success: result.success,
      summary: result.summary,
      duration: result.duration,
      settings: { dryRun, batchSize, maxUsers, offset },
      metrics: {
        totalNullUsers: result.totalNullUsers,
        signedUsers: result.signedUsers,
        unsignedUsers: result.unsignedUsers,
        usersWithRequirements: result.usersWithRequirements,
        usersWithoutRequirements: result.usersWithoutRequirements,
        usersUpdatedToOutstandingRequests: result.usersUpdatedToOutstandingRequests,
        usersSkippedUnsigned: result.usersSkippedUnsigned,
        usersSkippedNoRequirements: result.usersSkippedNoRequirements,
        batchesProcessed: result.batchesProcessed
      },
      progress: result.progress,
      errors: result.errors,
      nextRun: null // One-time migration
    }, { 
      status: result.success ? 200 : 500 
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.error('❌ [MIGRATION] NULL Queue Backfill Migration FAILED')
    console.error(`   ⏱️  Duration: ${duration / 1000}s`)
    console.error(`   💥 Error: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      summary: `❌ NULL Queue Backfill Migration failed: ${errorMessage}`,
      duration,
      errors: [errorMessage],
      nextRun: null
    }, { 
      status: 500 
    })
  }
} 