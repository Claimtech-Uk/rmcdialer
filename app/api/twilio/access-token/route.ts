import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// Twilio Access Token generation for Voice SDK
export async function POST(request: NextRequest) {
  try {
    console.log('🔑 Generating Twilio access token...');

    // Get agent info from request (should come from authenticated session)
    const { agentId, agentEmail } = await request.json();

    // Validate required environment variables
    const requiredEnvVars = {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY: process.env.TWILIO_API_KEY,
      TWILIO_API_SECRET: process.env.TWILIO_API_SECRET,
      TWILIO_TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value || value.startsWith('your-'))
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.warn('⚠️ Missing Twilio credentials, generating mock token for development');
      
      // Return mock token for development
      return NextResponse.json({
        success: true,
        accessToken: generateMockToken(agentId, agentEmail),
        development: true,
        message: 'Mock access token generated for development',
        missingCredentials: missingVars
      });
    }

    // Generate real Twilio access token
    const accessToken = generateTwilioAccessToken(
      agentId,
      agentEmail,
      requiredEnvVars.TWILIO_ACCOUNT_SID!,
      requiredEnvVars.TWILIO_API_KEY!,
      requiredEnvVars.TWILIO_API_SECRET!,
      requiredEnvVars.TWILIO_TWIML_APP_SID!
    );

    console.log(`✅ Access token generated for agent ${agentId}`);

    return NextResponse.json({
      success: true,
      accessToken,
      development: false,
      agentId,
      expiresIn: 3600, // 1 hour
      timestamp: new Date()
    });

  } catch (error: any) {
    console.error('❌ Failed to generate access token:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate access token',
      details: error.message,
      timestamp: new Date()
    }, { status: 500 });
  }
}

// Generate real Twilio access token
function generateTwilioAccessToken(
  agentId: string | number,
  agentEmail: string,
  accountSid: string,
  apiKey: string,
  apiSecret: string,
  twimlAppSid: string
): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // Token expires in 1 hour

  // Create identity for this agent (used by Twilio to identify the caller)
  const identity = `agent_${agentId}`;

  // Twilio Voice Grant for outbound calling
  const voiceGrant = {
    outgoing_application_sid: twimlAppSid,
    incoming_allow: false // We don't want agents to receive calls directly
  };

  // JWT payload for Twilio access token
  const payload = {
    iss: apiKey,
    sub: accountSid,
    nbf: now,
    exp: exp,
    iat: now,
    grants: {
      identity: identity,
      voice: voiceGrant
    }
  };

  // Generate JWT token
  const token = jwt.sign(payload, apiSecret, { algorithm: 'HS256' });
  
  console.log(`🔑 Generated token for ${identity} (${agentEmail})`);
  
  return token;
}

// Generate mock token for development (when Twilio credentials aren't available)
function generateMockToken(agentId: string | number, agentEmail: string): string {
  const payload = {
    iss: 'MOCK_API_KEY',
    sub: 'MOCK_ACCOUNT_SID',
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    grants: {
      identity: `agent_${agentId}`,
      voice: {
        outgoing_application_sid: 'MOCK_TWIML_APP_SID',
        incoming_allow: false
      }
    },
    // Mock development flags
    development: true,
    agentId,
    agentEmail
  };

  // Use a mock secret for development
  return jwt.sign(payload, 'mock-development-secret', { algorithm: 'HS256' });
}

// Handle GET requests (for testing)
export async function GET() {
  const envStatus = {
    TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.startsWith('your-'),
    TWILIO_API_KEY: !!process.env.TWILIO_API_KEY && !process.env.TWILIO_API_KEY.startsWith('your-'),
    TWILIO_API_SECRET: !!process.env.TWILIO_API_SECRET && !process.env.TWILIO_API_SECRET.startsWith('your-'),
    TWILIO_TWIML_APP_SID: !!process.env.TWILIO_TWIML_APP_SID && !process.env.TWILIO_TWIML_APP_SID.startsWith('your-')
  };

  const allConfigured = Object.values(envStatus).every(Boolean);

  return NextResponse.json({
    success: true,
    message: 'Twilio Access Token API ready',
    endpoint: 'POST /api/twilio/access-token',
    environment: {
      status: allConfigured ? 'Production Ready' : 'Development Mode',
      configured: envStatus,
      development: !allConfigured
    },
    usage: {
      method: 'POST',
      body: {
        agentId: 'string|number',
        agentEmail: 'string'
      }
    },
    timestamp: new Date()
  });
} 