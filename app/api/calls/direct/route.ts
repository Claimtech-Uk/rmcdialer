import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTwilioClient } from '@/modules/twilio-voice/services/twilio-client';
import { getWebhookBaseUrl } from '@/modules/twilio-voice/utils/twiml.utils';
import { prisma } from '@/lib/db';

// Schema for direct call request
const DirectCallSchema = z.object({
  phoneNumber: z.string().min(10),
  userContext: z.object({
    userId: z.number(),
    firstName: z.string(),
    lastName: z.string(),
    claimId: z.number().optional()
  }),
  agentId: z.number(),
  callSessionId: z.string().uuid().optional()
});

/**
 * Direct Call API - Single-Call Architecture
 * 
 * This endpoint eliminates the dual-call issue by:
 * 1. Creating ONE call directly to the customer via Twilio REST API
 * 2. When customer answers, TwiML connects them to the agent
 * 3. Result: Single CallSid, simple recording, no parent/child complexity
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📞 Direct call API called');

    const body = await request.json();
    console.log('📋 Direct call request data:', JSON.stringify(body, null, 2));

    // Validate the request
    const validatedData = DirectCallSchema.parse(body);
    const { phoneNumber, userContext, agentId, callSessionId } = validatedData;

    // Get webhook base URL for TwiML endpoints
    const baseUrl = getWebhookBaseUrl();
    
    // TwiML URL that will handle the call when customer answers
    const twimlUrl = `${baseUrl}/api/webhooks/twilio/connect-agent`;
    
    // Status callback URL for call status updates
    const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/call-status`;
    
    // Recording callback URL
    const recordingCallbackUrl = `${baseUrl}/api/webhooks/twilio/recording`;

    console.log('🌐 Using webhook URLs:', {
      twimlUrl,
      statusCallbackUrl,
      recordingCallbackUrl
    });

    // Create or update call session in database
    let sessionId = callSessionId;
    if (!sessionId) {
      console.log('📝 Creating new call session in database...');
      
      // First create a queue entry (required for foreign key)
      const queue = await prisma.callQueue.create({
        data: {
          userId: BigInt(userContext.userId),
          queueType: 'direct_call',
          priorityScore: 50,
          status: 'pending'
        }
      });

      // Create call session
      const session = await prisma.callSession.create({
        data: {
          userId: BigInt(userContext.userId),
          agentId,
          callQueueId: queue.id,
          direction: 'outbound',
          status: 'initiated',
          userClaimsContext: userContext.claimId ? [{ id: userContext.claimId }] : undefined,
          callSource: 'direct_api'
        }
      });

      sessionId = session.id;
      console.log('✅ Created call session:', sessionId);
    }

    // Create the call using Twilio REST API
    console.log('📞 Creating Twilio call via REST API...');
    
    const twilioClient = getTwilioClient();
    const call = await twilioClient.createCall({
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER || '+447488879172',
      url: twimlUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'no-answer', 'failed'],
      statusCallbackMethod: 'POST',
      record: true,
      recordingStatusCallback: recordingCallbackUrl,
      timeout: 600 // 10 minutes
    });

    console.log('✅ Twilio call created successfully:', {
      callSid: call.sid,
      to: call.to,
      from: call.from,
      status: call.status
    });

    // Update call session with Twilio CallSid
    await prisma.callSession.update({
      where: { id: sessionId },
      data: {
        twilioCallSid: call.sid,
        status: 'connecting'
      }
    });

    console.log('✅ Updated call session with Twilio CallSid:', call.sid);

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      callSessionId: sessionId,
      status: call.status,
      message: 'Call initiated successfully via direct API',
      userContext: {
        userId: userContext.userId,
        name: `${userContext.firstName} ${userContext.lastName}`,
        phoneNumber
      }
    });

  } catch (error: any) {
    console.error('❌ Direct call API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to initiate direct call',
      details: error.code || 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Direct Call API - Single-Call Architecture',
    description: 'Eliminates dual-call issues by creating one call directly to customer',
    endpoints: {
      'POST /api/calls/direct': 'Create a direct call to customer'
    },
    advantages: [
      'Single CallSid - no parent/child complexity',
      'Recording webhook always matches',
      'Simpler call flow and debugging',
      'Better reliability'
    ],
    timestamp: new Date().toISOString()
  });
}
