import { NextRequest, NextResponse } from 'next/server'
import { RequirementsToOutstandingMigrationService } from '@/modules/discovery/services/requirements-to-outstanding-migration.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for migration

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🔄 [MIGRATION] Requirements → Outstanding Requests Migration STARTED')
    console.log('   🎯 Converting currentQueueType: "requirements" → "outstanding_requests"')
    
    const migrationService = new RequirementsToOutstandingMigrationService()
    
    // Run the migration
    const result = await migrationService.runRequirementsMigration()
    
    const duration = Date.now() - startTime
    
    console.log('✅ [MIGRATION] Requirements → Outstanding Requests Migration COMPLETED')
    console.log(`   ⏱️  Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`)
    console.log(`   📊 Result: ${result.summary}`)
    
    return NextResponse.json({
      success: result.success,
      duration,
      timestamp: result.timestamp,
      summary: result.summary,
      details: {
        totalUsersChecked: result.totalUsersChecked,
        usersWithRequirementsQueue: result.usersWithRequirementsQueue,
        usersUpdated: result.usersUpdated,
        batchesProcessed: result.batchesProcessed,
        progress: result.progress
      },
      errors: result.errors
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error('❌ [MIGRATION] Requirements → Outstanding Requests Migration FAILED')
    console.error(`   ⏱️  Duration: ${duration}ms`)
    console.error(`   ❗ Error: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Support POST for manual triggering
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { dryRun = false, batchSize = 200, maxUsers } = body
  
  const startTime = Date.now()
  
  try {
    console.log('🔄 [MIGRATION] Requirements → Outstanding Requests Migration STARTED (Manual)')
    console.log(`   🎯 Settings: dryRun=${dryRun}, batchSize=${batchSize}, maxUsers=${maxUsers || 'all'}`)
    
    const migrationService = new RequirementsToOutstandingMigrationService()
    
    // Run the migration with custom options
    const result = await migrationService.runRequirementsMigration({
      dryRun,
      batchSize,
      maxUsers
    })
    
    const duration = Date.now() - startTime
    
    console.log('✅ [MIGRATION] Requirements → Outstanding Requests Migration COMPLETED (Manual)')
    console.log(`   ⏱️  Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`)
    console.log(`   📊 Result: ${result.summary}`)
    
    return NextResponse.json({
      success: result.success,
      duration,
      timestamp: result.timestamp,
      summary: result.summary,
      details: {
        totalUsersChecked: result.totalUsersChecked,
        usersWithRequirementsQueue: result.usersWithRequirementsQueue,
        usersUpdated: result.usersUpdated,
        batchesProcessed: result.batchesProcessed,
        progress: result.progress
      },
      errors: result.errors,
      settings: { dryRun, batchSize, maxUsers }
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error('❌ [MIGRATION] Requirements → Outstanding Requests Migration FAILED (Manual)')
    console.error(`   ⏱️  Duration: ${duration}ms`)
    console.error(`   ❗ Error: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString(),
      settings: { dryRun, batchSize, maxUsers }
    }, { status: 500 })
  }
} 