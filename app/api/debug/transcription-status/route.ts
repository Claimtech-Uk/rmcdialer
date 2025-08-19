import { NextRequest, NextResponse } from 'next/server'
import { transcriptionQueue } from '@/modules/transcription-async/server/services/transcription-queue.service'
import { cacheService } from '@/lib/redis'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check transcription queue status
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Checking transcription queue status...')
    
    // Get queue stats
    const stats = await transcriptionQueue.getQueueStats()
    
    // Get recent queue data
    const queueData = await cacheService.get('transcription:queue') || []
    
    // Get recent status entries
    const statusKeys = []
    try {
      // Try to get some status keys (limited by cache service capabilities)
      for (let i = 0; i < 10; i++) {
        const testKey = `transcription:status:test-${i}`
        if (await cacheService.exists(testKey)) {
          statusKeys.push(testKey)
        }
      }
    } catch (error) {
      console.log('Could not scan for status keys:', error)
    }
    
    // Check cache service health
    const cacheStats = await cacheService.getStats()
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      queueStats: stats,
      queueData: queueData,
      queueLength: Array.isArray(queueData) ? queueData.length : 0,
      statusKeysFound: statusKeys.length,
      cacheStats: cacheStats,
      
      // Test basic cache operations
      cacheTest: {
        canWrite: false,
        canRead: false,
        error: null
      }
    }
    
    // Test cache operations
    try {
      await cacheService.set('transcription:debug:test', { test: true }, 60)
      debugInfo.cacheTest.canWrite = true
      
      const testRead = await cacheService.get('transcription:debug:test')
      debugInfo.cacheTest.canRead = !!testRead
      
      await cacheService.del('transcription:debug:test')
    } catch (cacheError) {
      debugInfo.cacheTest.error = cacheError instanceof Error ? cacheError.message : 'Unknown cache error'
    }
    
    console.log('🔍 [DEBUG] Transcription debug info:', debugInfo)
    
    return NextResponse.json(debugInfo)
    
  } catch (error) {
    console.error('❌ [DEBUG] Transcription debug failed:', error)
    
    return NextResponse.json({
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Manual trigger for transcription processing (bypass cron)
 */
export async function POST(request: NextRequest) {
  try {
    const { callId } = await request.json().catch(() => ({}))
    
    if (callId) {
      // Add specific job to queue
      const jobId = await transcriptionQueue.addJob(callId)
      
      return NextResponse.json({
        success: true,
        message: `Manually queued transcription for call ${callId}`,
        jobId,
        timestamp: new Date().toISOString()
      })
    } else {
      // Trigger processing of existing queue
      const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cron/process-transcriptions`)
      const result = await response.json()
      
      return NextResponse.json({
        success: true,
        message: 'Manually triggered transcription processing',
        cronResult: result,
        timestamp: new Date().toISOString()
      })
    }
    
  } catch (error) {
    return NextResponse.json({
      error: 'Manual trigger failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
