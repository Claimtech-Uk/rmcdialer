import { NextRequest, NextResponse } from 'next/server'
import { transcriptionQueue } from '@/modules/transcription-async/server/services/transcription-queue.service'
import { transcriptionProcessor } from '@/modules/transcription-async/server/services/transcription-processor.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for cron jobs

/**
 * Background Transcription Processing Cron Job
 * 
 * Processes queued transcription jobs in the background.
 * Runs every 30 seconds to ensure responsive processing.
 * 
 * DESIGN:
 * - Non-blocking: Returns immediately after starting job
 * - Fault-tolerant: Individual job failures don't stop processing
 * - Scalable: Processes one job at a time to prevent resource exhaustion
 * - Observable: Comprehensive logging for monitoring
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🎙️ [CRON] Transcription processing starting...')
    
    // Get next job from queue (non-blocking)
    const job = await transcriptionQueue.getNextJob()
    
    if (!job) {
      const duration = Date.now() - startTime
      console.log(`😴 [CRON] No transcription jobs in queue (${duration}ms)`)
      
      return NextResponse.json({
        success: true,
        message: 'No jobs to process',
        processed: 0,
        duration,
        timestamp: new Date().toISOString()
      })
    }

    console.log(`🎬 [CRON] Processing transcription job for call ${job.callId}`)
    
    // Process the job (this handles all error cases internally)
    await transcriptionProcessor.processJob(job)
    
    const duration = Date.now() - startTime
    
    console.log(`✅ [CRON] Transcription processing completed for call ${job.callId} (${duration}ms)`)
    
    return NextResponse.json({
      success: true,
      message: `Processed transcription for call ${job.callId}`,
      processed: 1,
      callId: job.callId,
      duration,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ [CRON] Transcription processing failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processed: 0,
      duration,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Health check endpoint for monitoring
 */
export async function POST(request: NextRequest) {
  try {
    const stats = await transcriptionQueue.getQueueStats()
    
    return NextResponse.json({
      success: true,
      queueStats: stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
