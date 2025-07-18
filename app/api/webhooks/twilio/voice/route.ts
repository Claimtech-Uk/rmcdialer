import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Twilio Voice Webhook Schema
const TwilioVoiceWebhookSchema = z.object({
  CallSid: z.string(),
  AccountSid: z.string(),
  From: z.string(),
  To: z.string(),
  CallStatus: z.enum(['ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']),
  ApiVersion: z.string().optional(),
  Direction: z.enum(['inbound', 'outbound']).optional(),
  CallerName: z.string().optional(),
  Duration: z.string().optional(),
  RecordingUrl: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('📞 Twilio Voice webhook received');

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData = Object.fromEntries(formData.entries());
    
    console.log('📋 Webhook data:', webhookData);

    // For Voice SDK calls, the target number is in the 'To' parameter
    const targetNumber = webhookData.To as string;
    const direction = webhookData.Direction as string;
    const callSid = webhookData.CallSid as string;

    console.log(`📞 Call ${callSid} - Direction: ${direction}, Target: ${targetNumber}`);

    // Return TwiML response - either dial the number or handle status updates
    const twimlResponse = generateTwiMLResponse(direction, webhookData);
    
    return new NextResponse(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });

  } catch (error: any) {
    console.error('❌ Twilio voice webhook error:', error);
    
    // Return error TwiML
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, there was an error processing your call. Please try again later.</Say>
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

// Generate appropriate TwiML response
function generateTwiMLResponse(direction: string | undefined, data: any): string {
  const targetNumber = data.To;
  const userId = data.userId;
  const userName = data.userName;
  const callSid = data.CallSid;

  console.log(`🎯 Generating TwiML for direction: ${direction}, target: ${targetNumber}`);

  if (direction === 'inbound') {
    // Handle incoming calls (calls to our Twilio number)
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Hello, you've reached R M C Dialler. This is an automated system for financial claims support.</Say>
    <Pause length="1"/>
    <Say voice="alice">If you're expecting a call from one of our agents, please hold while we connect you.</Say>
    <Dial timeout="30">
        <Queue>support-queue</Queue>
    </Dial>
    <Say voice="alice">All agents are currently busy. Please try again later or visit our website. Goodbye.</Say>
    <Hangup/>
</Response>`;
  }

  // For outbound calls from Voice SDK - dial the target number
  if (targetNumber) {
    console.log(`📞 Dialing ${targetNumber} for user ${userName || userId || 'unknown'}`);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial callerId="+447738585850" timeout="30" record="record-from-answer" recordingStatusCallback="https://rmcdialer.vercel.app/api/webhooks/twilio/recording">
        <Number>${targetNumber}</Number>
    </Dial>
    <Say voice="alice">The call could not be completed. Please try again later. Goodbye.</Say>
    <Hangup/>
</Response>`;
  }

  // Fallback - no target number provided
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, no phone number was provided for this call. Please try again. Goodbye.</Say>
    <Hangup/>
</Response>`;
}

// Log call events for debugging
function logCallEvent(event: string, data: any) {
  console.log(`📊 Call Event: ${event}`, {
    callSid: data.CallSid,
    from: data.From,
    to: data.To,
    status: data.CallStatus,
    duration: data.Duration
  });
}

// Handle GET requests (for testing)
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Twilio Voice webhook endpoint ready',
    timestamp: new Date(),
    endpoint: 'POST /api/webhooks/twilio/voice'
  });
} 