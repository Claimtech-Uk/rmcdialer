import { NextRequest, NextResponse } from 'next/server'
import { SmartDiscoveryService } from '@/modules/queue/services/smart-discovery.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('🧪 [TEST] Smart Discovery test endpoint called...')
  
  try {
    const smartDiscoveryService = new SmartDiscoveryService()
    
    // Test with last 1 hour (same as production cron)
    const result = await smartDiscoveryService.discoverNewUsers(1)
    
    const duration = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      duration,
      discoveryResult: result,
      summary: `Smart Discovery Test: ${result.newUsersCreated} new users processed from last hour`,
      testMode: true
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ [TEST] Smart Discovery test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      testMode: true
    }, { status: 500 })
  }
} 