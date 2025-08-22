import { NextRequest, NextResponse } from 'next/server'
import { FEATURE_FLAGS } from '@/lib/config/features'

export const dynamic = 'force-dynamic'

/**
 * AI Voice Token Endpoint
 * 
 * Provides ephemeral OpenAI API tokens for the WebSocket service
 * Dev/Preview only - blocked in production via feature flag
 */
export async function GET(request: NextRequest) {
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
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        mode: 'development-config-missing' 
      }, { status: 500 })
    }

    // Return config for WS service
    const config = {
      success: true,
      environment: environmentName,
      config: {
        model: process.env.AI_VOICE_MODEL || 'gpt-4o-realtime-preview',
        voice: process.env.AI_VOICE_NAME || 'alloy',
        maxConcurrentStreams: parseInt(process.env.VOICE_MAX_CONCURRENT_STREAMS || '2', 10)
      },
      wsEndpoint: process.env.WS_VOICE_URL || 'wss://ws.dev.solvosolutions.co.uk/twilio/media',
      timestamp: new Date().toISOString()
    }

    console.log('🎙️ [AI-VOICE] Token config provided for development')
    
    return NextResponse.json(config)

  } catch (error) {
    console.error('❌ [AI-VOICE] Token endpoint error:', error)
    
    return NextResponse.json({
      error: 'Failed to generate voice config',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Feature flag check
  if (!FEATURE_FLAGS.ENABLE_AI_VOICE_AGENT) {
    return NextResponse.json({ 
      error: 'AI Voice agent disabled',
      mode: 'production-safety' 
    }, { status: 403 })
  }

  try {
    const { agentId, callSid } = await request.json()
    
    if (!agentId || !callSid) {
      return NextResponse.json({ 
        error: 'Missing required fields: agentId, callSid' 
      }, { status: 400 })
    }

    // Generate session-specific config
    const sessionConfig = {
      success: true,
      sessionId: `voice_${callSid}_${Date.now()}`,
      agentId,
      callSid,
      config: {
        model: process.env.AI_VOICE_MODEL || 'gpt-4o-realtime-preview',
        voice: process.env.AI_VOICE_NAME || 'alloy',
        instructions: "You are a helpful AI assistant for Resolve My Claim. Keep responses concise and professional."
      },
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      timestamp: new Date().toISOString()
    }

    console.log(`🎙️ [AI-VOICE] Session config created for agent ${agentId}, call ${callSid}`)
    
    return NextResponse.json(sessionConfig)

  } catch (error) {
    console.error('❌ [AI-VOICE] Session config error:', error)
    
    return NextResponse.json({
      error: 'Failed to create session config',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
