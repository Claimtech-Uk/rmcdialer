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
    const webhookData = await request.formData();
    
    const CallSid = webhookData.get('CallSid') as string;
    const CallStatus = webhookData.get('CallStatus') as string;
    const Direction = webhookData.get('Direction') as string;
    const Duration = webhookData.get('Duration') as string;
    const From = webhookData.get('From') as string;
    const To = webhookData.get('To') as string;
    const DialCallStatus = webhookData.get('DialCallStatus') as string;
    const DialCallSid = webhookData.get('DialCallSid') as string;
    const RecordingUrl = webhookData.get('RecordingUrl') as string;

    console.log(`🔄 Call status webhook received:`, {
      CallSid,
      CallStatus,
      Direction,
      Duration,
      From,
      To,
      DialCallStatus: DialCallStatus || 'N/A',
      DialCallSid: DialCallSid || 'N/A',
      RecordingUrl: RecordingUrl || 'N/A',
      timestamp: new Date().toISOString()
    });
    
    // CRITICAL: Log dial-specific status for agent connection debugging
    if (DialCallStatus) {
      console.log(`📞 DIAL ATTEMPT RESULT: Status="${DialCallStatus}", DialSid="${DialCallSid}"`);
      console.log(`🎯 Agent connection analysis: ${getDialStatusExplanation(DialCallStatus)}`);
    }

    // Find the call session
    const callSession = await prisma.callSession.findFirst({
      where: { 
        twilioCallSid: CallSid 
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!callSession) {
      console.warn(`⚠️ Call session not found for Twilio CallSid: ${CallSid}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Call session not found',
        callSid: CallSid 
      }, { status: 404 });
    }

    console.log(`📍 Found call session ${callSession.id} for agent ${callSession.agent?.firstName} ${callSession.agent?.lastName}`);

    // CRITICAL FIX: For inbound calls with Dial, prioritize DialCallStatus over parent CallStatus
    // This is because we care about agent connection status, not parent call status
    const effectiveStatus = DialCallStatus || CallStatus;
    const isDialEvent = !!DialCallStatus;
    
    console.log(`🎯 Status processing: Parent="${CallStatus}", Dial="${DialCallStatus || 'N/A'}", Using="${effectiveStatus}", IsDialEvent=${isDialEvent}`);

    // Map Twilio status to our internal status
    const statusMapping: Record<string, string> = {
      'initiated': 'initiated',
      'ringing': 'ringing', 
      'answered': 'connected',
      'in-progress': 'connected',
      'completed': 'completed',
      'busy': 'no_answer',
      'failed': 'failed',
      'no-answer': 'no_answer',
      'canceled': 'failed'
    };

    const ourStatus = statusMapping[effectiveStatus] || effectiveStatus;
    
    // Prepare update data
    const updateData: any = {
      status: ourStatus,
      twilioCallSid: CallSid, // Ensure this is set
      updatedAt: new Date()
    };

    // Set timing based on effective status (prioritizing dial status for inbound calls)
    const now = new Date();
    
    if (['answered', 'in-progress'].includes(effectiveStatus) && !callSession.connectedAt) {
      updateData.connectedAt = now;
      console.log(`✅ Call ${CallSid} connected at ${now.toISOString()} (effective status: ${effectiveStatus})`);
    }

    if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(effectiveStatus)) {
      updateData.endedAt = now;
      
      // Get duration from Twilio Duration field
      if (Duration) {
        const durationSeconds = parseInt(Duration);
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
      
      console.log(`🔚 Call ${CallSid} ended with effective status: ${effectiveStatus} -> ${ourStatus} (parent: ${CallStatus}, dial: ${DialCallStatus || 'N/A'})`);
    }

    // Update the call session
    const updatedSession = await prisma.callSession.update({
      where: { id: callSession.id },
      data: updateData
    });

    console.log(`📝 Updated call session ${callSession.id}:`, {
      status: ourStatus,
      effectiveStatus: effectiveStatus,
      isDialEvent: isDialEvent,
      durationSeconds: updateData.durationSeconds,
      talkTimeSeconds: updateData.talkTimeSeconds,
      connectedAt: updateData.connectedAt,
      endedAt: updateData.endedAt
    });

    // Update agent session based on effective call status (prioritizing dial status for inbound calls)
    if (['answered', 'in-progress'].includes(effectiveStatus)) {
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
    if (['busy', 'failed', 'no-answer', 'canceled'].includes(effectiveStatus) && !callSession.connectedAt) {
      // Update call session to reflect missed call status
      const missedCallStatus = callSession.direction === 'inbound' ? 'missed_call' : 'no_answer';
      
      console.log(`📞 Call ${CallSid} failed without connection - marking as ${missedCallStatus} (effective status: ${effectiveStatus})`);
      
      await prisma.callSession.update({
        where: { id: callSession.id },
        data: {
          status: missedCallStatus,
          endedAt: new Date(),
          lastOutcomeType: 'no_answer',
          lastOutcomeNotes: `Agent unavailable - call ${effectiveStatus}. Direction: ${callSession.direction}, From: ${From}, To: ${To}, DialStatus: ${DialCallStatus || 'N/A'}`,
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
        console.log(`📋 Updated queue entry ${callSession.callQueueId} status to ${callSession.direction === 'inbound' ? 'missed' : 'no_answer'}`);
      }

      // Reset agent session to available (they should be able to take the next call)
      if (callSession.agentId) {
        const updatedSessions = await prisma.agentSession.updateMany({
          where: { 
            agentId: callSession.agentId
          },
          data: { 
            status: 'available', // Ensure agent is available for next call
            currentCallSessionId: null,
            lastActivity: new Date()
          }
        });
        
        console.log(`👤 Reset ${updatedSessions.count} agent sessions for agent ${callSession.agentId} to available - ${callSession.direction} call ${effectiveStatus} without connection`);
      }

      // Add additional debugging for missed inbound calls
      if (callSession.direction === 'inbound') {
        console.log(`🔍 MISSED INBOUND CALL DEBUG:`, {
          callSessionId: callSession.id,
          twilioCallSid: CallSid,
          from: From,
          to: To,
          agentId: callSession.agentId,
          agentName: callSession.agent ? `${callSession.agent.firstName} ${callSession.agent.lastName}` : 'Unknown',
          parentCallStatus: CallStatus,
          dialCallStatus: DialCallStatus || 'N/A',
          effectiveStatus: effectiveStatus,
          wasConnected: !!callSession.connectedAt,
          duration: Duration || '0',
          missedCallReason: `Agent client dial failed: ${effectiveStatus}`
        });
      }
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

// Helper function to explain dial status results for debugging
function getDialStatusExplanation(dialStatus: string): string {
  switch (dialStatus) {
    case 'completed':
      return '✅ Agent answered and call connected successfully';
    case 'busy':
      return '📞 Agent device was busy (already on another call)';
    case 'no-answer':
      return '⏰ Agent device didn\'t answer within timeout period (30s)';
    case 'failed':
      return '❌ Dial attempt failed - likely device not registered or network issue';
    case 'canceled':
      return '🚫 Dial attempt was canceled before completion';
    default:
      return `❓ Unknown dial status: ${dialStatus}`;
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