import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// Twilio Recording Webhook Schema
const TwilioRecordingWebhookSchema = z.object({
  CallSid: z.string(),
  RecordingSid: z.string(),
  RecordingUrl: z.string(),
  RecordingStatus: z.enum(['in-progress', 'completed', 'absent', 'failed']),
  RecordingDuration: z.string().optional(),
  RecordingChannels: z.string().optional(),
  RecordingSource: z.string().optional(),
  AccountSid: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('🎙️ Twilio Recording webhook received');

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData = Object.fromEntries(formData.entries());
    
    console.log('📋 Recording webhook data:', JSON.stringify(webhookData, null, 2));

    // Validate the webhook data
    const validatedData = TwilioRecordingWebhookSchema.parse(webhookData);
    
    const { 
      CallSid, 
      RecordingSid, 
      RecordingUrl, 
      RecordingStatus, 
      RecordingDuration,
      RecordingChannels 
    } = validatedData;

    console.log(`🎙️ Recording ${RecordingSid} for call ${CallSid} - Status: ${RecordingStatus}`);

    // Find the call session by Twilio Call SID
    const callSession = await prisma.callSession.findFirst({
      where: { twilioCallSid: CallSid }
    });

    if (!callSession) {
      console.warn(`⚠️ Recording webhook for unknown call session: ${CallSid}`);
      return NextResponse.json({ 
        success: false, 
        message: 'Call session not found' 
      }, { status: 404 });
    }

    // Update call session with recording information
    const updateData: any = {
      recordingStatus: RecordingStatus,
      recordingSid: RecordingSid,
      updatedAt: new Date()
    };

    // Only update URL and duration when recording is completed
    if (RecordingStatus === 'completed') {
      updateData.recordingUrl = RecordingUrl;
      
      if (RecordingDuration) {
        updateData.recordingDurationSeconds = parseInt(RecordingDuration);
      }
      
      console.log(`✅ Recording completed for call ${CallSid}: ${RecordingUrl}`);
    } else if (RecordingStatus === 'failed') {
      console.error(`❌ Recording failed for call ${CallSid}`);
    }

    // Update the call session with recording info
    await prisma.callSession.update({
      where: { id: callSession.id },
      data: updateData
    });

    console.log(`📝 Updated call session ${callSession.id} with recording status: ${RecordingStatus}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Recording webhook processed',
      callSessionId: callSession.id,
      recordingStatus: RecordingStatus
    });

  } catch (error: any) {
    console.error('❌ Recording webhook error:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to process recording webhook'
    }, { status: 500 });
  }
}

// Handle GET requests for webhook verification/testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Twilio Recording webhook endpoint ready',
    timestamp: new Date(),
    endpoint: 'POST /api/webhooks/twilio/recording'
  });
} 