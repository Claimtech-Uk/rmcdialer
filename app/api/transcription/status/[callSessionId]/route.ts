import { NextRequest, NextResponse } from 'next/server'
import { transcriptionService } from '@/modules/transcription'
import type { TranscriptionStatusResponse } from '@/modules/transcription'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { callSessionId: string } }
) {
  try {
    const { callSessionId } = params
    
    console.log(`🔍 [API] Checking transcription status for call ${callSessionId}`)

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(callSessionId)) {
      return NextResponse.json({
        error: 'Invalid call session ID format'
      }, { status: 400 })
    }

    // Get transcription status from service
    const transcriptionResult = await transcriptionService.getTranscriptionStatus(callSessionId)
    
    if (!transcriptionResult) {
      console.log(`📭 [API] No transcription found for call ${callSessionId}`)
      return NextResponse.json({
        callSessionId,
        status: null,
        message: 'No transcription found for this call'
      } as TranscriptionStatusResponse)
    }

    // Calculate progress based on status
    let progress: number | undefined
    if (transcriptionResult.status === 'pending') {
      progress = 10
    } else if (transcriptionResult.status === 'processing') {
      // Estimate progress based on time elapsed
      // This is a rough estimate - real progress would require more complex tracking
      progress = 50
    } else if (transcriptionResult.status === 'completed') {
      progress = 100
    } else if (transcriptionResult.status === 'failed') {
      progress = 0
    }

    const response: TranscriptionStatusResponse = {
      callSessionId,
      status: transcriptionResult.status,
      transcriptText: transcriptionResult.transcriptText,
      transcriptSummary: transcriptionResult.transcriptSummary,
      transcriptUrl: transcriptionResult.transcriptUrl,
      progress,
      failureReason: transcriptionResult.failureReason,
      completedAt: transcriptionResult.completedAt,
      wordCount: transcriptionResult.wordCount,
      confidence: transcriptionResult.confidence,
      language: transcriptionResult.language
    }

    console.log(`✅ [API] Status retrieved for call ${callSessionId}: ${transcriptionResult.status}`)
    return NextResponse.json(response)

  } catch (error: any) {
    console.error(`❌ [API] Status check error for call ${params.callSessionId}:`, error)
    
    return NextResponse.json({
      callSessionId: params.callSessionId,
      status: null,
      error: 'Failed to check transcription status',
      message: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

// Handle CORS preflight for client-side requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
