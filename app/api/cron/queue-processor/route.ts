// =============================================================================
// Queue Processor Cron Job - High-Frequency Agent Assignment
// =============================================================================
// Runs every 10 seconds to process queue and assign calls to agents

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createInboundCallQueueService } from '@/modules/call-queue/services/inbound-call-queue.service';
import { createAgentPollingService } from '@/modules/agents/services/agent-polling.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';
import twilio from 'twilio';

// Twilio client for making agent calls
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Starting queue processor cron job...');

    // Check if queue features are enabled
    if (!INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE) {
      return NextResponse.json({
        success: false,
        message: 'Queue system is not enabled'
      });
    }

    const queueService = createInboundCallQueueService(prisma);
    const agentPollingService = createAgentPollingService(prisma);

    // Get queue statistics
    const queueStats = await queueService.getQueueStats();
    console.log('📊 Current queue stats:', queueStats);

    if (queueStats.totalInQueue === 0) {
      return NextResponse.json({
        success: true,
        message: 'No calls in queue to process',
        stats: queueStats
      });
    }

    // Process pending assignments
    const processingResults = await processPendingCalls(queueService, agentPollingService);

    console.log('✅ Queue processor completed', {
      processedCalls: processingResults.processedCalls,
      successfulAssignments: processingResults.successfulAssignments,
      failedAssignments: processingResults.failedAssignments,
      agentsAvailable: processingResults.agentsAvailable,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Queue processing completed',
      results: processingResults,
      stats: queueStats
    });

  } catch (error) {
    console.error('❌ Queue processor cron job failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Queue processing failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Process all pending calls in queue and attempt agent assignments
 */
async function processPendingCalls(
  queueService: any, 
  agentPollingService: any
): Promise<{
  processedCalls: number;
  successfulAssignments: number;
  failedAssignments: number;
  agentsAvailable: number;
  timeoutHandled: number;
}> {
  const results = {
    processedCalls: 0,
    successfulAssignments: 0,
    failedAssignments: 0,
    agentsAvailable: 0,
    timeoutHandled: 0
  };

  try {
    // Get available agents first
    const availableAgents = await agentPollingService.getAvailableAgents();
    results.agentsAvailable = availableAgents.length;

    console.log(`👥 Found ${availableAgents.length} available agents for queue processing`);

    if (availableAgents.length === 0) {
      console.log('📭 No agents available - calls will wait indefinitely');
      // Don't handle timeouts when no agents are available
      // Calls should wait until agents come online
      return results;
    }

    // Get calls waiting for assignment
    const waitingCalls = await prisma.inboundCallQueue.findMany({
      where: {
        status: { in: ['waiting', 'assigned'] },
        maxWaitReached: false
      },
      orderBy: [
        { priorityScore: 'desc' },
        { queuePosition: 'asc' },
        { enteredQueueAt: 'asc' }
      ],
      take: 10 // Process up to 10 calls per cycle
    });

    console.log(`📋 Processing ${waitingCalls.length} calls from queue`);

    for (const call of waitingCalls) {
      results.processedCalls++;

      try {
        // Check if call has been waiting too long - but only timeout if agents are available
        const waitTimeSeconds = Math.floor((Date.now() - call.enteredQueueAt.getTime()) / 1000);
        const maxWaitTime = INBOUND_CALL_FLAGS.MAX_QUEUE_WAIT_TIME;

        // Only timeout calls if:
        // 1. They've exceeded max wait time AND
        // 2. Agents are available (indicating a system issue, not just no agents)
        if (waitTimeSeconds > maxWaitTime && availableAgents.length > 0) {
          console.log(`⏰ Call ${call.twilioCallSid} exceeded max wait time (${waitTimeSeconds}s > ${maxWaitTime}s) with agents available`);
          await handleCallTimeout(call, queueService);
          results.timeoutHandled++;
          continue;
        }

        // If no agents available, let calls wait indefinitely
        if (availableAgents.length === 0) {
          console.log(`📞 Call ${call.twilioCallSid} waiting indefinitely (${waitTimeSeconds}s) - no agents available`);
          continue; // Keep waiting, don't timeout
        }

        // Skip calls that were recently assigned (give time for agent response)
        if (call.status === 'assigned' && call.assignedAt) {
          const assignedAgo = Date.now() - call.assignedAt.getTime();
          if (assignedAgo < 30000) { // 30 seconds grace period
            console.log(`⏳ Call ${call.twilioCallSid} recently assigned, waiting for agent response`);
            continue;
          }
        }

        // Find best available agent (excluding recent attempts)
        const excludeAgents = call.lastAttemptAgentId ? [call.lastAttemptAgentId] : [];
        const bestAgent = await agentPollingService.findBestAgent(excludeAgents);

        if (!bestAgent) {
          console.log(`📭 No available agent for call ${call.twilioCallSid}`);
          results.failedAssignments++;
          continue;
        }

        // Attempt assignment
        const assignment = await agentPollingService.assignQueuedCall(
          call.id, 
          bestAgent, 
          call.attemptsCount + 1
        );

        if (assignment) {
          // Trigger actual Twilio call to agent
          const callResult = await makeAgentCall(call, bestAgent);
          
          if (callResult.success) {
            console.log(`✅ Successfully initiated call to agent ${bestAgent.agentId} for ${call.twilioCallSid}`);
            results.successfulAssignments++;
          } else {
            console.log(`❌ Failed to initiate call to agent ${bestAgent.agentId}: ${callResult.error}`);
            results.failedAssignments++;
            
            // Mark assignment as failed and return to queue
            await prisma.inboundCallQueue.update({
              where: { id: call.id },
              data: {
                status: 'waiting',
                assignedToAgentId: null,
                assignedAt: null
              }
            });
          }
        } else {
          results.failedAssignments++;
        }

      } catch (callError) {
        console.error(`❌ Error processing call ${call.id}:`, callError);
        results.failedAssignments++;
      }
    }

    // Handle any timeout calls that weren't processed
    results.timeoutHandled += await handleQueueTimeouts(queueService);

    return results;

  } catch (error) {
    console.error('❌ Error in processPendingCalls:', error);
    throw error;
  }
}

/**
 * Make actual Twilio call to assigned agent
 */
async function makeAgentCall(queuedCall: any, agent: any): Promise<{ success: boolean; error?: string; callSid?: string }> {
  try {
    const agentClientName = `agent_${agent.agentId}`;
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';

    console.log(`📱 Making Twilio call to agent ${agent.agentId} (${agentClientName}) for queued call ${queuedCall.twilioCallSid}`);

    // Create TwiML for connecting the queued caller to the agent
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Connecting you to an available agent. Please hold.</Say>
    <Dial timeout="30" 
          record="record-from-answer" 
          recordingStatusCallback="${baseUrl}/api/webhooks/twilio/recording"
          statusCallback="${baseUrl}/api/webhooks/twilio/call-status"
          statusCallbackEvent="initiated ringing answered completed busy no-answer failed"
          statusCallbackMethod="POST"
          action="${baseUrl}/api/webhooks/twilio/queue-handler">
        <Client>
            <Identity>${agentClientName}</Identity>
            <Parameter name="queuedCallId" value="${queuedCall.id}" />
            <Parameter name="originalCallSid" value="${queuedCall.twilioCallSid}" />
            <Parameter name="callerPhone" value="${queuedCall.callerPhone}" />
            <Parameter name="callerName" value="${queuedCall.callerName || ''}" />
            <Parameter name="userId" value="${queuedCall.userId || ''}" />
            <Parameter name="queuePosition" value="${queuedCall.queuePosition || ''}" />
        </Client>
    </Dial>
    <Redirect>${baseUrl}/api/webhooks/twilio/queue-handler</Redirect>
</Response>`;

    // Update the original queued call with the connection TwiML
    const call = await twilioClient.calls(queuedCall.twilioCallSid).update({
      twiml: twiml
    });

    // Update queue status
    await prisma.inboundCallQueue.update({
      where: { id: queuedCall.id },
      data: {
        status: 'connecting',
        lastAttemptAt: new Date()
      }
    });

    console.log(`✅ Twilio call updated for ${queuedCall.twilioCallSid}, now connecting to agent ${agent.agentId}`);

    return {
      success: true,
      callSid: call.sid
    };

  } catch (error) {
    console.error(`❌ Failed to make agent call:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handle calls that have exceeded maximum wait time
 */
async function handleCallTimeout(call: any, queueService: any): Promise<void> {
  try {
    console.log(`⏰ Handling timeout for call ${call.twilioCallSid}`);

    // Mark as max wait reached
    await prisma.inboundCallQueue.update({
      where: { id: call.id },
      data: {
        maxWaitReached: true,
        status: 'abandoned',
        abandonedAt: new Date()
      }
    });

    // Offer callback or end call
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';
    
    if (!call.callbackOffered && INBOUND_CALL_FLAGS.CALLBACK_REQUEST_SYSTEM) {
      // Offer callback option
      const callbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="dtmf" timeout="10" numDigits="1" action="${baseUrl}/api/webhooks/twilio/callback-response">
        <Say voice="alice">You've been waiting longer than usual. Press 1 to request a callback, or stay on the line.</Say>
    </Gather>
    <Say voice="alice">Thank you for holding. We'll have someone call you back as soon as possible.</Say>
    <Hangup/>
</Response>`;

      await twilioClient.calls(call.twilioCallSid).update({ twiml: callbackTwiml });
      
      await prisma.inboundCallQueue.update({
        where: { id: call.id },
        data: { callbackOffered: true }
      });

    } else {
      // End call with apology
      const apologyTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">We apologize for the long wait. All our agents are currently busy. We'll call you back as soon as possible. Thank you!</Say>
    <Hangup/>
</Response>`;

      await twilioClient.calls(call.twilioCallSid).update({ twiml: apologyTwiml });
    }

    console.log(`✅ Timeout handled for call ${call.twilioCallSid}`);

  } catch (error) {
    console.error(`❌ Error handling call timeout for ${call.id}:`, error);
  }
}

/**
 * Handle all calls that have exceeded timeout - but only when agents are available
 * This prevents timing out calls when the issue is simply no agents online
 */
async function handleQueueTimeouts(queueService: any): Promise<number> {
  try {
    // Only timeout calls if agents are currently available
    // This prevents abandoning calls when the issue is just no agents online
    const agentPollingService = createAgentPollingService(prisma);
    const availableAgents = await agentPollingService.getAvailableAgents();
    
    if (availableAgents.length === 0) {
      console.log('📭 No timeout handling - no agents available, calls should wait indefinitely');
      return 0;
    }

    const maxWaitTime = INBOUND_CALL_FLAGS.MAX_QUEUE_WAIT_TIME;
    const timeoutThreshold = new Date(Date.now() - maxWaitTime * 1000);

    const timeoutCalls = await prisma.inboundCallQueue.findMany({
      where: {
        status: { in: ['waiting', 'assigned'] },
        enteredQueueAt: { lt: timeoutThreshold },
        maxWaitReached: false
      }
    });

    let handledCount = 0;
    for (const call of timeoutCalls) {
      console.log(`⏰ Timing out call ${call.twilioCallSid} - agents available but call not assigned after ${maxWaitTime}s`);
      await handleCallTimeout(call, queueService);
      handledCount++;
    }

    if (handledCount > 0) {
      console.log(`⏰ Handled ${handledCount} timeout calls (agents were available)`);
    }

    return handledCount;

  } catch (error) {
    console.error('❌ Error handling queue timeouts:', error);
    return 0;
  }
}