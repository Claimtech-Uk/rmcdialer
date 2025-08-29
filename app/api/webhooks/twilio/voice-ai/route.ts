import { NextRequest, NextResponse } from 'next/server'
import { getTwilioClient } from '@/modules/twilio-voice/services/twilio-client'
import { performEnhancedCallerLookup } from '@/modules/twilio-voice/services/caller-lookup.service'

// CRITICAL: This endpoint is for AI voice ONLY
// Protected by middleware when ENABLE_AI_VOICE_AGENT=false

export async function POST(request: NextRequest) {
  const environmentName = process.env.ENVIRONMENT_NAME || ''
  const isDevelopment = environmentName.endsWith('-development')
  
  try {
    console.log('🎙️ [AI-VOICE] Webhook received')
    console.log(`🎙️ [AI-VOICE] Environment: ${environmentName}`)
    console.log(`🎙️ [AI-VOICE] Is Development: ${isDevelopment}`)
    console.log(`🎙️ [AI-VOICE] Feature Flag: ${process.env.ENABLE_AI_VOICE_AGENT}`)
    
    // Parse Twilio webhook data
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string || 'unknown'
    const to = formData.get('To') as string || 'unknown'
    const direction = formData.get('Direction') as string || 'unknown'
    
    console.log(`🎙️ [AI-VOICE] Call Details:`, {
      callSid,
      from,
      to,
      direction
    })

    // Look up caller information for personalized experience
    console.log(`🔍 [AI-VOICE] Looking up caller information for: ${from}`)
    let callerInfo = null
    try {
      callerInfo = await performEnhancedCallerLookup(from)
      if (callerInfo && callerInfo.user) {
        console.log(`✅ [AI-VOICE] Found caller:`, {
          name: `${callerInfo.user.first_name} ${callerInfo.user.last_name}`,
          id: callerInfo.user.id,
          status: callerInfo.user.status,
          claimsCount: callerInfo.claims?.length || 0
        })
      } else {
        console.log(`❓ [AI-VOICE] No caller found for: ${from}`)
      }
    } catch (error) {
      console.error(`❌ [AI-VOICE] Error looking up caller:`, error)
      // Continue without caller info - don't fail the call
    }
    
    // Double-check feature flag (middleware should have blocked already)
    if (process.env.ENABLE_AI_VOICE_AGENT !== 'true') {
      console.error('❌ [AI-VOICE] Feature disabled but webhook was called')
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="rejected"/></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }
    
    // Development environment check
    if (!isDevelopment) {
      console.error('❌ [AI-VOICE] Not in development environment')
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This service is only available in development.</Say><Hangup/></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }
    
    // Get the voice stream token from environment
    const streamToken = process.env.VOICE_STREAM_TOKEN || 'set-a-random-dev-token'
    
    // Generate TwiML response to connect to our WebSocket service
    // Using <Connect><Stream> for BIDIRECTIONAL audio (both send and receive)
    // The WebSocket service will handle the actual Hume EVI connection
    console.log(`🎙️ [AI-VOICE] Generating TwiML for bidirectional WebSocket bridge`)
    
    // Log which service we're using
    const useOpenAI = process.env.USE_OPENAI_VOICE === 'true'
    console.log(`🎙️ [AI-VOICE] Voice Service: ${useOpenAI ? 'OpenAI Realtime' : 'Hume EVI'}`)
    
    if (useOpenAI) {
      console.log('⚠️ [AI-VOICE] OpenAI Realtime API integration not yet implemented')
    }
    
    // Use PartyKit WebSocket bridge for Hume EVI voice service
    // This allows full tool/function support
    const partyKitUrl = process.env.PARTYKIT_URL || 'rmc-voice-bridge.jamesclaimtechio.partykit.dev'
    const wsUrl = process.env.WS_VOICE_URL || `wss://${partyKitUrl}/parties/voice/${callSid}`
    
    console.log(`🎙️ [AI-VOICE] Using PartyKit WebSocket Bridge`)
    console.log(`🎙️ [AI-VOICE] WebSocket URL: ${wsUrl}`)
    console.log(`🎙️ [AI-VOICE] Environment: ${environmentName}`)
    console.log(`🎙️ [AI-VOICE] Stream Token: ${streamToken ? 'SET' : 'NOT SET'} (${streamToken?.substring(0, 10)}...)`)
    
    // Prepare caller context for AI agent
    const callerContext = (callerInfo && callerInfo.user) ? {
      found: true,
      id: callerInfo.user.id,
      firstName: callerInfo.user.first_name,
      lastName: callerInfo.user.last_name,
      fullName: `${callerInfo.user.first_name || ''} ${callerInfo.user.last_name || ''}`.trim(),
      status: callerInfo.user.status,
      phone: from,
      email: callerInfo.user.email_address,
      claims: callerInfo.claims?.map(claim => ({
        id: claim.id,
        lender: claim.lender,
        status: claim.status,
        estimatedValue: claim.estimatedValue
      })) || [],
      claimsCount: callerInfo.claims?.length || 0,
      priorityScore: callerInfo.priorityScore || 0
    } : {
      found: false,
      phone: from,
      firstName: null,
      lastName: null,
      fullName: null
    }

    // Encode caller context as base64 to safely pass through TwiML
    const callerContextEncoded = Buffer.from(JSON.stringify(callerContext)).toString('base64')

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="env" value="${environmentName}"/>
      <Parameter name="auth" value="${streamToken}"/>
      <Parameter name="callSid" value="${callSid}"/>
      <Parameter name="from" value="${from}"/>
      <Parameter name="callerContext" value="${callerContextEncoded}"/>
    </Stream>
  </Connect>
</Response>`

    console.log(`🎙️ [AI-VOICE] Generated bidirectional TwiML for call ${callSid}`)
    console.log(`📄 [AI-VOICE] TwiML Response (using <Connect> for bidirectional audio):`)
    console.log(twiml)
    console.log(`🔗 [AI-VOICE] Stream Parameters:`, {
      url: wsUrl,
      env: environmentName,
      auth: streamToken?.substring(0, 10) + '...',
      callSid,
      from,
      callerFound: (callerInfo && callerInfo.user) ? `${callerInfo.user.first_name} ${callerInfo.user.last_name}` : 'Unknown',
      claimsCount: callerInfo?.claims?.length || 0
    })
    
    if (callerInfo && callerInfo.user) {
      console.log(`👤 [AI-VOICE] Caller Context:`, {
        name: `${callerInfo.user.first_name} ${callerInfo.user.last_name}`,
        status: callerInfo.user.status,
        claimsCount: callerInfo.claims?.length || 0,
        priorityScore: callerInfo.priorityScore || 0,
        hasEmail: !!callerInfo.user.email_address
      })
    }
    
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
  const environmentName = process.env.ENVIRONMENT_NAME || ''
  const isDevelopment = environmentName.endsWith('-development')
  
  // Return status information
  const status = {
    service: 'ai-voice-webhook',
    environment: environmentName,
    isDevelopment,
    featureEnabled: process.env.ENABLE_AI_VOICE_AGENT === 'true',
    voiceService: process.env.USE_OPENAI_VOICE === 'true' ? 'OpenAI' : 'Hume EVI',
    partyKitUrl: process.env.PARTYKIT_URL || 'rmc-voice-bridge.jamesclaimtechio.partykit.dev',
    info: isDevelopment 
      ? 'AI Voice service is available' 
      : 'AI Voice is disabled in production'
  }
  
  return NextResponse.json(status)
}

// Handle fallback for voice status updates
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    console.log('📊 [AI-VOICE] Status update received:', data)
    
    // Log status events
    if (data.CallStatus) {
      console.log(`📊 [AI-VOICE] Call ${data.CallSid} status: ${data.CallStatus}`)
    }
    
    // Return empty response (Twilio doesn't expect content)
    return new NextResponse('', { status: 204 })
  } catch (error) {
    console.error('❌ [AI-VOICE] Status update error:', error)
    return new NextResponse('', { status: 204 })
  }
}