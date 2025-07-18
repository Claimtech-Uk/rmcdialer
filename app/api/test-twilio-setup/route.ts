import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 Testing complete Twilio infrastructure setup...');

    const testResults: any = {
      success: true,
      tests: {},
      infrastructure: {},
      configuration: {},
      timestamp: new Date()
    };

    // Test 1: Environment Variables Check
    console.log('📋 Test 1: Environment configuration...');
    const envVars = {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
      TWILIO_TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID,
      TWILIO_API_KEY: process.env.TWILIO_API_KEY,
      TWILIO_API_SECRET: process.env.TWILIO_API_SECRET
    };

    const configStatus = Object.entries(envVars).reduce((acc, [key, value]) => {
      acc[key] = {
        configured: !!value,
        isPlaceholder: value?.startsWith('your-') || false,
        status: !value ? '❌ Missing' : 
                value.startsWith('your-') ? '⚠️ Placeholder' : 
                '✅ Configured'
      };
      return acc;
    }, {} as any);

    testResults.configuration = configStatus;

    // Test 2: Webhook Endpoints
    console.log('📋 Test 2: Testing webhook endpoints...');
    const webhookTests = await testWebhookEndpoints();
    testResults.tests.webhooks = webhookTests;

    // Test 3: Access Token Generation
    console.log('📋 Test 3: Testing access token generation...');
    const tokenTest = await testAccessTokenGeneration();
    testResults.tests.accessToken = tokenTest;

    // Test 4: Infrastructure Summary
    console.log('📋 Test 4: Infrastructure status...');
    const baseUrl = process.env.DIALLER_APP_URL || 'https://rmcdialer.vercel.app';
    
    testResults.infrastructure = {
      baseUrl,
      webhookEndpoints: {
        voice: `${baseUrl}/api/webhooks/twilio/voice`,
        accessToken: `${baseUrl}/api/twilio/access-token`
      },
      readyForProduction: Object.values(configStatus).every((status: any) => status.configured && !status.isPlaceholder),
      developmentMode: Object.values(configStatus).some((status: any) => !status.configured || status.isPlaceholder)
    };

    // Test 5: Production Readiness Check
    const productionReady = testResults.infrastructure.readyForProduction;
    testResults.summary = {
      status: productionReady ? 'Production Ready' : 'Development Mode',
      readyForRealCalls: productionReady,
      mockCallsAvailable: true,
      nextSteps: productionReady ? 
        ['Configure TwiML Application in Twilio Console', 'Test real calls', 'Deploy to production'] :
        ['Add real Twilio credentials to environment', 'Test with mock calls', 'Configure TwiML Application']
    };

    console.log(`✅ Twilio infrastructure test completed - ${testResults.summary.status}`);

    return NextResponse.json(testResults);

  } catch (error: any) {
    console.error('❌ Twilio infrastructure test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date(),
      message: 'Twilio infrastructure test failed'
    }, { status: 500 });
  }
}

// Test webhook endpoints
async function testWebhookEndpoints() {
  const baseUrl = process.env.DIALLER_APP_URL || 'https://rmcdialer.vercel.app';
  const results: any = {};

  try {
    // Test voice webhook endpoint
    const voiceResponse = await fetch(`${baseUrl}/api/webhooks/twilio/voice`, {
      method: 'GET'
    });
    
    results.voiceWebhook = {
      endpoint: `${baseUrl}/api/webhooks/twilio/voice`,
      status: voiceResponse.ok ? '✅ Accessible' : '❌ Error',
      responseCode: voiceResponse.status
    };

  } catch (error) {
    results.voiceWebhook = {
      endpoint: `${baseUrl}/api/webhooks/twilio/voice`,
      status: '❌ Network Error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  return results;
}

// Test access token generation
async function testAccessTokenGeneration() {
  const baseUrl = process.env.DIALLER_APP_URL || 'https://rmcdialer.vercel.app';
  
  try {
    // Test with mock agent data
    const response = await fetch(`${baseUrl}/api/twilio/access-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agentId: 'test_agent_123',
        agentEmail: 'test@rmcdialer.app'
      })
    });

    const data = await response.json();

    return {
      endpoint: `${baseUrl}/api/twilio/access-token`,
      status: response.ok ? '✅ Working' : '❌ Error',
      responseCode: response.status,
      tokenGenerated: !!data.accessToken,
      developmentMode: data.development,
      missingCredentials: data.missingCredentials || []
    };

  } catch (error) {
    return {
      endpoint: `${baseUrl}/api/twilio/access-token`,
      status: '❌ Network Error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 