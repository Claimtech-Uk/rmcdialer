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
import { createAgentHeartbeatService } from '@/modules/agents/services/agent-heartbeat.service';
import { createDeviceConnectivityService } from '@/modules/twilio-voice/services/device-connectivity.service';
import { createInboundCallQueueService } from '@/modules/call-queue/services/inbound-call-queue.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

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
    
    // Enhanced agent discovery with heartbeat and device validation
    const validatedAgent = await findTrulyAvailableAgent();
    console.log(`👥 Validated available agents: ${validatedAgent ? 1 : 0}`);
    
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

    // 4. Determine call routing strategy based on feature flags and agent availability
    if (INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE && withinBusinessHours) {
      // Use queue-based routing (Phase 2)
      console.log('🔧 Using queue-based call routing');
      return await routeCallThroughQueue(
        from,
        callSid,
        firstName,
        callerName,
        callerInfo,
        validatedAgent,
        userId
      );
    } else {
      // Use legacy direct routing (Phase 1)
      console.log('🔧 Using legacy direct call routing');
      
      // Create call session for legacy routing
      const callSession = await createCallSession(userId, callerInfo, from, callSid, validatedAgent);
      
      if (!validatedAgent) {
        // No agents available during business hours
        return await handleNoAgentsAvailable(from, firstName, callerName, userId, callSession);
      }
      
      // Agents are available - proceed with direct call routing
      return await routeCallToAgent(
        from, 
        callSid, 
        firstName, 
        callerName,
        callerInfo,
        validatedAgent,
        callSession
      );
    }
    
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
 * Enhanced agent discovery with heartbeat and device validation
 * Uses new heartbeat and device connectivity services when feature flags are enabled
 */
async function findTrulyAvailableAgent(): Promise<any> {
  try {
    // If enhanced discovery is disabled, fall back to original logic
    if (!INBOUND_CALL_FLAGS.ENHANCED_AGENT_DISCOVERY) {
      console.log('🔧 Using legacy agent discovery (enhanced discovery disabled)');
      return await findAvailableAgentLegacy();
    }

    console.log('🔍 Using enhanced agent discovery with heartbeat and device validation');

    // Get basic available agents from database
    const candidateAgents = await prisma.agentSession.findMany({
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
      take: 5 // Get top 5 candidates for validation
    });

    if (candidateAgents.length === 0) {
      console.log('📭 No candidate agents found in database');
      return null;
    }

    console.log(`🔍 Found ${candidateAgents.length} candidate agents, validating readiness...`);

    // Enhanced validation with heartbeat and device connectivity
    const deviceConnectivityService = createDeviceConnectivityService(prisma);
    
    // Validate each candidate agent
    for (const candidateAgent of candidateAgents) {
      try {
        const readiness = await deviceConnectivityService.validateAgentReadiness(candidateAgent.agentId);
        
        console.log(`🔍 Agent ${candidateAgent.agentId} readiness check:`, {
          agentName: `${candidateAgent.agent.firstName} ${candidateAgent.agent.lastName}`,
          isReady: readiness.isReady,
          readinessScore: readiness.readinessScore,
          deviceConnected: readiness.deviceConnected,
          issues: readiness.issues
        });

        if (readiness.isReady && readiness.readinessScore >= INBOUND_CALL_FLAGS.AGENT_READINESS_THRESHOLD) {
          console.log(`✅ Agent ${candidateAgent.agentId} (${candidateAgent.agent.firstName} ${candidateAgent.agent.lastName}) passed enhanced validation`);
          return candidateAgent;
        } else {
          console.log(`❌ Agent ${candidateAgent.agentId} failed validation: ${readiness.issues.join(', ')}`);
        }
      } catch (error) {
        console.warn(`⚠️ Validation failed for agent ${candidateAgent.agentId}:`, error);
        // Continue to next agent
      }
    }

    console.log('📭 No agents passed enhanced validation, checking if we should fallback');

    // If no agents pass enhanced validation but we have candidates, 
    // decide whether to use fallback or return null
    if (INBOUND_CALL_FLAGS.ENHANCED_AGENT_HEARTBEAT && candidateAgents.length > 0) {
      console.log('🔄 Enhanced validation failed, falling back to legacy agent selection');
      return candidateAgents[0]; // Use first candidate as fallback
    }

    return null;

  } catch (error) {
    console.error('❌ Enhanced agent discovery failed:', error);
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
 * Route call through queue system (Phase 2)
 */
async function routeCallThroughQueue(
  from: string,
  callSid: string,
  firstName: string,
  callerName: string,
  callerInfo: any,
  validatedAgent: any,
  userId: number | null
): Promise<NextResponse> {
  try {
    console.log(`📋 Routing call ${callSid} through queue system`);
    
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
        agentAvailable: !!validatedAgent
      }
    };

    if (validatedAgent) {
      // Agent available - fast track through queue with immediate assignment
      console.log(`⚡ Fast-tracking call ${callSid} - agent ${validatedAgent.agentId} available`);
      
      // Add to queue
      const queuePosition = await queueService.enqueueCall(callInfo);
      
      // Immediately dequeue for assignment
      const queuedCall = await queueService.dequeueNextCall();
      
      if (queuedCall) {
        // Mark as assigned to the available agent
        await prisma.inboundCallQueue.update({
          where: { id: queuedCall.id },
          data: {
            status: 'connecting',
            assignedToAgentId: validatedAgent.agentId,
            assignedAt: new Date()
          }
        });

        // Generate immediate connection TwiML
        return await generateQueuedCallTwiML(queuedCall, validatedAgent, firstName);
      }
    }

    // No immediate agent available - enter queue with hold music
    console.log(`📋 Adding call ${callSid} to queue - no immediate agent available`);
    
    const queuePosition = await queueService.enqueueCall(callInfo);
    
    console.log(`📍 Call ${callSid} queued at position ${queuePosition.position}, estimated wait: ${queuePosition.estimatedWaitSeconds}s`);

    // Generate queue entry TwiML with welcome message and hold music
    return await generateQueueEntryTwiML(firstName, callerName, queuePosition);

  } catch (error) {
    console.error('❌ Queue routing failed, falling back to legacy routing:', error);
    
    // Fallback to legacy routing on any queue error
    const callSession = await createCallSession(userId, callerInfo, from, callSid, validatedAgent);
    
    if (validatedAgent) {
      return await routeCallToAgent(from, callSid, firstName, callerName, callerInfo, validatedAgent, callSession);
    } else {
      return await handleNoAgentsAvailable(from, firstName, callerName, userId, callSession);
    }
  }
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
    <Dial timeout="30" 
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
    <Dial timeout="30" action="${baseUrl}/api/webhooks/twilio/queue-handler">
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