import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';

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
    
    console.log('📋 ALL Webhook data:', JSON.stringify(webhookData, null, 2));

    // For Voice SDK calls, check if this is coming from our TwiML App
    const to = webhookData.To as string;
    const from = webhookData.From as string;
    const direction = webhookData.Direction as string;
    const callSid = webhookData.CallSid as string;

    console.log(`📞 Call ${callSid}`);
    console.log(`🎯 Direction: ${direction}`);
    console.log(`📱 From: ${from}`);
    console.log(`📱 To: ${to}`);

    // Check if this is a Voice SDK call (From starts with "client:")
    const isVoiceSDKCall = from && from.startsWith('client:');
    console.log(`🔍 Is Voice SDK call: ${isVoiceSDKCall}`);

    // For Voice SDK calls, look for target number in call parameters
    let targetPhoneNumber: string | null = null;
    if (isVoiceSDKCall) {
      // The target number should be in the call parameters
      targetPhoneNumber = (webhookData.To || webhookData.Called || webhookData.targetNumber) as string;
      console.log(`🎯 Target from parameters: ${targetPhoneNumber}`);
    }

    // Handle inbound calls differently - create call sessions and route properly
    if (direction === 'inbound' && !isVoiceSDKCall) {
      return await handleInboundCall(callSid, from, to, webhookData);
    }

    // Return TwiML response for outbound calls
    const twimlResponse = generateTwiMLResponse(direction, webhookData, Boolean(isVoiceSDKCall), targetPhoneNumber);
    
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

// Handle inbound calls with proper call session creation and agent routing
async function handleInboundCall(callSid: string, from: string, to: string, webhookData: any): Promise<NextResponse> {
  try {
    console.log(`📞 Processing inbound call from ${from} to ${to}`);
    
    // 1. Try to find user by phone number in MySQL replica
    let userId: number | null = null;
    try {
      const user = await replicaDb.user.findFirst({
        where: {
          phone_number: from,
          is_enabled: true
        }
      });
      userId = user ? Number(user.id) : null;
      console.log(`👤 Caller lookup: ${userId ? `Found user ${userId}` : 'Unknown caller'}`);
    } catch (error) {
      console.warn(`⚠️ Could not lookup caller ${from}:`, error);
    }

    // 2. Find available agents
    const availableAgents = await prisma.agentSession.findMany({
      where: {
        status: 'available',
        logoutAt: null
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
      },
      orderBy: {
        lastActivity: 'asc' // Least recently active agent first
      },
      take: 1
    });

    const availableAgent = availableAgents[0];
    console.log(`👥 Available agents: ${availableAgents.length}`);

    // 3. Create call session regardless of agent availability
    let callSession;
    try {
      // Ensure we have a UserCallScore for database constraints
      if (userId) {
        await prisma.userCallScore.upsert({
          where: { userId: BigInt(userId) },
          update: {},
          create: {
            userId: BigInt(userId),
            currentScore: 50,
            totalAttempts: 0,
            successfulCalls: 0
          }
        });

        // Create a call queue entry for inbound calls
        const inboundQueue = await prisma.callQueue.create({
          data: {
            userId: BigInt(userId),
            queueType: 'inbound_call',
            priorityScore: 0,
            status: availableAgent ? 'assigned' : 'pending',
            queueReason: 'Inbound call received',
            assignedToAgentId: availableAgent?.agentId || null,
            assignedAt: availableAgent ? new Date() : null,
          }
        });

        // Create call session
        callSession = await prisma.callSession.create({
          data: {
            userId: BigInt(userId),
            agentId: availableAgent?.agentId || 1, // Default to agent 1 for missed calls
            callQueueId: inboundQueue.id,
            twilioCallSid: callSid,
            status: availableAgent ? 'ringing' : 'missed_call',
            direction: 'inbound',
            startedAt: new Date(),
            callSource: 'inbound'
          }
        });
      } else {
        // For unknown callers, create a basic session without queue
        callSession = await prisma.callSession.create({
          data: {
            userId: BigInt(999999), // Special ID for unknown callers
            agentId: availableAgent?.agentId || 1,
            callQueueId: crypto.randomUUID(), // Temporary - will be handled differently later
            twilioCallSid: callSid,
            status: availableAgent ? 'ringing' : 'missed_call',
            direction: 'inbound',
            startedAt: new Date(),
            callSource: 'inbound',
            userClaimsContext: JSON.stringify({
              unknownCaller: true,
              phoneNumber: from
            })
          }
        });
      }

      console.log(`📝 Created call session ${callSession.id} for inbound call`);
    } catch (error) {
      console.error(`❌ Failed to create call session:`, error);
      // Continue without call session - at least handle the call
    }

    // 4. Generate appropriate TwiML response
    if (availableAgent) {
      console.log(`✅ Routing call to agent ${availableAgent.agent.firstName} ${availableAgent.agent.lastName}`);
      
      // Update agent session to on_call
      await prisma.agentSession.update({
        where: { id: availableAgent.id },
        data: {
          status: 'on_call',
          currentCallSessionId: callSession?.id,
          lastActivity: new Date()
        }
      });

      // Route to available agent using client name
      const agentClientName = `agent-${availableAgent.agentId}`;
      
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Hello! Please hold while we connect you to an available agent.</Say>
    <Dial timeout="30" 
          record="record-from-answer" 
          recordingStatusCallback="https://rmcdialer.vercel.app/api/webhooks/twilio/recording"
          statusCallback="https://rmcdialer.vercel.app/api/webhooks/twilio/call-status"
          statusCallbackEvent="initiated ringing answered completed"
          statusCallbackMethod="POST">
        <Client>${agentClientName}</Client>
    </Dial>
    <Say voice="alice">The agent is not available right now. We'll have someone call you back shortly. Thank you!</Say>
    <Hangup/>
</Response>`, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      });
    } else {
      console.log(`❌ No available agents - marking as missed call`);
      
      // Handle missed call
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you for calling R M C Dialler. Unfortunately, all our agents are currently busy or offline.</Say>
    <Pause length="1"/>
    <Say voice="alice">Your call is important to us and we will call you back as soon as possible. Thank you for your patience.</Say>
    <Hangup/>
</Response>`, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      });
    }

  } catch (error) {
    console.error('❌ Error handling inbound call:', error);
    
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, there was an error processing your call. Please try again later.</Say>
    <Hangup/>
</Response>`, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
}

// Generate appropriate TwiML response for outbound calls
function generateTwiMLResponse(direction: string | undefined, data: any, isVoiceSDKCall: boolean, targetPhoneNumber: string | null): string {
  const userId = data.userId;
  const userName = data.userName;
  const callSid = data.CallSid;
  const to = data.To;

  console.log(`🎯 Generating TwiML for direction: ${direction}, isVoiceSDK: ${isVoiceSDKCall}, target: ${targetPhoneNumber || to}`);

  // For Voice SDK calls, always dial the target number
  if (isVoiceSDKCall) {
    const phoneNumber = targetPhoneNumber || to;
    console.log(`🔍 Voice SDK call debugging:`);
    console.log(`  - targetPhoneNumber: "${targetPhoneNumber}"`);
    console.log(`  - to: "${to}"`);
    console.log(`  - final phoneNumber: "${phoneNumber}"`);
    console.log(`  - phoneNumber type: ${typeof phoneNumber}`);
    console.log(`  - phoneNumber starts with +: ${phoneNumber && phoneNumber.startsWith && phoneNumber.startsWith('+')}`);
    
    if (phoneNumber && phoneNumber.startsWith('+')) {
      console.log(`📞 Voice SDK call: Dialing ${phoneNumber} for user ${userName || userId || 'unknown'}`);
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial callerId="+447488879172" 
          timeout="30" 
          record="record-from-answer" 
          recordingStatusCallback="https://rmcdialer.vercel.app/api/webhooks/twilio/recording"
          statusCallback="https://rmcdialer.vercel.app/api/webhooks/twilio/call-status"
          statusCallbackEvent="initiated ringing answered completed"
          statusCallbackMethod="POST">
        <Number>${phoneNumber}</Number>
    </Dial>
    <Say voice="alice">The call could not be completed. Please try again later. Goodbye.</Say>
    <Hangup/>
</Response>`;
    } else {
      console.log(`❌ Voice SDK call but no valid phone number found.`);
      console.log(`  - phoneNumber truthy: ${!!phoneNumber}`);
      console.log(`  - has startsWith method: ${phoneNumber && typeof phoneNumber.startsWith === 'function'}`);
      console.log(`  - Raw To value: ${JSON.stringify(to)}`);
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, no valid phone number was provided for this call. Please try again. Goodbye.</Say>
    <Hangup/>
</Response>`;
    }
  }

  // Fallback - no target number provided
  console.log(`❌ Fallback: No clear call type identified`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, this call type is not supported. Please try again. Goodbye.</Say>
    <Hangup/>
</Response>`;
}

// Log call events for debugging
function logCallEvent(event: string, data: any) {
  console.log(`📊 Call Event: ${event}`, {
    callSid: data.CallSid,
    from: data.From,
    to: data.To,
    status: data.CallStatus,
    duration: data.Duration
  });
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