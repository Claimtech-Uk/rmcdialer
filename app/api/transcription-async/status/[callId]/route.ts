import { NextRequest, NextResponse } from 'next/server'
import { transcriptionQueue } from '@/modules/transcription-async/server/services/transcription-queue.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 5 // Quick status checks

/**
 * Get Transcription Status API
 * 
 * Lightweight endpoint for polling transcription status.
 * No heavy operations, just Redis lookups.
 * 
 * DESIGN PRINCIPLES:
 * - Ultra-fast response (< 100ms)
 * - No database queries unless necessary
 * - Safe parameter parsing
 * - Consistent response format
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const { callId } = params

    // Validate callId
    if (!callId || typeof callId !== 'string' || callId.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Valid callId is required' 
        },
        { status: 400 }
      )
    }

    // Get status from Redis (fast lookup)
    const status = await transcriptionQueue.getCallStatus(callId)
    
    if (!status) {
      return NextResponse.json({
        success: true,
        status: 'idle',
        message: 'No transcription found for this call'
      })
    }

    return NextResponse.json({
      success: true,
      ...status
    })
    
  } catch (error) {
    console.error('❌ [TRANSCRIPTION-STATUS] Status check error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check transcription status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
