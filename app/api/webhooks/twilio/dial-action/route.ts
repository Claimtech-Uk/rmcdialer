import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CallOutcomeManager } from '@/modules/call-outcomes/services/call-outcome-manager.service';
import { SimpleHumeTTSService } from '@/modules/ai-voice-agent/services/simple-hume-tts.service';

// Dial Action Webhook - Handles what happens when agent dial fails
// This is called when the <Dial> to an agent completes (success or failure)
export async function POST(request: NextRequest) {
  try {
    console.log('📞 Twilio dial action webhook received');
    
    // Parse form data from Twilio
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const dialCallStatus = formData.get('DialCallStatus') as string;
    const dialCallSid = formData.get('DialCallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const duration = formData.get('Duration') as string;
    
    console.log(`📞 Dial action for call ${callSid}:`, {
      dialCallStatus,
      dialCallSid,
      from,
      to,
      duration
    });

    // Log the dial outcome for monitoring
    console.log(`📍 Processing dial action - CallSid: ${callSid}, Status: ${dialCallStatus}`);
    
    // Note: Call session outcome will be handled by the call-status webhook
    // This endpoint focuses on providing the right TwiML response

    // Return appropriate TwiML based on dial result
    if (dialCallStatus === 'answered') {
      // Agent answered - no additional TwiML needed, call continues
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
</Response>`, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    } else {
      // Agent didn't answer - provide friendly fallback message using Hume TTS
      console.log(`🎵 Generating Hume TTS agent unavailable message for dial status: ${dialCallStatus}`);
      
      try {
        const humeTTSService = new SimpleHumeTTSService();
        const audioBase64 = await humeTTSService.generateBusyGreeting();
        
        console.log(`✅ Using Hume TTS for agent unavailable message`);
        return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioBase64}</Play>
    <Hangup/>
</Response>`, {
          status: 200,
          headers: { 'Content-Type': 'application/xml' }
        });
      } catch (error) {
        console.warn(`⚠️ Hume TTS agent unavailable message failed, using fallback:`, error instanceof Error ? error.message : String(error));
        
        // Fallback - but still avoid alice, use simple message
        const fallbackMessage = dialCallStatus === 'busy' 
          ? "Our agent is currently on another call. We'll have someone call you back as soon as possible."
          : dialCallStatus === 'no-answer'
          ? "Our agent is not available right now. We'll have someone call you back as soon as possible."
          : "We're unable to connect you to an agent at this time. We'll have someone call you back as soon as possible.";

        return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>${fallbackMessage} Thank you for calling Resolve My Claim.</Say>
    <Hangup/>
</Response>`, {
          status: 200,
          headers: { 'Content-Type': 'application/xml' }
        });
      }
    }

  } catch (error) {
    console.error('❌ Dial action webhook error:', error);
    
    // Provide safe fallback TwiML even on error (no alice voice)
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>We're experiencing technical difficulties. We'll have someone call you back shortly. Thank you.</Say>
    <Hangup/>
</Response>`, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });
  }
}

// Handle GET requests for health checks
export async function GET() {
  return new NextResponse('Twilio Dial Action Webhook Endpoint - OK', { status: 200 });
} 