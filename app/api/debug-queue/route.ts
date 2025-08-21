import { NextRequest, NextResponse } from 'next/server'
import { databaseSmsHandler } from '@/modules/ai-agents/channels/sms/database-sms-handler'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Database SMS Processing (replaces queue system)...')
    
    const results = {
      processingSystemExists: !!databaseSmsHandler,
      tests: {},
      timing: {}
    }
    
    const startTime = Date.now()
    
    // Test processing stats
    try {
      const stats = await databaseSmsHandler.getProcessingStats()
      results.tests.processingStats = { success: true, stats }
    } catch (error) {
      results.tests.processingStats = `failed: ${error.message}`
      return NextResponse.json({ success: false, results }, { status: 500 })
    }
    
    // Test clean stuck processing
    try {
      const cleaned = await databaseSmsHandler.cleanStuckProcessing(1) // Clean messages older than 1 minute
      results.tests.cleanStuckProcessing = { success: true, cleaned }
    } catch (error) {
      results.tests.cleanStuckProcessing = `failed: ${error.message}`
    }
    
    const endTime = Date.now()
    results.timing.totalMs = endTime - startTime
    
    return NextResponse.json({ 
      success: true,
      message: 'Database SMS processing test completed (queue system removed)',
      note: 'This endpoint now tests the database-first SMS processing system',
      totalTimeMs: endTime - startTime,
      results 
    })
    
  } catch (error) {
    console.error('SMS processing debug failed:', error)
    return NextResponse.json({ 
      error: 'SMS processing debug failed', 
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
