import { NextRequest, NextResponse } from 'next/server'
import { transcriptionQueue } from '@/modules/transcription-async/server/services/transcription-queue.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 5 // Very quick job queuing

/**
 * Queue Transcription Job API
 * 
 * Lightweight endpoint that just adds jobs to queue and returns immediately.
 * No heavy processing, no OpenAI calls, no long-running operations.
 * 
 * DESIGN PRINCIPLES:
 * - Fast response (< 1 second)
 * - No server dependencies in client bundle
 * - Robust error handling
 * - Safe URL parsing (learned from previous errors)
 */
export async function POST(request: NextRequest) {
  try {
    // Safe request parsing - no URL construction issues
    const body = await request.json().catch(() => ({}))
    const { callId } = body

    // Validate input
    if (!callId || typeof callId !== 'string' || callId.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Valid callId is required' 
        },
        { status: 400 }
      )
    }

    // Check if already processing/completed
    const existingStatus = await transcriptionQueue.getCallStatus(callId)
    if (existingStatus?.status === 'processing') {
      return NextResponse.json({
        success: true,
        message: 'Transcription already in progress',
        status: existingStatus.status
      })
    }

    if (existingStatus?.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Transcription already completed',
        status: existingStatus.status,
        downloadUrl: existingStatus.downloadUrl
      })
    }

    // Add to queue
    const jobId = await transcriptionQueue.addJob(callId)
    
    console.log(`🎙️ [TRANSCRIPTION-API] Queued transcription job ${jobId} for call ${callId}`)
    
    return NextResponse.json({
      success: true,
      message: 'Transcription queued successfully',
      jobId,
      callId,
      status: 'pending'
    })
    
  } catch (error) {
    console.error('❌ [TRANSCRIPTION-API] Queue error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to queue transcription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Get queue statistics (for monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    const stats = await transcriptionQueue.getQueueStats()
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get queue stats' 
      },
      { status: 500 }
    )
  }
}
