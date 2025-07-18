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

    // Validate webhook data
    const validatedData = TwilioVoiceWebhookSchema.parse(webhookData);
    
    const { CallSid, From, To, CallStatus, Direction } = validatedData;

    // Handle different call statuses
    switch (CallStatus) {
      case 'ringing':
        console.log(`📞 Call ${CallSid} ringing: ${From} → ${To}`);
        break;
        
      case 'in-progress':
        console.log(`📞 Call ${CallSid} in progress: ${From} → ${To}`);
        break;
        
      case 'completed':
        console.log(`✅ Call ${CallSid} completed: ${From} → ${To}`);
        // Update call session in database
        await updateCallSession(CallSid, 'completed', validatedData);
        break;
        
      case 'failed':
      case 'busy':
      case 'no-answer':
        console.log(`❌ Call ${CallSid} ${CallStatus}: ${From} → ${To}`);
        await updateCallSession(CallSid, 'failed', validatedData);
        break;
    }

    // Return TwiML response for outbound calls
    const twimlResponse = generateTwiMLResponse(Direction, validatedData);
    
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
  const { From, To, CallSid } = data;

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

  // For outbound calls, provide simple instructions
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Please wait while we connect your call.</Say>
    <Pause length="2"/>
</Response>`;
}

// Update call session in database (integration with our call service)
async function updateCallSession(twilioCallSid: string, status: string, webhookData: any) {
  try {
    // This would integrate with our Call Service
    // For now, just log the update
    console.log(`📊 Updating call session ${twilioCallSid} to ${status}`, {
      duration: webhookData.Duration,
      recordingUrl: webhookData.RecordingUrl,
      from: webhookData.From,
      to: webhookData.To
    });

    // TODO: Integrate with modules/calls/services/call.service.ts
    // await callService.handleTwilioWebhook(webhookData);
    
  } catch (error) {
    console.error('❌ Failed to update call session:', error);
  }
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