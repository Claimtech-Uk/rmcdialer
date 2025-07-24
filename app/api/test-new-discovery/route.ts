import { NextRequest, NextResponse } from 'next/server'
import { NewUsersDiscoveryService } from '@/modules/discovery'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('🧪 [TEST] New Discovery System Test')
  
  try {
    const discoveryService = new NewUsersDiscoveryService()
    
    // Test with last 1 hour
    const result = await discoveryService.discoverNewUsers({ hoursBack: 1 })
    
    const duration = Date.now() - startTime
    
    return NextResponse.json({
      success: result.success,
      duration,
      summary: result.summary,
      data: {
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
    
    console.error('❌ [TEST] Discovery test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration
    }, { status: 500 })
  }
} 