// =============================================================================
// ONE-OFF MIGRATION ENDPOINT: Queue Type Backfill
// =============================================================================
// ⚠️  This is a ONE-TIME migration endpoint to fix existing user_call_scores
// ⚠️  Most users currently have currentQueueType: null when they should be 'unsigned_users'
// ⚠️  This endpoint may be deleted after migration is complete

import { NextRequest, NextResponse } from 'next/server'
import { QueueTypeBackfillMigrationService } from '@/modules/discovery/services/queue-type-backfill-migration.service'

export async function GET(request: NextRequest) {
  const migrationService = new QueueTypeBackfillMigrationService()
  const searchParams = request.nextUrl.searchParams
  
  // Parse options from query parameters
  const dryRun = searchParams.get('dryRun') === 'true'
  const batchSize = parseInt(searchParams.get('batchSize') || '300')
  const maxUsersParam = searchParams.get('maxUsers')
  const maxUsers = maxUsersParam ? parseInt(maxUsersParam) : undefined
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    console.log(`🔄 [MIGRATION API] Starting queue type backfill migration`)
    console.log(`   Settings: dryRun=${dryRun}, batchSize=${batchSize}, maxUsers=${maxUsers || 'all'}, offset=${offset}`)

    const result = await migrationService.runBackfillMigration({
      dryRun,
      batchSize,
      maxUsers,
      offset
    })

    return NextResponse.json(result, { 
      status: result.success ? 200 : 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error: any) {
    console.error('❌ [MIGRATION API ERROR]', error)
    
    return NextResponse.json({
      success: false,
      timestamp: new Date(),
      duration: 0,
      errors: [`Migration API failed: ${error.message}`],
      summary: `❌ Migration API Failed: ${error.message}`
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
} 