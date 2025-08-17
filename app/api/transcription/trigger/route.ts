import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { transcriptionService } from '@/modules/transcription'
import type { 
  TranscriptionTriggerRequest, 
  TranscriptionTriggerResponse 
} from '@/modules/transcription'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

// Request validation schema
const TriggerTranscriptionSchema = z.object({
  callSessionId: z.string().uuid('Invalid call session ID'),
  forceRetranscribe: z.boolean().optional().default(false)
})

export async function POST(request: NextRequest) {
  try {
    console.log('🎙️ [API] Transcription trigger request received')

    // Parse and validate request body
    const body = await request.json()
    const validatedData = TriggerTranscriptionSchema.parse(body)
    
    const { callSessionId, forceRetranscribe } = validatedData
    
    console.log(`🎙️ [API] Triggering transcription for call ${callSessionId}, force: ${forceRetranscribe}`)

    // Estimate processing time based on typical call duration
    // This is a rough estimate - actual time depends on audio length and OpenAI API speed
    const estimatedWaitTimeSeconds = 120 // 2 minutes default estimate

    try {
      // Trigger transcription using our service
      await transcriptionService.transcribeCall(callSessionId, forceRetranscribe)
      
      const response: TranscriptionTriggerResponse = {
        success: true,
        callSessionId,
        status: 'processing',
        message: 'Transcription started successfully',
        estimatedWaitTimeSeconds
      }

      console.log(`✅ [API] Transcription triggered successfully for call ${callSessionId}`)
      return NextResponse.json(response)

    } catch (serviceError: any) {
      console.error(`❌ [API] Transcription service error for call ${callSessionId}:`, serviceError)
      
      // Check if it's a validation error (user-friendly)
      if (serviceError.message?.includes('not found') || 
          serviceError.message?.includes('No recording') ||
          serviceError.message?.includes('already')) {
        
        const response: TranscriptionTriggerResponse = {
          success: false,
          callSessionId,
          status: 'failed',
          message: serviceError.message
        }
        
        return NextResponse.json(response, { status: 400 })
      }
      
      // Server error
      const response: TranscriptionTriggerResponse = {
        success: false,
        callSessionId,
        status: 'failed',
        message: 'Transcription service temporarily unavailable'
      }
      
      return NextResponse.json(response, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ [API] Transcription trigger error:', error)
    
    // Validation error
    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }
    
    // Generic server error
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process transcription request'
    }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    service: 'transcription-trigger',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      whisperAPI: !!process.env.OPENAI_API_KEY,
      twilioAuth: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    }
  })
}
