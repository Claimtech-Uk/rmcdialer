// =============================================================================
// Queue Handler API - Twilio Webhook
// =============================================================================
// Handles queue events and manages call assignments to agents

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createInboundCallQueueService } from '@/modules/call-queue/services/inbound-call-queue.service';
import { createDeviceConnectivityService } from '@/modules/twilio-voice/services/device-connectivity.service';
import { SimpleHumeTTSService } from '@/modules/ai-voice-agent/services/simple-hume-tts.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

// Twilio queue event schema
const QueueEventSchema = z.object({
  CallSid: z.string(),
  QueueSid: z.string().nullable().optional(),
  QueueResult: z.string().nullable().optional(), // bridged, abandoned, redirected
  QueueTime: z.string().nullable().optional(),
  DialCallStatus: z.string().nullable().optional(),
  DialCallSid: z.string().nullable().optional()
});

export async function POST(request: NextRequest) {
  try {
    console.log('📋 Queue handler webhook received');

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData = {
      CallSid: formData.get('CallSid') as string,
      QueueSid: formData.get('QueueSid') as string | null,
      QueueResult: formData.get('QueueResult') as string | null,
      QueueTime: formData.get('QueueTime') as string | null,
      DialCallStatus: formData.get('DialCallStatus') as string | null,
      DialCallSid: formData.get('DialCallSid') as string | null
    };

    // Debug: Log raw webhook data
    console.log('📋 Raw webhook data:', Object.fromEntries(formData.entries()));
    console.log('📋 Parsed webhook data:', webhookData);

    const { CallSid, QueueResult, QueueTime, DialCallStatus } = QueueEventSchema.parse(webhookData);

    console.log(`📋 Queue event for call ${CallSid}:`, {
      queueResult: QueueResult,
      queueTime: QueueTime,
      dialStatus: DialCallStatus
    });

    // Check if queue feature is enabled
    if (!INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE) {
      console.log('📭 Queue system disabled, using legacy handling');
      return getLegacyResponse();
    }

    const queueService = createInboundCallQueueService(prisma);

    // Handle different queue results
    switch (QueueResult) {
      case 'bridged':
        // Call was successfully connected to an agent
        return await handleSuccessfulConnection(CallSid, queueService);

      case 'abandoned':
        // Caller hung up while in queue
        return await handleCallAbandoned(CallSid, queueService);

      case 'redirected':
        // Call was redirected (usually timeout or queue full)
        return await handleCallRedirected(CallSid, queueService);

      default:
        // Handle ongoing queue processing
        return await handleQueueProcessing(CallSid, queueService, DialCallStatus || undefined);
    }

  } catch (error) {
    console.error('❌ Queue handler webhook error:', error);
    
    // Return safe fallback TwiML
    return getErrorFallbackResponse();
  }
}

/**
 * Handle successful agent connection
 */
async function handleSuccessfulConnection(callSid: string, queueService: any): Promise<NextResponse> {
  try {
    console.log(`✅ Call ${callSid} successfully connected from queue`);

    // Update queue status (will be handled by call-status webhook too)
    // This is just for immediate queue cleanup
    await queueService.markCallConnected(callSid, 0); // Agent ID will be updated later

    // Return empty TwiML - call is now bridged
    const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
</Response>`;

    return new NextResponse(twimlContent, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });

  } catch (error) {
    console.error(`❌ Error handling successful connection for ${callSid}:`, error);
    return getErrorFallbackResponse();
  }
}

/**
 * Handle call abandoned by caller
 */
async function handleCallAbandoned(callSid: string, queueService: any): Promise<NextResponse> {
  try {
    console.log(`📞 Call ${callSid} abandoned by caller while in queue`);

    // Mark as abandoned in queue
    await queueService.markCallAbandoned(callSid, 'caller_hangup_in_queue');

    // Return empty TwiML - call is already ended
    const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
</Response>`;

    return new NextResponse(twimlContent, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });

  } catch (error) {
    console.error(`❌ Error handling abandoned call ${callSid}:`, error);
    return getErrorFallbackResponse();
  }
}

/**
 * Handle call redirected (timeout, queue full, etc.)
 */
async function handleCallRedirected(callSid: string, queueService: any): Promise<NextResponse> {
  try {
    console.log(`🔄 Call ${callSid} redirected from queue`);

    // Check if we should offer callback or just end call
    const queuedCall = await prisma.inboundCallQueue.findUnique({
      where: { twilioCallSid: callSid }
    });

    if (queuedCall && !queuedCall.callbackOffered) {
      // Offer callback if we haven't already
      return await offerCallbackOption(callSid, queueService);
    } else {
      // End call with apology
      return await endCallWithApology(callSid, queueService);
    }

  } catch (error) {
    console.error(`❌ Error handling redirected call ${callSid}:`, error);
    return getErrorFallbackResponse();
  }
}

/**
 * Handle ongoing queue processing (agent assignment attempts)
 */
async function handleQueueProcessing(callSid: string, queueService: any, dialStatus?: string): Promise<NextResponse> {
  try {
    console.log(`🔄 Processing queue event for call ${callSid}, dial status: ${dialStatus}`);

    if (dialStatus === 'no-answer' || dialStatus === 'busy' || dialStatus === 'failed') {
      // Agent didn't answer, try next agent or continue holding
      console.log(`📞 Agent didn't answer for call ${callSid}, continuing queue processing`);
      
      // The queue processor will handle finding the next agent
      // For now, return to hold music
      return await returnToHoldMusic(callSid);
    }

    // Default: continue with queue processing
    return await returnToHoldMusic(callSid);

  } catch (error) {
    console.error(`❌ Error processing queue for call ${callSid}:`, error);
    return getErrorFallbackResponse();
  }
}

/**
 * Offer callback option to caller
 */
async function offerCallbackOption(callSid: string, queueService: any): Promise<NextResponse> {
  try {
    console.log(`📞 Offering callback option to call ${callSid}`);

    // Mark that callback was offered
    await prisma.inboundCallQueue.update({
      where: { twilioCallSid: callSid },
      data: { callbackOffered: true }
    });

    // Generate callback offer with Hume TTS
    try {
      const humeTTSService = new SimpleHumeTTSService();
      const audioBase64 = await humeTTSService.generateCallbackOffer();

      const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioBase64}</Play>
    <Gather input="dtmf" timeout="10" numDigits="1" action="${getWebhookBaseUrl()}/api/webhooks/twilio/callback-response">
        <Say voice="alice">Press 1 to request a callback, or stay on the line to continue holding.</Say>
    </Gather>
    <Redirect>${getWebhookBaseUrl()}/api/webhooks/twilio/queue-hold-music</Redirect>
</Response>`;

      return new NextResponse(twimlContent, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });

    } catch (error) {
      console.warn('⚠️ Hume TTS callback offer failed, using voice fallback:', error);
      
      // Fallback to voice
      const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="dtmf" timeout="10" numDigits="1" action="${getWebhookBaseUrl()}/api/webhooks/twilio/callback-response">
        <Say voice="alice">Due to high call volume, you can press 1 to request a callback, or stay on the line to continue holding.</Say>
    </Gather>
    <Redirect>${getWebhookBaseUrl()}/api/webhooks/twilio/queue-hold-music</Redirect>
</Response>`;

      return new NextResponse(twimlContent, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    }

  } catch (error) {
    console.error(`❌ Error offering callback for call ${callSid}:`, error);
    return getErrorFallbackResponse();
  }
}

/**
 * End call with apology message
 */
async function endCallWithApology(callSid: string, queueService: any): Promise<NextResponse> {
  try {
    console.log(`📞 Ending call ${callSid} with apology`);

    // Mark call as completed with timeout
    await queueService.markCallAbandoned(callSid, 'max_wait_time_reached');

    // Generate apology with Hume TTS
    try {
      const humeTTSService = new SimpleHumeTTSService();
      const audioBase64 = await humeTTSService.generateApologyMessage();

      const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioBase64}</Play>
    <Hangup/>
</Response>`;

      return new NextResponse(twimlContent, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });

    } catch (error) {
      console.warn('⚠️ Hume TTS apology failed, using voice fallback:', error);
      
      // Fallback to voice
      const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">We apologize, but all our agents are currently busy. Please try calling back later or visit our website. Thank you!</Say>
    <Hangup/>
</Response>`;

      return new NextResponse(twimlContent, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    }

  } catch (error) {
    console.error(`❌ Error ending call with apology for ${callSid}:`, error);
    return getErrorFallbackResponse();
  }
}

/**
 * Return caller to hold music
 */
async function returnToHoldMusic(callSid: string): Promise<NextResponse> {
  const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Redirect>${getWebhookBaseUrl()}/api/webhooks/twilio/queue-hold-music</Redirect>
</Response>`;

  return new NextResponse(twimlContent, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}

/**
 * Legacy response when queue system is disabled
 */
function getLegacyResponse(): NextResponse {
  const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, we're experiencing technical difficulties. Please try calling back later.</Say>
    <Hangup/>
</Response>`;

  return new NextResponse(twimlContent, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}

/**
 * Error fallback response
 */
function getErrorFallbackResponse(): NextResponse {
  const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">We're experiencing technical difficulties. Please try calling back later. Thank you!</Say>
    <Hangup/>
</Response>`;

  return new NextResponse(twimlContent, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}

/**
 * Get webhook base URL
 */
function getWebhookBaseUrl(): string {
  return process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';
}

// Handle GET for testing
export async function GET() {
  return NextResponse.json({
    endpoint: 'queue-handler',
    status: 'ready',
    features: {
      queueEnabled: INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE,
      callbackSystem: INBOUND_CALL_FLAGS.CALLBACK_REQUEST_SYSTEM
    }
  });
}