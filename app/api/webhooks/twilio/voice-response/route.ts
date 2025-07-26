// Voice Response Webhook (EVI Version)
// With EVI, all conversation responses are handled automatically via WebSocket streaming
// This endpoint is kept for compatibility but EVI manages the entire conversation flow

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🎤 Voice response webhook received (EVI mode)');
    
    // Parse form data for logging
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const speechResult = formData.get('SpeechResult') as string;
    
    console.log(`📞 Call ${callSid}: Speech result: ${speechResult}`);
    
    // With EVI, all conversation flow is handled via WebSocket streaming
    // This webhook should not normally be called since EVI manages everything
    console.log('ℹ️ EVI is handling conversation flow - this webhook should not be needed');
     
    // Simple TwiML response that acknowledges but doesn't interfere with EVI
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">The conversation is being handled by our AI assistant.</Say>
    <Pause length="1"/>
    <Hangup/>
</Response>`;

    return new NextResponse(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });

  } catch (error) {
    console.error('❌ Voice response webhook error:', error);
    
     const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">There was an issue with the call. Please try again.</Say>
    <Hangup/>
</Response>`;
    
    return new NextResponse(errorTwiML, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
}

// Handle GET requests
export async function GET() {
  return new NextResponse('Voice Response Webhook (EVI Mode)', { status: 200 });
} 