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
    
    // Emergency agent seeding check - ensure at least one agent exists
    const agentCount = await prisma.agent.count();
    if (agentCount === 0) {
      console.warn('⚠️ No agents found in database - creating emergency fallback agent');
      try {
        const bcrypt = require('bcryptjs');
        const emergencyAgent = await prisma.agent.create({
          data: {
            email: 'emergency@system.local',
            passwordHash: await bcrypt.hash('emergency123', 12),
            firstName: 'Emergency',
            lastName: 'Agent',
            role: 'agent',
            isActive: true,
            isAiAgent: false
          }
        });
        console.log(`✅ Created emergency agent with ID ${emergencyAgent.id}`);
      } catch (seedError) {
        console.error('❌ Failed to create emergency agent:', seedError);
      }
    }

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
    
    // 1. Enhanced caller lookup with smart phone number matching
    let callerInfo: any = null;
    let userId: number | null = null;
    
    try {
      callerInfo = await performEnhancedCallerLookup(from);
      userId = callerInfo?.user?.id ? Number(callerInfo.user.id) : null;
      
      if (callerInfo?.user) {
        console.log(`👤 Caller identified: ${callerInfo.user.first_name} ${callerInfo.user.last_name} (ID: ${userId})`);
        console.log(`📊 Claims: ${callerInfo.claims.length}, Requirements: ${callerInfo.requirements.length}`);
      } else {
        console.log(`👤 Unknown caller: ${from}`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not lookup caller ${from}:`, error);
    }

    // 2. Find available agents with proper validation
    const availableAgents = await prisma.agentSession.findMany({
      where: {
        status: 'available',
        logoutAt: null,
        agent: {
          isActive: true // Ensure agent record exists and is active
        }
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true
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
    
    // Additional validation: ensure agent record actually exists
    let validatedAgent = null;
    if (availableAgent?.agent?.id) {
      try {
        const agentExists = await prisma.agent.findUnique({
          where: { id: availableAgent.agentId, isActive: true }
        });
        if (agentExists) {
          validatedAgent = availableAgent;
          console.log(`✅ Validated agent ${availableAgent.agentId}: ${availableAgent.agent.firstName} ${availableAgent.agent.lastName}`);
        } else {
          console.warn(`⚠️ Agent session ${availableAgent.id} references non-existent agent ${availableAgent.agentId}`);
        }
      } catch (validationError) {
        console.error(`❌ Failed to validate agent ${availableAgent.agentId}:`, validationError);
      }
    }

    // 3. Create call session regardless of agent availability - with proper agent validation
    let callSession;
    try {
      if (userId && callerInfo?.user) {
        // Known caller - create proper call session
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

        const inboundQueue = await prisma.callQueue.create({
          data: {
            userId: BigInt(userId),
            queueType: 'inbound_call',
            priorityScore: callerInfo.priorityScore || 0,
            status: validatedAgent ? 'assigned' : 'pending',
            queueReason: `Inbound call from ${callerInfo.user.first_name} ${callerInfo.user.last_name}`,
            assignedToAgentId: validatedAgent?.agentId || null, // Use null instead of fallback
            assignedAt: validatedAgent ? new Date() : null,
          }
        });

        // Use validated agent ID or create without agent assignment for missed calls
        const sessionData: any = {
          userId: BigInt(userId),
          callQueueId: inboundQueue.id,
          twilioCallSid: callSid,
          status: validatedAgent ? 'ringing' : 'missed_call',
          direction: 'inbound',
          startedAt: new Date(),
          callSource: 'inbound',
          userClaimsContext: JSON.stringify({
            knownCaller: true,
            callerName: `${callerInfo.user.first_name} ${callerInfo.user.last_name}`,
            phoneNumber: from,
            claims: callerInfo.claims.map((claim: any) => ({
              ...claim,
              id: Number(claim.id),
              user_id: Number(claim.user_id),
              created_at: claim.created_at?.toISOString(),
              updated_at: claim.updated_at?.toISOString()
            })),
            requirements: callerInfo.requirements.map((req: any) => ({
              ...req,
              id: Number(req.id),
              claim_id: req.claim_id ? Number(req.claim_id) : null,
              created_at: req.created_at?.toISOString()
            })),
            callHistory: callerInfo.callHistory.map((call: any) => ({
              ...call,
              id: call.id,
              userId: Number(call.userId),
              startedAt: call.startedAt?.toISOString()
            }))
          })
        };

        // Only set agentId if we have a validated agent
        if (validatedAgent?.agentId) {
          sessionData.agentId = validatedAgent.agentId;
        } else {
          // For missed calls, find ANY valid agent ID as a safe fallback
          const fallbackAgent = await prisma.agent.findFirst({
            where: { isActive: true },
            select: { id: true }
          });
          if (fallbackAgent) {
            sessionData.agentId = fallbackAgent.id;
            console.log(`📍 Using fallback agent ID ${fallbackAgent.id} for missed call tracking`);
          } else {
            throw new Error('No valid agents found in database - cannot create call session');
          }
        }

        callSession = await prisma.callSession.create({
          data: sessionData
        });
        
        console.log(`📝 Created ${validatedAgent ? 'ringing' : 'missed'} call session ${callSession.id} for caller ${callerInfo.user.first_name} ${callerInfo.user.last_name}`);
      } else {
        // Unknown caller - create basic session with proper validation
        console.log(`👤 Unknown caller ${from} - creating basic missed call record`);
        
        try {
          // Create a basic queue entry for unknown caller
          const unknownCallerQueue = await prisma.callQueue.create({
            data: {
              userId: BigInt(999999), // Special ID for unknown callers
              queueType: 'inbound_call',
              priorityScore: 0,
              status: 'missed',
              queueReason: `Inbound call from unknown number ${from}`,
              assignedToAgentId: null, // No agent assigned for missed calls
              assignedAt: null,
            }
          });

          // Find a valid agent ID for call session tracking
          const sessionAgent = validatedAgent || await prisma.agent.findFirst({
            where: { isActive: true },
            select: { id: true, firstName: true, lastName: true }
          });

          if (!sessionAgent) {
            throw new Error('No valid agents found in database for call session creation');
          }

          const agentIdToUse = validatedAgent?.agentId || sessionAgent.id;
          console.log(`📍 Using agent ID ${agentIdToUse} for unknown caller session`);

          callSession = await prisma.callSession.create({
            data: {
              userId: BigInt(999999), // Special ID for unknown callers
              agentId: Number(agentIdToUse), // Ensure proper number type
              callQueueId: unknownCallerQueue.id,
              twilioCallSid: callSid,
              status: validatedAgent ? 'ringing' : 'missed_call',
              direction: 'inbound',
              startedAt: new Date(),
              callSource: 'inbound',
              userClaimsContext: JSON.stringify({
                unknownCaller: true,
                phoneNumber: from,
                searchAttempted: true,
                matchFound: false,
                missedCall: !validatedAgent
              })
            }
          });
          
          console.log(`📝 Created ${validatedAgent ? 'ringing' : 'missed'} call session ${callSession.id} for unknown caller ${from}`);
        } catch (unknownCallerError) {
          console.error(`❌ Failed to create call session for unknown caller:`, unknownCallerError);
          // Continue without call session for unknown callers
          callSession = null;
        }
      }

      if (callSession) {
        console.log(`📝 Created call session ${callSession.id} for inbound call`);
      } else {
        console.warn(`⚠️ No call session created for inbound call from ${from}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create call session:`, error);
      callSession = null;
    }

    // 4. Generate appropriate TwiML response with caller context
    if (validatedAgent) {
      const callerName = callerInfo?.user ? 
        `${callerInfo.user.first_name} ${callerInfo.user.last_name}` : 
        'Unknown Caller';
      
      console.log(`✅ Routing call from ${callerName} to agent ${validatedAgent.agent.firstName} ${validatedAgent.agent.lastName}`);
      console.log(`📊 Agent Session Details:`, {
        agentSessionId: validatedAgent.id,
        agentId: validatedAgent.agentId,
        status: validatedAgent.status,
        loginAt: validatedAgent.loginAt,
        lastActivity: validatedAgent.lastActivity,
        currentCallSessionId: validatedAgent.currentCallSessionId
      });
      console.log(`👤 Agent Record Details:`, {
        agentRecordId: validatedAgent.agent.id,
        firstName: validatedAgent.agent.firstName,
        lastName: validatedAgent.agent.lastName,
        email: validatedAgent.agent.email,
        isActive: validatedAgent.agent.isActive
      });
      
      // DO NOT update agent status here - let call-status webhook handle it when call actually connects
      // This prevents the race condition where agent is marked busy before connection is verified
      console.log(`📞 Attempting to dial agent ${validatedAgent.agentId} - status will be updated on successful connection`);

      const agentClientName = `agent_${validatedAgent.agentId}`;
      console.log(`🎯 CRITICAL: Dialing Twilio client identity: "${agentClientName}"`);
      console.log(`🔍 Agent lookup chain: Phone ${from} → User ${callerInfo?.user?.first_name} → Agent Session ${validatedAgent.id} → Agent Record ${validatedAgent.agent.id} → Twilio Client "${agentClientName}"`);
      console.log(`⚠️ If this fails, check: 1) Is agent device registered? 2) Is device online? 3) Is identity format correct?`);
      
      // Add detailed webhook URLs for debugging
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://rmcdialer.vercel.app';
      const recordingCallbackUrl = `${baseUrl}/api/webhooks/twilio/recording`;
      const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/call-status`;
      
      console.log(`📡 Webhook URLs: Recording=${recordingCallbackUrl}, Status=${statusCallbackUrl}`);
      
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Hello${callerInfo?.user ? ' ' + callerInfo.user.first_name : ''}! Welcome to R M C Dialler. Please hold while we connect you to an available agent.</Say>
    <Dial timeout="30" 
          record="record-from-answer" 
          recordingStatusCallback="${recordingCallbackUrl}"
          statusCallback="${statusCallbackUrl}"
          statusCallbackEvent="initiated ringing answered completed"
          statusCallbackMethod="POST">
        <Client>${agentClientName}</Client>
    </Dial>
    <Say voice="alice">I'm sorry, the agent couldn't be reached right now. We'll have someone call you back as soon as possible. Thank you!</Say>
    <Hangup/>
</Response>`, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      });
    } else {
      const callerName = callerInfo?.user ? 
        `${callerInfo.user.first_name} ${callerInfo.user.last_name}` : 
        '';
      
      console.log(`❌ No available agents - marking as missed call from ${callerName || from}`);
      
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you for calling R M C Dialler${callerName ? ', ' + callerInfo.user.first_name : ''}. Unfortunately, all our agents are currently busy or offline.</Say>
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

// Enhanced caller lookup with smart phone number matching
async function performEnhancedCallerLookup(phoneNumber: string): Promise<any> {
  try {
    // Normalize phone number to multiple formats for matching
    const normalizedNumbers = normalizePhoneNumber(phoneNumber);
    console.log(`🔍 Searching for caller with phone variants: ${normalizedNumbers.join(', ')}`);

    // Search for user with any of the normalized phone number variants
    const user = await replicaDb.user.findFirst({
      where: {
        AND: [
          {
            phone_number: {
              in: normalizedNumbers
            }
          },
          {
            is_enabled: true
          }
        ]
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        email_address: true,
        status: true,
        created_at: true,
        last_login: true
      }
    });

    if (!user) {
      return null;
    }

    // Get user's claims and call history
    const [claims, callHistory] = await Promise.all([
      // Get active claims
      replicaDb.claim.findMany({
        where: {
          user_id: user.id,
          status: {
            not: 'completed'
          }
        },
        select: {
          id: true,
          type: true,
          status: true,
          lender: true,
          created_at: true,
          updated_at: true
        },
        take: 5,
        orderBy: {
          created_at: 'desc'
        }
      }),

      // Get recent call history from PostgreSQL
      prisma.callSession.findMany({
        where: {
          userId: user.id
        },
        select: {
          id: true,
          status: true,
          direction: true,
          startedAt: true
        },
        take: 5,
        orderBy: {
          startedAt: 'desc'
        }
      })
    ]);

    // Simplified requirements count
    const requirements: any[] = [];

    // Calculate priority score based on claims and requirements
    const priorityScore = calculateCallerPriority(claims, requirements, callHistory);

    return {
      user: {
        ...user,
        id: Number(user.id) // Convert BigInt to number for JSON serialization
      },
      claims,
      requirements,
      callHistory,
      priorityScore,
      lookupSuccess: true
    };

  } catch (error) {
    console.error('❌ Enhanced caller lookup failed:', error);
    return null;
  }
}

// Smart phone number normalization for better matching
function normalizePhoneNumber(phoneNumber: string): string[] {
  // Remove all non-numeric characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  const variants: string[] = [];
  
  // Add original number
  variants.push(phoneNumber);
  
  if (digits.length >= 10) {
    // UK mobile numbers (assuming UK market)
    if (digits.startsWith('447')) {
      // +447... format (international)
      variants.push(`+${digits}`);
      // 07... format (national)
      variants.push(`0${digits.substring(2)}`);
      // 447... format (international without +)
      variants.push(digits);
    } else if (digits.startsWith('44')) {
      // 44... format
      variants.push(`+${digits}`);
      variants.push(`0${digits.substring(2)}`);
      variants.push(digits);
    } else if (digits.startsWith('07')) {
      // 07... format (national)
      variants.push(digits);
      variants.push(`+44${digits.substring(1)}`);
      variants.push(`44${digits.substring(1)}`);
    } else if (digits.length === 10 && digits.startsWith('7')) {
      // 7... format (missing leading 0)
      variants.push(`0${digits}`);
      variants.push(`+44${digits}`);
      variants.push(`44${digits}`);
    }
  }
  
  // Remove duplicates and return
  return [...new Set(variants)];
}

// Calculate caller priority based on their context
function calculateCallerPriority(claims: any[], requirements: any[], callHistory: any[]): number {
  let score = 50; // Base score
  
  // Active claims boost priority
  score += claims.length * 10;
  
  // Recent call activity boosts priority
  const recentCalls = callHistory.filter(call => 
    new Date(call.startedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
  );
  
  // Recent missed calls boost priority significantly
  const recentMissedCalls = recentCalls.filter(call => call.status === 'missed_call');
  score += recentMissedCalls.length * 20;
  
  // Multiple recent calls indicate urgency
  if (recentCalls.length >= 3) {
    score += 15;
  }
  
  // Cap the score
  return Math.min(score, 100);
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