// =============================================================================
// Queue Hold Music API - Twilio Webhook
// =============================================================================
// Provides hold music and periodic position updates for queued callers

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createInboundCallQueueService } from '@/modules/call-queue/services/inbound-call-queue.service';
import { SimpleHumeTTSService } from '@/modules/ai-voice-agent/services/simple-hume-tts.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

// Twilio queue webhook schema
const QueueWebhookSchema = z.object({
  QueueSid: z.string(),
  QueueName: z.string().optional(),
  QueueTime: z.string().optional(),
  CallSid: z.string(),
  CurrentQueueSize: z.string().optional(),
  AverageQueueTime: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    console.log('🎵 Queue hold music webhook received');

    // Check if queue feature is enabled
    if (!INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE) {
      console.log('📭 Queue system disabled, providing basic hold music');
      return getBasicHoldMusicResponse();
    }

    // Parse Twilio webhook data
    const formData = await request.formData();
    const webhookData = {
      QueueSid: formData.get('QueueSid') as string,
      QueueName: formData.get('QueueName') as string,
      QueueTime: formData.get('QueueTime') as string,
      CallSid: formData.get('CallSid') as string,
      CurrentQueueSize: formData.get('CurrentQueueSize') as string,
      AverageQueueTime: formData.get('AverageQueueTime') as string
    };

    const { CallSid, QueueTime, CurrentQueueSize } = QueueWebhookSchema.parse(webhookData);
    
    console.log(`🎵 Hold music request for call ${CallSid}`, {
      queueTime: QueueTime,
      queueSize: CurrentQueueSize
    });

    // Get queue information
    const queueService = createInboundCallQueueService(prisma);
    const queueStats = await queueService.getQueueStats();
    
    // Find the specific queued call
    const queuedCall = await prisma.inboundCallQueue.findUnique({
      where: { twilioCallSid: CallSid }
    });

    if (!queuedCall) {
      console.warn(`⚠️ Call ${CallSid} not found in queue, providing basic hold music`);
      return getBasicHoldMusicResponse();
    }

    // Update queue position if needed
    await queueService.updateQueuePosition(CallSid);

    // Determine what to play based on queue time
    const queueTimeSeconds = parseInt(QueueTime || '0');
    const shouldAnnouncePosition = queueTimeSeconds > 0 && queueTimeSeconds % 30 === 0; // Every 30 seconds

    if (shouldAnnouncePosition && INBOUND_CALL_FLAGS.QUEUE_POSITION_UPDATES) {
      // Generate position update with Hume TTS
      return await getPositionUpdateResponse(queuedCall, queueStats);
    } else {
      // Provide hold music
      return await getHoldMusicResponse();
    }

  } catch (error) {
    console.error('❌ Queue hold music webhook error:', error);
    
    // Fallback to basic hold music on any error
    return getBasicHoldMusicResponse();
  }
}

/**
 * Generate TwiML with position update announcement
 */
async function getPositionUpdateResponse(queuedCall: any, queueStats: any): Promise<NextResponse> {
  try {
    const position = queuedCall.queuePosition || 1;
    const estimatedWait = queuedCall.estimatedWaitSeconds || 120;
    const estimatedMinutes = Math.ceil(estimatedWait / 60);

    console.log(`📢 Generating position update for call ${queuedCall.twilioCallSid}`, {
      position,
      estimatedMinutes
    });

    // Generate personalized announcement with Hume TTS
    const humeTTSService = new SimpleHumeTTSService();
    let announcementText = '';

    if (position === 1) {
      announcementText = "You are next in line. An agent will be with you shortly.";
    } else if (position <= 3) {
      announcementText = `You are number ${position} in line. Your estimated wait time is ${estimatedMinutes} minute${estimatedMinutes !== 1 ? 's' : ''}.`;
    } else {
      announcementText = `You are currently number ${position} in line. Your estimated wait time is ${estimatedMinutes} minute${estimatedMinutes !== 1 ? 's' : ''}. Thank you for your patience.`;
    }

    const audioBase64 = await humeTTSService.generateCustomMessage(announcementText);

    const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioBase64}</Play>
    <Play loop="5">https://your-hold-music-url.mp3</Play>
    <Redirect>${getWebhookBaseUrl()}/api/webhooks/twilio/queue-hold-music</Redirect>
</Response>`;

    return new NextResponse(twimlContent, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });

  } catch (error) {
    console.warn('⚠️ Position update generation failed, using basic announcement:', error);
    
    // Fallback to simple voice announcement
    const position = queuedCall.queuePosition || 1;
    const estimatedMinutes = Math.ceil((queuedCall.estimatedWaitSeconds || 120) / 60);

    const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">You are number ${position} in line. Your estimated wait time is ${estimatedMinutes} minute${estimatedMinutes !== 1 ? 's' : ''}.</Say>
    <Play loop="5">https://your-hold-music-url.mp3</Play>
    <Redirect>${getWebhookBaseUrl()}/api/webhooks/twilio/queue-hold-music</Redirect>
</Response>`;

    return new NextResponse(twimlContent, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });
  }
}

/**
 * Generate TwiML with just hold music
 */
async function getHoldMusicResponse(): Promise<NextResponse> {
  const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play loop="10">https://your-hold-music-url.mp3</Play>
    <Redirect>${getWebhookBaseUrl()}/api/webhooks/twilio/queue-hold-music</Redirect>
</Response>`;

  return new NextResponse(twimlContent, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}

/**
 * Basic hold music for when queue system is disabled
 */
function getBasicHoldMusicResponse(): NextResponse {
  const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you for calling. Please hold while we connect you to an agent.</Say>
    <Play loop="20">https://your-hold-music-url.mp3</Play>
</Response>`;

  return new NextResponse(twimlContent, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}

/**
 * Get webhook base URL for redirects
 */
function getWebhookBaseUrl(): string {
  return process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';
}

// Handle GET for testing
export async function GET() {
  return NextResponse.json({
    endpoint: 'queue-hold-music',
    status: 'ready',
    features: {
      queueEnabled: INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE,
      positionUpdates: INBOUND_CALL_FLAGS.QUEUE_POSITION_UPDATES,
      holdMusic: INBOUND_CALL_FLAGS.QUEUE_HOLD_MUSIC
    }
  });
}