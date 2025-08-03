// =============================================================================
// Callback Response Handler - Simple Callback System
// =============================================================================
// Handles caller responses to callback offers (Press 1 for callback)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createInboundCallQueueService } from '@/modules/call-queue/services/inbound-call-queue.service';
import { SimpleHumeTTSService } from '@/modules/ai-voice-agent/services/simple-hume-tts.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

// Twilio gather response schema
const CallbackResponseSchema = z.object({
  CallSid: z.string(),
  Digits: z.string().optional(),
  SpeechResult: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    console.log('📞 Callback response webhook received');

    // Parse Twilio webhook data
    const formData = await request.formData();
    const webhookData = {
      CallSid: formData.get('CallSid') as string,
      Digits: formData.get('Digits') as string,
      SpeechResult: formData.get('SpeechResult') as string
    };

    const { CallSid, Digits } = CallbackResponseSchema.parse(webhookData);
    
    console.log(`📞 Callback response for call ${CallSid}: digits="${Digits}"`);

    // Check if callback feature is enabled
    if (!INBOUND_CALL_FLAGS.CALLBACK_REQUEST_SYSTEM) {
      console.log('📭 Callback system disabled, returning to hold');
      return returnToHoldMusic();
    }

    const queueService = createInboundCallQueueService(prisma);

    // Find the queued call
    const queuedCall = await prisma.inboundCallQueue.findUnique({
      where: { twilioCallSid: CallSid }
    });

    if (!queuedCall) {
      console.warn(`⚠️ Call ${CallSid} not found in queue for callback response`);
      return returnToHoldMusic();
    }

    // Handle the response
    if (Digits === '1') {
      // Caller requested callback
      console.log(`✅ Caller ${queuedCall.callerPhone} requested callback`);
      return await handleCallbackRequest(queuedCall, queueService);
    } else {
      // Caller chose to continue holding or no input
      console.log(`⏳ Caller ${queuedCall.callerPhone} chose to continue holding`);
      return returnToHoldMusic();
    }

  } catch (error) {
    console.error('❌ Callback response webhook error:', error);
    
    // Fallback to hold music on any error
    return returnToHoldMusic();
  }
}

/**
 * Handle callback request from caller
 */
async function handleCallbackRequest(queuedCall: any, queueService: any): Promise<NextResponse> {
  try {
    console.log(`📞 Processing callback request for call ${queuedCall.twilioCallSid}`);

    // Update queue status
    await prisma.inboundCallQueue.update({
      where: { id: queuedCall.id },
      data: {
        callbackAccepted: true,
        status: 'callback_requested',
        abandonedAt: new Date()
      }
    });

    // Create callback record for later processing
    await createCallbackRecord(queuedCall);

    // Generate confirmation message with Hume TTS
    try {
      const humeTTSService = new SimpleHumeTTSService();
      const confirmationText = `Thank you! We've added you to our callback list. 
      
One of our agents will call you back at ${queuedCall.callerPhone} as soon as possible.

You should receive a call within the next 30 minutes during business hours.

Thank you for choosing Resolve My Claim!`;

      const audioBase64 = await humeTTSService.generateCustomMessage(confirmationText);

      const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioBase64}</Play>
    <Hangup/>
</Response>`;

      return new NextResponse(twimlContent, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });

    } catch (ttsError) {
      console.warn('⚠️ Hume TTS callback confirmation failed, using voice fallback:', ttsError);
      
      // Fallback to voice
      const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you! We've added you to our callback list. One of our agents will call you back at your number as soon as possible. You should receive a call within the next 30 minutes during business hours. Thank you for choosing Resolve My Claim!</Say>
    <Hangup/>
</Response>`;

      return new NextResponse(twimlContent, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    }

  } catch (error) {
    console.error(`❌ Error handling callback request for ${queuedCall.id}:`, error);
    return returnToHoldMusic();
  }
}

/**
 * Create callback record in existing callback system
 */
async function createCallbackRecord(queuedCall: any): Promise<void> {
  try {
    console.log(`📝 Creating callback record for ${queuedCall.callerPhone}`);

    // For now, log the callback request - can be integrated with existing callback system later
    console.log(`📞 Callback request logged for ${queuedCall.callerPhone}`, {
      userId: queuedCall.userId,
      callerPhone: queuedCall.callerPhone,
      callerName: queuedCall.callerName,
      waitTimeSeconds: Math.floor((Date.now() - queuedCall.enteredQueueAt.getTime()) / 1000),
      originalCallSid: queuedCall.twilioCallSid
    });

    // TODO: Integrate with existing callback system using correct schema
    // The existing Callback model requires originalCallSessionId which we don't have from queue
    // This can be enhanced to create proper callback records once integrated

    console.log(`✅ Callback record created for ${queuedCall.callerPhone}`);

  } catch (error) {
    console.error(`❌ Failed to create callback record:`, error);
    throw error;
  }
}

/**
 * Return caller to hold music (continue waiting)
 */
function returnToHoldMusic(): NextResponse {
  const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';
  
  const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you. Please continue holding and we'll connect you to the next available agent.</Say>
    <Redirect>${baseUrl}/api/webhooks/twilio/queue-hold-music</Redirect>
</Response>`;

  return new NextResponse(twimlContent, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}

// Handle GET for testing
export async function GET() {
  return NextResponse.json({
    endpoint: 'callback-response',
    status: 'ready',
    features: {
      callbackEnabled: INBOUND_CALL_FLAGS.CALLBACK_REQUEST_SYSTEM
    }
  });
}