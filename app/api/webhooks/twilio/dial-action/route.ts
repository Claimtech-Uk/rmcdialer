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
      // Agent didn't answer - return to queue for retry with another agent
      console.log(`🔄 Agent didn't answer (${dialCallStatus}), returning caller to queue for retry`);
      
      // Get webhook base URL for redirect
      const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'https://rmcdialer.vercel.app';
      
      console.log(`📞 Redirecting call ${callSid} back to queue hold music for agent retry`);
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Redirect>${webhookBaseUrl}/api/webhooks/twilio/queue-hold-music</Redirect>
</Response>`, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    }

  } catch (error) {
    console.error('❌ Dial action webhook error:', error);
    
    // Emergency fallback - redirect to queue instead of hanging up
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'https://rmcdialer.vercel.app';
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Redirect>${webhookBaseUrl}/api/webhooks/twilio/queue-hold-music</Redirect>
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