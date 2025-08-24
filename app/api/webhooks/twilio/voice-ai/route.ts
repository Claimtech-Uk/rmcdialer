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
  const environmentName = process.env.ENVIRONMENT_NAME || ''
  const isDevelopment = environmentName.endsWith('-development')
  const isFeatureEnabled = FEATURE_FLAGS.ENABLE_AI_VOICE_AGENT
  
  // Debug logging
  console.log('🔍 [AI-VOICE-DEBUG] Request received:', {
    ENABLE_AI_VOICE_AGENT: process.env.ENABLE_AI_VOICE_AGENT,
    FEATURE_FLAG_VALUE: isFeatureEnabled,
    ENVIRONMENT_NAME: environmentName,
    isDevelopment,
    NODE_ENV: process.env.NODE_ENV
  })
  
  // Allow in dev environments OR when feature is explicitly enabled
  if (!isDevelopment && !isFeatureEnabled) {
    console.log('🚫 [AI-VOICE] Blocked - not development and feature disabled')
    return NextResponse.json({ 
      error: 'AI Voice agent disabled in production',
      mode: 'production-safety',
      path: request.nextUrl.pathname,
      environment: environmentName,
      debug: {
        envVar: process.env.ENABLE_AI_VOICE_AGENT,
        flagValue: isFeatureEnabled,
        environmentName,
        isDevelopment
      }
    }, { status: 403 })
  }
  
  console.log('✅ [AI-VOICE] Request allowed - proceeding with call handling')

  try {
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const callStatus = formData.get('CallStatus') as string

    console.log('🎙️ [AI-VOICE] Incoming call:', { callSid, from, to, callStatus })

    // Basic Twilio signature validation could go here
    // For now, we'll trust the middleware and environment checks

    // Use Hume's direct Twilio integration endpoint
    // This handles audio conversion and all WebSocket management automatically
    const humeApiKey = process.env.HUME_API_KEY || ''
    const humeConfigId = process.env.HUME_CONFIG_ID || 'd5e403eb-9a95-4821-8b95-e1dd4702f0d5'
    
    // Build Hume's Twilio endpoint URL with authentication
    const humeEndpoint = `https://api.hume.ai/v0/evi/twilio?config_id=${humeConfigId}&api_key=${humeApiKey}`
    
    console.log(`🎙️ [AI-VOICE] Using Hume Direct Twilio Endpoint`)
    console.log(`🎙️ [AI-VOICE] Config ID: ${humeConfigId}`)
    console.log(`🎙️ [AI-VOICE] API Key: ${humeApiKey ? 'SET' : 'NOT SET'} (${humeApiKey?.substring(0, 10)}...)`)
    console.log(`🎙️ [AI-VOICE] Environment: ${environmentName}`)
    
    // Redirect the call to Hume's Twilio endpoint
    // Hume will handle all audio conversion from μ-law automatically
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${humeEndpoint}</Redirect>
</Response>`

    console.log(`🎙️ [AI-VOICE] Generated TwiML redirect for call ${callSid}`)
    console.log(`📄 [AI-VOICE] TwiML Response:`)
    console.log(twiml)
    console.log(`🔗 [AI-VOICE] Hume will handle:`, {
      audioConversion: 'μ-law to supported format',
      emotionalIntelligence: 'Built-in EVI',
      voiceModel: 'Configured in Hume dashboard',
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
  const environmentName = process.env.ENVIRONMENT_NAME || ''
  const isDevelopment = environmentName.endsWith('-development')
  const isFeatureEnabled = FEATURE_FLAGS.ENABLE_AI_VOICE_AGENT
  
  // Debug info in GET request
  const debugInfo = {
    ENABLE_AI_VOICE_AGENT: process.env.ENABLE_AI_VOICE_AGENT,
    FEATURE_FLAG_VALUE: isFeatureEnabled,
    ENVIRONMENT_NAME: environmentName,
    isDevelopment,
    NODE_ENV: process.env.NODE_ENV
  }
  
  // Allow in dev environments OR when feature is explicitly enabled
  if (!isDevelopment && !isFeatureEnabled) {
    return NextResponse.json({ 
      error: 'AI Voice agent disabled in production',
      mode: 'production-safety',
      debug: debugInfo
    }, { status: 403 })
  }

  return NextResponse.json({
    success: true,
    message: 'AI Voice webhook ready (Hume Direct Integration)',
    endpoint: 'POST /api/webhooks/twilio/voice-ai',
    environment: environmentName,
    humeIntegration: {
      mode: 'Direct Twilio Endpoint',
      configId: process.env.HUME_CONFIG_ID || 'd5e403eb-9a95-4821-8b95-e1dd4702f0d5',
      apiKeySet: !!process.env.HUME_API_KEY,
      features: [
        'Automatic μ-law audio conversion',
        'Built-in emotional intelligence',
        'British voice support',
        'Natural interruption handling'
      ]
    },
    timestamp: new Date().toISOString(),
    debug: debugInfo
  })
}
