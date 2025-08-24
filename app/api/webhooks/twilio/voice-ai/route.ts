import { NextRequest, NextResponse } from 'next/server'
import { FEATURE_FLAGS } from '@/lib/config/features'

export const dynamic = 'force-dynamic'

/**
 * AI Voice Webhook (Dev Only)
 * 
 * Handles Twilio voice calls for AI voice agent development
 * Separate from production voice webhook
 */
export async function POST(request: NextRequest) {
  // Feature flag check (production safety)
  if (!FEATURE_FLAGS.ENABLE_AI_VOICE_AGENT) {
    return NextResponse.json({ 
      error: 'AI Voice agent disabled',
      mode: 'production-safety' 
    }, { status: 403 })
  }

  // Environment check (dev-only)
  const environmentName = process.env.ENVIRONMENT_NAME || ''
  if (!environmentName.endsWith('-development')) {
    return NextResponse.json({ 
      error: 'AI Voice agent only available in development environments',
      environment: environmentName 
    }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const callStatus = formData.get('CallStatus') as string

    console.log('🎙️ [AI-VOICE] Incoming call:', { callSid, from, to, callStatus })

    // Basic Twilio signature validation could go here
    // For now, we'll trust the middleware and environment checks

    // Generate TwiML for AI voice streaming
    const streamToken = process.env.VOICE_STREAM_TOKEN || 'set-a-random-dev-token'
    
    // Use PartyKit WebSocket bridge for Hume EVI voice service
    // Can be overridden with WS_VOICE_URL environment variable
    const partyKitUrl = process.env.PARTYKIT_URL || 'rmc-voice-bridge.jamesclaimtechio.partykit.dev'
    const wsUrl = process.env.WS_VOICE_URL || `wss://${partyKitUrl}/parties/voice/${callSid}`
    
    console.log(`🎙️ [AI-VOICE] Using WebSocket URL: ${wsUrl}`)
    console.log(`🎙️ [AI-VOICE] Environment: ${environmentName}`)
    console.log(`🎙️ [AI-VOICE] Stream Token: ${streamToken ? 'SET' : 'NOT SET'} (${streamToken?.substring(0, 10)}...)`)
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsUrl}">
      <Parameter name="env" value="${environmentName}"/>
      <Parameter name="auth" value="${streamToken}"/>
      <Parameter name="callSid" value="${callSid}"/>
      <Parameter name="from" value="${from}"/>
    </Stream>
  </Start>
  <Say voice="alice">Connecting you to the AI assistant. Please hold while we establish the connection.</Say>
</Response>`

    console.log(`🎙️ [AI-VOICE] Generated TwiML for call ${callSid}`)
    console.log(`📄 [AI-VOICE] TwiML Response:`)
    console.log(twiml)
    console.log(`🔗 [AI-VOICE] Stream Parameters:`, {
      url: wsUrl,
      env: environmentName,
      auth: streamToken?.substring(0, 10) + '...',
      callSid,
      from
    })
    
    return new NextResponse(twiml, {
      headers: {
        'Content-Type': 'text/xml'
      }
    })

  } catch (error) {
    console.error('❌ [AI-VOICE] Webhook error:', error)
    
    // Return safe TwiML fallback
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, the AI assistant is temporarily unavailable. Please try again later.</Say>
  <Hangup/>
</Response>`
    
    return new NextResponse(fallbackTwiml, {
      headers: {
        'Content-Type': 'text/xml'
      }
    })
  }
}

export async function GET() {
  // Feature flag check
  if (!FEATURE_FLAGS.ENABLE_AI_VOICE_AGENT) {
    return NextResponse.json({ 
      error: 'AI Voice agent disabled',
      mode: 'production-safety' 
    }, { status: 403 })
  }

  return NextResponse.json({
    success: true,
    message: 'AI Voice webhook ready',
    endpoint: 'POST /api/webhooks/twilio/voice-ai',
    environment: process.env.ENVIRONMENT_NAME || 'unknown',
    wsEndpoint: process.env.WS_VOICE_URL || `wss://${process.env.PARTYKIT_URL || 'rmc-voice-bridge.jamesclaimtechio.partykit.dev'}/parties/voice/[callSid]`,
    timestamp: new Date().toISOString()
  })
}
