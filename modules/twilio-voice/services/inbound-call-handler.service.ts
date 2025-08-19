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
import { createMissedCallService } from '@/modules/missed-calls/services/missed-call.service';
import { normalizePhoneNumber, calculateCallerPriority } from '../utils';
import { getWebhookBaseUrl } from '../utils/twiml.utils';
import { NameInfo, CallerInfo } from '../types/twilio-voice.types';
import { createAgentHeartbeatService } from '@/modules/agents/services/agent-heartbeat.service';
import { createDeviceConnectivityService } from '@/modules/twilio-voice/services/device-connectivity.service';
import { createInboundCallQueueService } from '@/modules/call-queue/services/inbound-call-queue.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

/**
 * 🎯 SIMPLIFIED: Handle inbound calls with 2 simple options
 * 1. Out of hours → Play out of hours message and log missed call
 * 2. In hours → Play busy message and log missed call
 */
export async function handleInboundCall(
  callSid: string, 
  from: string, 
  to: string, 
  webhookData: any
): Promise<NextResponse> {
  try {
    console.log(`📞 SIMPLIFIED: Processing inbound call from ${from} to ${to}`);
    
    // Business hours check
    const withinBusinessHours = isWithinBusinessHours();
    const businessStatus = businessHoursService.getBusinessHoursStatus();
    
    console.log(`📅 Business hours: ${withinBusinessHours ? 'OPEN' : 'CLOSED'} (${businessStatus.reason})`);
    
    if (!withinBusinessHours) {
      // OUT OF HOURS: Play out of hours message and log missed call
      console.log(`🕐 OUT OF HOURS: Playing out of hours message`);
      return await handleOutOfHoursCall(from, callSid);
    } else {
      // IN HOURS: Play busy message and log missed call
      console.log(`⏰ IN HOURS: Playing busy message - everyone is busy`);
      return await handleBusyHoursCall(from, callSid);
    }

  } catch (error) {
    console.error(`❌ Simplified inbound call handler error for ${callSid}:`, error);
    
    // Emergency missed call logging
    try {
      await createMissedCallSession(from, callSid, null, 'handler_error');
      console.log('✅ Emergency missed call session created after handler error');
    } catch (sessionError) {
      console.error('❌ Failed to create emergency missed call session:', sessionError);
    }
    
    // Graceful error recovery with simple pause and hangup
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

// Helper functions

/**
 * 🎯 FINAL BOSS: Agent discovery with comprehensive heartbeat validation
 * Uses our new agent polling service with multi-tier heartbeat validation
 */
async function findTrulyAvailableAgentWithHeartbeat(): Promise<any> {
  try {
    console.log('🏆 FINAL BOSS: Using comprehensive heartbeat-validated agent discovery');

    // Use our enhanced agent polling service with heartbeat validation
    const { createAgentPollingService } = await import('@/modules/agents/services/agent-polling.service');
    const agentPollingService = createAgentPollingService(prisma);
    
    // This already includes our comprehensive heartbeat validation from findBestAgent
    const bestAgent = await agentPollingService.findBestAgent([]);
    
    if (bestAgent) {
      console.log(`🎯 FINAL BOSS: Found heartbeat-validated agent ${bestAgent.agentId}`, {
        agentId: bestAgent.agentId,
        readinessScore: bestAgent.readinessScore,
        availability: bestAgent.availability,
        currentCalls: bestAgent.currentCalls,
        heartbeatValidated: true
      });
      
      // Convert to format expected by routing functions
      const agentSession = await prisma.agentSession.findFirst({
        where: {
          agentId: bestAgent.agentId,
          logoutAt: null,
          status: 'available'
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
        }
      });
      
      return agentSession;
    }

    console.log('📭 FINAL BOSS: No heartbeat-validated agents available');
    return null;

  } catch (error) {
    console.error('❌ FINAL BOSS agent discovery failed:', error);
    console.log('🔄 Falling back to legacy agent discovery');
    return await findAvailableAgentLegacy();
  }
}

/**
 * Legacy agent discovery method (original logic)
 */
async function findAvailableAgentLegacy(): Promise<any> {
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

  return availableAgents[0] || null;
}

/**
 * 🎯 ALIGNED: Add call to queue and start continuous polling for agents
 * Queue is ONLY for waiting callers - no fast-tracking or immediate assignments
 */
async function addToQueueAndStartPolling(
  from: string,
  callSid: string,
  firstName: string,
  callerName: string,
  callerInfo: any,
  userId: number | null
): Promise<NextResponse> {
  try {
    console.log(`📋 ALIGNED: Adding call ${callSid} to queue - no agents available`);
    
    // Initialize queue service
    const queueService = createInboundCallQueueService(prisma);
    
    // Prepare call info for queue
    const callInfo = {
      twilioCallSid: callSid,
      callerPhone: from,
      callerName: callerName || undefined,
      userId: userId || undefined,
      priorityScore: callerInfo?.priorityScore || 50,
      metadata: {
        firstName,
        originalTimestamp: new Date().toISOString(),
        businessHours: true,
        waitingForAgent: true  // This caller is waiting for an agent to become available
      }
    };

    // Add to queue (ONLY waiting calls go in queue)
    const queuePosition = await queueService.enqueueCall(callInfo);
    
    console.log(`📍 ALIGNED: Call ${callSid} queued at position ${queuePosition.position} - continuous agent polling will begin`);

    // Generate queue entry TwiML with hold music (caller waits here)
    // The queue processor cron job will continuously poll for agents and assign when available
    return await generateQueueEntryTwiML(firstName, callerName, queuePosition);

  } catch (error) {
    console.error(`❌ Queue addition failed for call ${callSid}:`, error);
    
    // Fall back to technical difficulties message
    return new NextResponse(generateTechnicalDifficultiesTwiML(), {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}

/**
 * 🎯 ALIGNED: Generate technical difficulties TwiML for fallback scenarios
 */
function generateTechnicalDifficultiesTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">
    We apologize, but we are currently experiencing technical difficulties. 
    Please try calling again in a few minutes or contact us via our website.
  </Say>
  <Hangup/>
</Response>`;
}

/**
 * Generate TwiML for immediate agent connection from queue
 */
async function generateQueuedCallTwiML(
  queuedCall: any,
  validatedAgent: any,
  firstName: string
): Promise<NextResponse> {
  try {
    console.log(`📞 Generating immediate connection TwiML for queued call ${queuedCall.twilioCallSid}`);
    
    const agentClientName = `agent_${validatedAgent.agentId}`;
    const baseUrl = getWebhookBaseUrl();
    
    // Generate connecting greeting with Hume TTS
    const humeTTSService = new SimpleHumeTTSService();
    const audioBase64 = await humeTTSService.generateConnectingGreeting(firstName || undefined);
    
    const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioBase64}</Play>
    <Dial timeout="600" 
          record="record-from-answer" 
          recordingStatusCallback="${baseUrl}/api/webhooks/twilio/recording"
          statusCallback="${baseUrl}/api/webhooks/twilio/call-status"
          statusCallbackEvent="initiated ringing answered completed busy no-answer failed"
          statusCallbackMethod="POST"
          action="${baseUrl}/api/webhooks/twilio/queue-handler">
        <Client>
            <Identity>${agentClientName}</Identity>
            <Parameter name="originalCallSid" value="${queuedCall.twilioCallSid}" />
            <Parameter name="callerPhone" value="${queuedCall.callerPhone}" />
            <Parameter name="queueId" value="${queuedCall.id}" />
            <Parameter name="callerName" value="${queuedCall.callerName || ''}" />
            <Parameter name="userId" value="${queuedCall.userId || ''}" />
        </Client>
    </Dial>
    <Redirect>${baseUrl}/api/webhooks/twilio/queue-handler</Redirect>
</Response>`;

    return new NextResponse(twimlContent, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });

  } catch (error) {
    console.warn('⚠️ Queued call TwiML generation failed, using simple version:', error);
    
    const agentClientName = `agent_${validatedAgent.agentId}`;
    const baseUrl = getWebhookBaseUrl();
    
    const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Please hold while we connect you to an available agent.</Say>
    <Dial timeout="600" action="${baseUrl}/api/webhooks/twilio/queue-handler">
        <Client>
            <Identity>${agentClientName}</Identity>
        </Client>
    </Dial>
    <Redirect>${baseUrl}/api/webhooks/twilio/queue-handler</Redirect>
</Response>`;

    return new NextResponse(twimlContent, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });
  }
}

/**
 * Generate TwiML for queue entry with hold music
 */
async function generateQueueEntryTwiML(
  firstName: string,
  callerName: string,
  queuePosition: any
): Promise<NextResponse> {
  try {
    console.log(`📋 Generating queue entry TwiML for caller ${callerName}`);
    
    const baseUrl = getWebhookBaseUrl();
    const estimatedMinutes = Math.ceil(queuePosition.estimatedWaitSeconds / 60);
    
    // Generate welcome message with queue position
    const humeTTSService = new SimpleHumeTTSService();
    const welcomeText = firstName 
      ? `Hello ${firstName}! Welcome to Resolve My Claim. You are number ${queuePosition.position} in line. Your estimated wait time is ${estimatedMinutes} minute${estimatedMinutes !== 1 ? 's' : ''}. Please stay on the line.`
      : `Welcome to Resolve My Claim. You are number ${queuePosition.position} in line. Your estimated wait time is ${estimatedMinutes} minute${estimatedMinutes !== 1 ? 's' : ''}. Please stay on the line.`;
    
    const audioBase64 = await humeTTSService.generateCustomMessage(welcomeText);
    
    const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioBase64}</Play>
    <Enqueue waitUrl="${baseUrl}/api/webhooks/twilio/queue-hold-music" 
             action="${baseUrl}/api/webhooks/twilio/queue-handler">
        <Task priority="${queuePosition.position}">
            {
                "callSid": "${queuePosition.id}",
                "position": ${queuePosition.position},
                "estimatedWait": ${queuePosition.estimatedWaitSeconds}
            }
        </Task>
    </Enqueue>
</Response>`;

    return new NextResponse(twimlContent, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });

  } catch (error) {
    console.warn('⚠️ Queue entry TwiML generation failed, using simple version:', error);
    
    const baseUrl = getWebhookBaseUrl();
    const estimatedMinutes = Math.ceil(queuePosition.estimatedWaitSeconds / 60);
    
    const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Welcome to Resolve My Claim. You are number ${queuePosition.position} in line. Your estimated wait time is ${estimatedMinutes} minute${estimatedMinutes !== 1 ? 's' : ''}. Please stay on the line.</Say>
    <Enqueue waitUrl="${baseUrl}/api/webhooks/twilio/queue-hold-music" 
             action="${baseUrl}/api/webhooks/twilio/queue-handler">
        <Task priority="${queuePosition.position}">
            {
                "callSid": "${queuePosition.id}",
                "position": ${queuePosition.position}
            }
        </Task>
    </Enqueue>
</Response>`;

    return new NextResponse(twimlContent, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });
  }
}

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
    // Ensure user_call_scores row exists for sentinel unknown ID to satisfy FK
    await prisma.userCallScore.upsert({
      where: { userId: BigInt(999999) },
      update: {},
      create: {
        userId: BigInt(999999),
        currentScore: 0,
        totalAttempts: 0,
        successfulCalls: 0
      }
    });

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
    <Dial timeout="600" 
          record="record-from-answer" 
          recordingChannels="dual"
          recordingTrack="both"
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
    <Dial timeout="600" 
          record="record-from-answer" 
          recordingChannels="dual"
          recordingTrack="both"
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

  // 🎯 NEW: Create missed call entry for priority callback system
  try {
    const missedCallService = createMissedCallService(prisma);
    await missedCallService.createMissedCall({
      phoneNumber: from,
      callerName: callerName || undefined,
      userId: nameInfo?.userId ? BigInt(nameInfo.userId) : undefined,
      reason: 'out_of_hours',
      twilioCallSid: callSid,
      sessionId: undefined // Will be set when call session is created
    });
    console.log('✅ Out-of-hours missed call entry created for priority callback');
  } catch (missedCallError) {
    console.error('❌ Failed to create missed call entry:', missedCallError);
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
} /**
 * 🎯 SIMPLIFIED: Handle busy hours calls (everyone is busy) with Hume TTS
 * Always log as missed call for callback prioritization
 */
async function handleBusyHoursCall(from: string, callSid: string): Promise<NextResponse> {
  console.log(`⏰ BUSY HOURS: Everyone is busy - playing busy message`);
  
  // Lightweight name lookup for greeting personalization only
  let nameInfo: NameInfo | null = null;
  try {
    nameInfo = await performLightweightNameLookup(from);
  } catch (error) {
    console.warn(`⚠️ Lightweight name lookup failed:`, error);
  }
  
  const firstName = nameInfo?.firstName || '';
  const callerName = nameInfo ? `${nameInfo.firstName} ${nameInfo.lastName}` : '';
  
  console.log(`🎵 Generating busy greeting for ${callerName || from}`);
  
  // Create missed call session for proper tracking - this ensures callback prioritization
  try {
    await createMissedCallSession(from, callSid, nameInfo, 'agents_busy');
    console.log('✅ Busy hours missed call logged successfully - will be prioritized for callback');
  } catch (sessionError) {
    console.error('❌ Failed to create busy hours missed call session:', sessionError);
    // Continue with greeting anyway
  }

  // 🎯 NEW: Create missed call entry for priority callback system
  try {
    const missedCallService = createMissedCallService(prisma);
    await missedCallService.createMissedCall({
      phoneNumber: from,
      callerName: callerName || undefined,
      userId: nameInfo?.userId ? BigInt(nameInfo.userId) : undefined,
      reason: 'agents_busy',
      twilioCallSid: callSid,
      sessionId: undefined // Will be set when call session is created
    });
    console.log('✅ Busy hours missed call entry created for priority callback');
  } catch (missedCallError) {
    console.error('❌ Failed to create missed call entry:', missedCallError);
    // Continue with greeting anyway
  }
  
  // Generate busy greeting and hangup
  try {
    const humeTTSService = new SimpleHumeTTSService();
    const audioBase64 = await humeTTSService.generateBusyGreeting(firstName);
    
    console.log('✅ Busy hours Hume TTS greeting generated - hanging up');
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