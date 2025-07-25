import { NextRequest, NextResponse } from 'next/server';

// Fallback webhook for Twilio voice calls
// This is called if the main voice webhook fails or times out

export async function POST(request: NextRequest) {
  try {
    console.log('📞 Twilio voice fallback webhook received');
    
    // Parse form data
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    
    console.log(`🔄 Fallback activated for call ${callSid} from ${from} to ${to}`);
    
    // Provide a simple fallback response
    const fallbackTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">
        We're sorry, we're experiencing technical difficulties. 
        Please hold while we transfer you to one of our agents, or try calling back later.
    </Say>
    <Dial timeout="30">
        <Queue>support</Queue>
    </Dial>
    <Say voice="alice">
        We're unable to connect you at this time. Please try calling back later. Goodbye.
    </Say>
    <Hangup/>
</Response>`;
    
    return new NextResponse(fallbackTwiML, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.error('❌ Voice fallback webhook error:', error);
    
    // Even if there's an error, provide a minimal response
    const emergencyTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">
        We're sorry, we're experiencing technical difficulties. Please try calling back later. Goodbye.
    </Say>
    <Hangup/>
</Response>`;
    
    return new NextResponse(emergencyTwiML, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
}

// Handle GET requests
export async function GET() {
  return new NextResponse('Twilio Voice Fallback Webhook Endpoint', { status: 200 });
} 