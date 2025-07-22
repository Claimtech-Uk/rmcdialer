import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// Twilio Call Status Callback Schema
const TwilioCallStatusSchema = z.object({
  CallSid: z.string(),
  AccountSid: z.string(),
  From: z.string(),
  To: z.string(),
  CallStatus: z.enum(['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']),
  ApiVersion: z.string().optional(),
  Direction: z.enum(['inbound', 'outbound-api', 'outbound-dial']).optional(),
  Duration: z.string().optional(), // Total call duration in seconds
  CallDuration: z.string().optional(), // Alternative duration field
  Timestamp: z.string().optional(),
  SequenceNumber: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('📞 Twilio Call Status webhook received');

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData = Object.fromEntries(formData.entries());
    
    console.log('📋 Call Status data:', {
      CallSid: webhookData.CallSid,
      CallStatus: webhookData.CallStatus,
      Duration: webhookData.Duration,
      CallDuration: webhookData.CallDuration,
      From: webhookData.From,
      To: webhookData.To,
      Direction: webhookData.Direction
    });

    // Validate the webhook data
    const validatedData = TwilioCallStatusSchema.parse(webhookData);
    
    const { 
      CallSid, 
      CallStatus, 
      Duration, 
      CallDuration,
      From,
      To,
      Direction
    } = validatedData;

    console.log(`📞 Call ${CallSid} status: ${CallStatus}`);

    // Find the call session by Twilio Call SID
    const callSession = await prisma.callSession.findFirst({
      where: { twilioCallSid: CallSid }
    });

    if (!callSession) {
      console.warn(`⚠️ Call status webhook for unknown call session: ${CallSid}`);
      return NextResponse.json({ 
        success: false, 
        message: 'Call session not found' 
      }, { status: 404 });
    }

    // Map Twilio status to our internal status
    const statusMap: Record<string, string> = {
      'queued': 'initiated',
      'ringing': 'ringing', 
      'in-progress': 'connected',
      'completed': 'completed',
      'busy': 'no_answer',
      'failed': 'failed',
      'no-answer': 'no_answer',
      'canceled': 'failed'
    };

    const ourStatus = statusMap[CallStatus] || 'failed';
    
    // Prepare update data
    const updateData: any = {
      status: ourStatus,
      twilioCallSid: CallSid, // Ensure this is set
      updatedAt: new Date()
    };

    // Set timing based on status
    const now = new Date();
    
    if (CallStatus === 'in-progress' && !callSession.connectedAt) {
      updateData.connectedAt = now;
      console.log(`✅ Call ${CallSid} connected at ${now.toISOString()}`);
    }

    if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(CallStatus)) {
      updateData.endedAt = now;
      
      // Get duration from Twilio (Duration or CallDuration field)
      const twilioSeconds = Duration || CallDuration;
      if (twilioSeconds) {
        const durationSeconds = parseInt(twilioSeconds);
        updateData.durationSeconds = durationSeconds;
        console.log(`⏱️ Call ${CallSid} duration: ${durationSeconds} seconds`);
        
        // Calculate talk time if we have both connected and ended times
        if (callSession.connectedAt) {
          const talkTimeMs = now.getTime() - callSession.connectedAt.getTime();
          const talkTimeSeconds = Math.max(0, Math.floor(talkTimeMs / 1000));
          updateData.talkTimeSeconds = talkTimeSeconds;
          console.log(`🗣️ Call ${CallSid} talk time: ${talkTimeSeconds} seconds`);
        }
      }
      
      console.log(`🔚 Call ${CallSid} ended with status: ${CallStatus} -> ${ourStatus}`);
    }

    // Update the call session
    const updatedSession = await prisma.callSession.update({
      where: { id: callSession.id },
      data: updateData
    });

    console.log(`📝 Updated call session ${callSession.id}:`, {
      status: ourStatus,
      durationSeconds: updateData.durationSeconds,
      talkTimeSeconds: updateData.talkTimeSeconds,
      connectedAt: updateData.connectedAt,
      endedAt: updateData.endedAt
    });

    // Update agent session based on call status
    if (CallStatus === 'in-progress') {
      // Call connected - now mark agent as on_call (this fixes the race condition)
      await prisma.agentSession.updateMany({
        where: { 
          agentId: callSession.agentId,
          status: 'available' // Only update if currently available
        },
        data: { 
          status: 'on_call',
          currentCallSessionId: callSession.id,
          lastActivity: new Date()
        }
      });
      
      console.log(`👤 Agent ${callSession.agentId} marked as on_call - call successfully connected`);
    }

    // Update agent session if call completed
    if (['completed', 'failed', 'no_answer'].includes(ourStatus)) {
      await prisma.agentSession.updateMany({
        where: { 
          agentId: callSession.agentId,
          currentCallSessionId: callSession.id 
        },
        data: { 
          status: 'available',
          currentCallSessionId: null,
          callsCompletedToday: { increment: 1 },
          totalTalkTimeSeconds: { 
            increment: updateData.talkTimeSeconds || 0 
          },
          lastActivity: new Date()
        }
      });
      
      console.log(`👤 Agent ${callSession.agentId} marked as available after call completion`);
    }

    // Handle failed dial attempts - ensure agent stays available if call never connected
    if (['busy', 'failed', 'no-answer', 'canceled'].includes(CallStatus) && !callSession.connectedAt) {
      // Update call session to reflect missed call status
      const missedCallStatus = callSession.direction === 'inbound' ? 'missed_call' : 'no_answer';
      
      await prisma.callSession.update({
        where: { id: callSession.id },
        data: {
          status: missedCallStatus,
          endedAt: new Date(),
          lastOutcomeType: 'no_answer',
          lastOutcomeNotes: `Agent unavailable - call ${CallStatus}`,
          lastOutcomeAt: new Date()
        }
      });
      
      // Update queue status for missed calls
      if (callSession.callQueueId) {
        await prisma.callQueue.update({
          where: { id: callSession.callQueueId },
          data: { 
            status: callSession.direction === 'inbound' ? 'missed' : 'no_answer'
          }
        });
      }

      await prisma.agentSession.updateMany({
        where: { 
          agentId: callSession.agentId
        },
        data: { 
          status: 'available', // Ensure agent is available for next call
          currentCallSessionId: null,
          lastActivity: new Date()
        }
      });
      
      console.log(`👤 Agent ${callSession.agentId} remains available - ${callSession.direction} call ${CallStatus} without connection (marked as ${missedCallStatus})`);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Call status updated successfully',
      callSessionId: callSession.id,
      status: ourStatus,
      duration: updateData.durationSeconds,
      talkTime: updateData.talkTimeSeconds
    });

  } catch (error: any) {
    console.error('❌ Call status webhook error:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to process call status webhook'
    }, { status: 500 });
  }
}

// Handle GET requests for webhook verification/testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Twilio Call Status webhook endpoint ready',
    timestamp: new Date(),
    endpoint: 'POST /api/webhooks/twilio/call-status'
  });
} 