import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { SimpleHumeTTSService } from '@/modules/ai-voice-agent/services/simple-hume-tts.service';
import { isWithinBusinessHours, businessHoursService } from '@/lib/utils/business-hours';
import { CallOutcomeManager } from '@/modules/call-outcomes/services/call-outcome-manager.service';
import { createAiAgentService } from '@/modules/auth/services/ai-agent.service';
import { 
  performLightweightNameLookup, 
  performEnhancedCallerLookup,
  triggerBackgroundCallerLookup 
} from './caller-lookup.service';
import { createMissedCallSession } from './call-session.service';
import { normalizePhoneNumber, calculateCallerPriority } from '../utils';
import { getWebhookBaseUrl } from '../utils/twiml.utils';
import { NameInfo, CallerInfo } from '../types/twilio-voice.types';

/**
 * Handle inbound calls with proper call session creation and agent routing
 * This is the main business logic for processing incoming calls
 */
export async function handleInboundCall(
  callSid: string, 
  from: string, 
  to: string, 
  webhookData: any
): Promise<NextResponse> {
  try {
    console.log(`📞 Processing inbound call from ${from} to ${to}`);
    
    // 1. BUSINESS HOURS CHECK FIRST (for maximum efficiency)
    const withinBusinessHours = isWithinBusinessHours();
    const businessStatus = businessHoursService.getBusinessHoursStatus();
    
    console.log(`📅 Business hours check: ${withinBusinessHours ? 'OPEN' : 'CLOSED'} (${businessStatus.reason})`);
    
    // 2. OUT-OF-HOURS FAST PATH - Lightweight processing for maximum speed
    if (!withinBusinessHours) {
      return await handleOutOfHoursCall(from, callSid);
    }
    
    // 3. BUSINESS HOURS OPTIMIZED PATH - Lightweight lookup + background processing
    console.log(`⏰ BUSINESS HOURS OPTIMIZED PATH: Fast name lookup + background full data`);
    
    // Lightweight name lookup for greeting personalization only
    let nameInfo: NameInfo | null = null;
    try {
      nameInfo = await performLightweightNameLookup(from);
    } catch (error) {
      console.warn(`⚠️ Lightweight name lookup failed:`, error);
    }
    
    const firstName = nameInfo?.firstName || '';
    const callerName = nameInfo ? `${nameInfo.firstName} ${nameInfo.lastName}` : '';
    const userId = nameInfo?.userId || null;
    
    if (nameInfo) {
      console.log(`👤 Caller name found: ${callerName} (ID: ${userId}) - lightweight lookup`);
    } else {
      console.log(`👤 Unknown caller: ${from} - will use generic greeting`);
    }
    
    // Create minimal caller info for fast processing
    const callerInfo = nameInfo ? {
      user: {
        id: nameInfo.userId!,
        first_name: nameInfo.firstName,
        last_name: nameInfo.lastName
      },
      priorityScore: 50 // Default priority for fast path
    } : null;
    
    // Check agent availability
    const availableAgents = await prisma.agentSession.findMany({
      where: {
        status: 'available',
        logoutAt: null,
        agent: { isActive: true }
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
      orderBy: { lastActivity: 'asc' },
      take: 1
    });

    const validatedAgent = availableAgents[0];
    console.log(`👥 Available agents: ${availableAgents.length}`);
    
    // Determine the right message type based on agent availability
    let messageType: 'connecting' | 'busy' | 'out_of_hours';
    
    if (!withinBusinessHours) {
      messageType = 'out_of_hours';
    } else if (validatedAgent) {
      messageType = 'connecting'; 
    } else {
      messageType = 'busy';
    }
    
    console.log(`🎵 Message type determined: ${messageType} (Hours: ${withinBusinessHours}, Agent: ${!!validatedAgent})`);

    // 4. Create call session regardless of agent availability
    const callSession = await createCallSession(userId, callerInfo, from, callSid, validatedAgent);
    
    if (!validatedAgent) {
      // No agents available during business hours
      return await handleNoAgentsAvailable(from, firstName, callerName, userId, callSession);
    }
    
    // Agents are available - proceed with call routing
    return await routeCallToAgent(
      from, 
      callSid, 
      firstName, 
      callerName,
      callerInfo,
      validatedAgent,
      callSession
    );
    
  } catch (error) {
    console.error('❌ Error handling inbound call:', error);
    
    // Try to use Hume TTS even for error messages
    try {
      const errorHumeTTSService = new SimpleHumeTTSService();
      const errorAudio = await errorHumeTTSService.generateBusyGreeting(); // Reuse busy greeting for errors
      
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${errorAudio}</Play>
    <Hangup/>
</Response>`, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    } catch (errorTTSError) {
      console.error(`❌ Error message Hume TTS failed:`, errorTTSError);
      
      // Absolute emergency fallback
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Pause length="2"/>
    <Hangup/>
</Response>`, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      });
    }
  }
}

// Helper functions

/**
 * Create call session with proper validation and agent assignment
 */
async function createCallSession(
  userId: number | null,
  callerInfo: any,
  from: string,
  callSid: string,
  validatedAgent: any
): Promise<any> {
  if (userId && callerInfo?.user) {
    // Known caller - create proper call session
    await prisma.userCallScore.upsert({
      where: { userId: BigInt(userId) },
      update: {},
      create: {
        userId: BigInt(userId),
        currentScore: 0,
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
        assignedToAgentId: validatedAgent?.agentId || null,
        assignedAt: validatedAgent ? new Date() : null,
      }
    });

    // Use minimal data for fast call session creation
    const sessionData: any = {
      userId: BigInt(userId),
      callQueueId: inboundQueue.id,
      twilioCallSid: callSid,
      status: validatedAgent ? 'ringing' : 'missed_call',
      direction: 'inbound',
      startedAt: new Date(),
      callSource: 'inbound',
      userClaimsContext: JSON.stringify({
        callerName: `${callerInfo.user.first_name} ${callerInfo.user.last_name}`,
        phoneNumber: from,
        lookupStatus: 'pending'
      })
    };

    // Only set agentId if we have a validated agent
    if (validatedAgent?.agent?.id) {
      sessionData.agentId = validatedAgent.agent.id;
    } else {
      // For missed calls, use AI agent for tracking
      const aiAgentService = createAiAgentService(prisma);
      const aiAgentId = await aiAgentService.getAiAgentId();
      
      if (aiAgentId) {
        sessionData.agentId = aiAgentId;
        console.log(`🤖 Using AI agent ID ${aiAgentId} for missed call tracking`);
      } else {
        // Fallback if AI agent not found
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
    }

    const callSession = await prisma.callSession.create({
      data: sessionData
    });
    
    console.log(`📝 Created ${validatedAgent ? 'ringing' : 'missed'} call session ${callSession.id} for caller ${callerInfo.user.first_name || from}`);
    
    // Trigger background lookup for business hours calls (non-blocking)
    if (validatedAgent && callSession) {
      console.log(`🔍 Triggering background caller lookup for session ${callSession.id}`);
      triggerBackgroundCallerLookup(from, callSession.id);
    }
    
    return callSession;
  } else {
    // Unknown caller - create basic session
    console.log(`👤 Unknown caller ${from} - creating basic missed call record`);
    
    // Create a basic queue entry for unknown caller
    const unknownCallerQueue = await prisma.callQueue.create({
      data: {
        userId: BigInt(999999), // Special ID for unknown callers
        queueType: 'inbound_call',
        priorityScore: 0,
        status: 'missed',
        queueReason: `Inbound call from unknown number ${from}`,
        assignedToAgentId: null,
        assignedAt: null,
      }
    });

    // Find agent ID for call session tracking
    let agentIdToUse;
    
    if (validatedAgent?.agent?.id) {
      agentIdToUse = validatedAgent.agent.id;
    } else {
      // Use AI agent for unknown/missed calls
      const aiAgentService = createAiAgentService(prisma);
      const aiAgentId = await aiAgentService.getAiAgentId();
      
      if (aiAgentId) {
        agentIdToUse = aiAgentId;
        console.log(`🤖 Using AI agent ID ${aiAgentId} for unknown caller session`);
      } else {
        // Fallback to any active agent
        const sessionAgent = await prisma.agent.findFirst({
          where: { isActive: true },
          select: { id: true }
        });
        
        if (!sessionAgent) {
          throw new Error('No valid agents found in database for call session creation');
        }
        
        agentIdToUse = sessionAgent.id;
        console.log(`📍 Using fallback agent ID ${agentIdToUse} for unknown caller session`);
      }
    }

    const callSession = await prisma.callSession.create({
      data: {
        userId: BigInt(999999), // Special ID for unknown callers
        agentId: agentIdToUse,
        callQueueId: unknownCallerQueue.id,
        twilioCallSid: callSid,
        status: validatedAgent ? 'ringing' : 'missed_call',
        direction: 'inbound',
        startedAt: new Date(),
        callSource: 'inbound',
        userClaimsContext: JSON.stringify({
          callerName: 'Unknown Caller',
          phoneNumber: from,
          lookupStatus: 'complete'
        })
      }
    });
    
    console.log(`📝 Created call session ${callSession.id} for unknown caller ${from}`);
    return callSession;
  }
}

/**
 * Handle no agents available during business hours
 */
async function handleNoAgentsAvailable(
  from: string, 
  firstName: string, 
  callerName: string, 
  userId: number | null,
  callSession: any
): Promise<NextResponse> {
  console.log(`⏰ BUSY-AGENTS: During business hours but no agents available`);
  console.log(`🎵 Generating Hume TTS busy greeting for ${callerName || from}`);
  
  // Create missed call session for proper tracking
  try {
    if (callSession) {
      const outcomeManager = new CallOutcomeManager();
      const outcomeContext = {
        sessionId: String(callSession.id),
        userId: Number(userId),
        agentId: callSession.agentId,
        callDurationSeconds: 0,
        callStartedAt: callSession.startedAt,
        previousOutcomes: []
      };

      await outcomeManager.processOutcome(
        'missed_call',
        outcomeContext,
        { 
          notes: 'No agents available during business hours',
          missedCallTime: new Date().toISOString()
        }
      );

      // Update call session status and context
      await prisma.callSession.update({
        where: { id: String(callSession.id) },
        data: {
          status: 'missed_call',
          endedAt: new Date(),
          userClaimsContext: JSON.stringify({
            ...JSON.parse(String(callSession.userClaimsContext || '{}')),
            outcome: 'missed_call',
            outcomeNotes: 'No agents available during business hours',
            missedCallReason: 'no_agents_available'
          })
        }
      });

      console.log('✅ No-agents-available missed call logged successfully');
    }
  } catch (sessionError) {
    console.error('❌ Failed to log no-agents-available missed call:', sessionError);
    // Continue with greeting anyway
  }
  
  // Try to use Hume TTS for natural busy greeting
  try {
    const humeTTSService = new SimpleHumeTTSService();
    const audioBase64 = await humeTTSService.generateBusyGreeting(firstName);
    
    console.log(`✅ Using Hume TTS for busy greeting`);
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioBase64}</Play>
    <Hangup/>
</Response>`, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.warn(`⚠️ Hume TTS busy greeting failed, trying fallback:`, error instanceof Error ? error.message : String(error));
    
    // Fallback - try to generate basic Hume TTS without personalization
    try {
      const humeTTSService = new SimpleHumeTTSService();
      const fallbackAudio = await humeTTSService.generateBusyGreeting(); // No caller name
      
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${fallbackAudio}</Play>
    <Hangup/>
</Response>`, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    } catch (fallbackError) {
      console.error(`❌ Hume TTS fallback also failed:`, fallbackError);
      
      // Final fallback - still try basic Hume TTS  
      try {
        const basicHumeTTSService = new SimpleHumeTTSService();
        const basicAudio = await basicHumeTTSService.generateBusyGreeting(); // Basic version
        
        return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${basicAudio}</Play>
    <Hangup/>
</Response>`, {
          status: 200,
          headers: { 'Content-Type': 'application/xml' }
        });
      } catch (finalError) {
        console.error(`❌ All Hume TTS attempts failed:`, finalError);
        
        // Absolute final fallback - emergency message
        return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Pause length="1"/>
    <Hangup/>
</Response>`, {
          status: 200,
          headers: {
            'Content-Type': 'application/xml',
          },
        });
      }
    }
  }
}

/**
 * Route call to available agent with Hume TTS greeting
 */
async function routeCallToAgent(
  from: string,
  callSid: string,
  firstName: string,
  callerName: string,
  callerInfo: any,
  validatedAgent: any,
  callSession: any
): Promise<NextResponse> {
          console.log(`✅ Routing call from ${callerName} to agent ${validatedAgent.agent.firstName} ${validatedAgent.agent.lastName}`);
          console.log(`📊 Agent Session Details:`, {
      agentSessionId: validatedAgent.id,
      agentId: validatedAgent.agentId,
          status: validatedAgent.status,
      currentCallSessionId: validatedAgent.current_call_session_id
  });
  
  // DO NOT update agent status here - let call-status webhook handle it
      console.log(`📞 Attempting to dial agent ${validatedAgent.agentId} - status will be updated on successful connection`);
  
  const agentClientName = `agent_${validatedAgent.agentId}`;
  console.log(`🎯 CRITICAL: Dialing Twilio client identity: "${agentClientName}"`);
  
  // Use environment-specific URL for webhooks
  const baseUrl = getWebhookBaseUrl();
  const recordingCallbackUrl = `${baseUrl}/api/webhooks/twilio/recording`;
  const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/call-status`;
  const dialActionUrl = `${baseUrl}/api/webhooks/twilio/dial-action`;
  
  console.log(`📡 Webhook URLs: Recording=${recordingCallbackUrl}, Status=${statusCallbackUrl}, DialAction=${dialActionUrl}`);
  
  // Generate Hume TTS connecting greeting
  console.log(`🎵 Generating Hume TTS connecting greeting for ${callerName || from} before transfer`);
  
  try {
    const humeTTSService = new SimpleHumeTTSService();
    const audioBase64 = await humeTTSService.generateConnectingGreeting(firstName || undefined);
    
    console.log('✅ Using Hume TTS for connecting greeting');
    
    const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioBase64}</Play>
    <Dial timeout="30" 
          record="record-from-answer" 
          recordingStatusCallback="${recordingCallbackUrl}"
          statusCallback="${statusCallbackUrl}"
          statusCallbackEvent="initiated ringing answered completed busy no-answer failed"
          statusCallbackMethod="POST"
          action="${dialActionUrl}">
        <Client>
            <Identity>${agentClientName}</Identity>
            <Parameter name="originalCallSid" value="${callSid}" />
            <Parameter name="callerPhone" value="${from}" />
            <Parameter name="callSessionId" value="${callSession?.id || 'unknown'}" />
            ${callerInfo?.user ? `<Parameter name="callerName" value="${callerInfo.user.first_name} ${callerInfo.user.last_name}" />` : ''}
            ${callerInfo?.user ? `<Parameter name="userId" value="${callerInfo.user.id}" />` : ''}
        </Client>
    </Dial>
    <Say voice="alice">I'm sorry, the agent couldn't be reached right now. We'll have someone call you back as soon as possible. Thank you!</Say>
    <Hangup/>
</Response>`;

    return new NextResponse(twimlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
    
  } catch (error) {
    console.warn('⚠️ Hume TTS connecting greeting failed, using simple greeting:', error instanceof Error ? error.message : String(error));
    
    // Fallback to simple voice connecting greeting
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Hello${firstName ? ' ' + firstName : ' there'}! Welcome to Resolve My Claim. Please hold while we connect you to an available agent.</Say>
    <Dial timeout="30" 
          record="record-from-answer" 
          recordingStatusCallback="${recordingCallbackUrl}"
          statusCallback="${statusCallbackUrl}"
          statusCallbackEvent="initiated ringing answered completed busy no-answer failed"
          statusCallbackMethod="POST"
          action="${dialActionUrl}">
        <Client>
            <Identity>${agentClientName}</Identity>
            <Parameter name="originalCallSid" value="${callSid}" />
            <Parameter name="callerPhone" value="${from}" />
            <Parameter name="callSessionId" value="${callSession?.id || 'unknown'}" />
            ${callerInfo?.user ? `<Parameter name="callerName" value="${callerInfo.user.first_name} ${callerInfo.user.last_name}" />` : ''}
            ${callerInfo?.user ? `<Parameter name="userId" value="${callerInfo.user.id}" />` : ''}
        </Client>
    </Dial>
    <Say>I'm sorry, the agent couldn't be reached right now. We'll have someone call you back as soon as possible. Thank you!</Say>
    <Hangup/>
</Response>`, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
}

/**
 * Handle out-of-hours calls with Hume TTS greetings
 */
async function handleOutOfHoursCall(from: string, callSid: string): Promise<NextResponse> {
  console.log(`🕐 OUT-OF-HOURS FAST PATH: Minimal processing for speed`);
  
  // Lightweight name lookup for greeting personalization only
  let nameInfo: NameInfo | null = null;
  try {
    nameInfo = await performLightweightNameLookup(from);
  } catch (error) {
    console.warn(`⚠️ Lightweight name lookup failed:`, error);
  }
  
  const firstName = nameInfo?.firstName || '';
  const callerName = nameInfo ? `${nameInfo.firstName} ${nameInfo.lastName}` : '';
  
  console.log(`🎵 Generating out-of-hours greeting for ${callerName || from}`);
  
  // Create missed call session for proper tracking
  try {
    await createMissedCallSession(from, callSid, nameInfo, 'out_of_hours');
    console.log('✅ Out-of-hours missed call logged successfully');
  } catch (sessionError) {
    console.error('❌ Failed to create out-of-hours missed call session:', sessionError);
    // Continue with greeting anyway
  }
  
  // Generate out-of-hours greeting and hangup
  try {
    const humeTTSService = new SimpleHumeTTSService();
    const audioBase64 = await humeTTSService.generateOutOfHoursGreeting(firstName);
    
    console.log('✅ Out-of-hours Hume TTS greeting generated - hanging up');
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioBase64}</Play>
    <Hangup/>
</Response>`, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.warn(`⚠️ Hume TTS out-of-hours greeting failed, trying fallback:`, error instanceof Error ? error.message : String(error));
    
    // Fallback - try to generate basic Hume TTS without personalization
    try {
      const humeTTSService = new SimpleHumeTTSService();
      const fallbackAudio = await humeTTSService.generateOutOfHoursGreeting(); // No caller name
      
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${fallbackAudio}</Play>
    <Hangup/>
</Response>`, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    } catch (fallbackError) {
      console.error(`❌ Hume TTS fallback also failed:`, fallbackError);
      
      // Final fallback - still try basic Hume TTS
      try {
        const basicHumeTTSService = new SimpleHumeTTSService();
        const basicAudio = await basicHumeTTSService.generateOutOfHoursGreeting(); // Basic version
        
        return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${basicAudio}</Play>
    <Hangup/>
</Response>`, {
          status: 200,
          headers: { 'Content-Type': 'application/xml' }
        });
      } catch (finalError) {
        console.error(`❌ All Hume TTS attempts failed:`, finalError);
        
        // Absolute final fallback - emergency message
        return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Pause length="1"/>
    <Hangup/>
</Response>`, {
          status: 200,
          headers: {
            'Content-Type': 'application/xml',
          },
        });
      }
    }
  }
} 