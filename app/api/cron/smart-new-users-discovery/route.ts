import { NextRequest, NextResponse } from 'next/server'
import { NewUsersDiscoveryService } from '@/modules/discovery'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('🆕 [CRON] Smart New Users Discovery started...')
  
  try {
    const discoveryService = new NewUsersDiscoveryService()
    
    // Discover new users from the last hour
    const result = await discoveryService.discoverNewUsers({ hoursBack: 1 })
    
    const duration = Date.now() - startTime
    
    return NextResponse.json({
      success: result.success,
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
    
    console.error('❌ [CRON] Smart New Users Discovery failed:', error)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
} 