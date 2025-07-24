import { NextRequest, NextResponse } from 'next/server'
import { NewUsersDiscoveryService } from '@/modules/discovery'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('🧪 [TEST] New Users Discovery test endpoint called...')
  
  try {
    const discoveryService = new NewUsersDiscoveryService()
    
    // Test with last 1 hour (same as production cron)
    const result = await discoveryService.discoverNewUsers({ hoursBack: 1 })
    
    const duration = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      duration,
      timestamp: result.timestamp,
      summary: result.summary,
      details: {
        usersChecked: result.usersChecked,
        newUsersFound: result.newUsersFound,
        newUsersCreated: result.newUsersCreated,
        skippedExisting: result.skippedExisting,
        unsigned: result.unsigned,
        signed: result.signed
      },
      errors: result.errors
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error('❌ [TEST] New Users Discovery test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 