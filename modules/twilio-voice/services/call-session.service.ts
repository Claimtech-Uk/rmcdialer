import { prisma } from '@/lib/db';
import { CallOutcomeManager } from '@/modules/call-outcomes/services/call-outcome-manager.service';
import { NameInfo } from '../types/twilio-voice.types';

/**
 * Create missed call session with proper outcome logging
 * Handles both known and unknown callers
 */
export async function createMissedCallSession(
  from: string, 
  callSid: string, 
  nameInfo: NameInfo | null,
  reason: 'out_of_hours' | 'no_agents_available' | 'agents_busy' | 'handler_error'
): Promise<string> {
  try {
    let userId = nameInfo?.userId || null;
    const callerName = nameInfo ? `${nameInfo.firstName} ${nameInfo.lastName}` : 'Unknown Caller';
    
    console.log(`📝 Creating missed call session for ${callerName} (${from}) - Reason: ${reason}`);
    
    // If no known user, use special ID for unknown callers
    if (!userId) {
      userId = 999999; // Special ID for unknown callers - user may or may not exist in replica
      console.log(`📱 Using special unknown caller ID: ${userId} for ${from}`);
    }
    
    // Ensure a corresponding user_call_scores row exists to satisfy FK constraint
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
    
    // Create call queue entry for missed call
    const missedCallQueue = await prisma.callQueue.create({
      data: {
        userId: BigInt(userId),
        queueType: 'inbound_call',
        priorityScore: 0,
        status: 'missed',
        queueReason: `Missed call: ${
          reason === 'out_of_hours' ? 'Called outside business hours' : 
          reason === 'agents_busy' ? 'All agents busy' :
          reason === 'handler_error' ? 'System error' :
          'No agents available'
        }`,
        assignedToAgentId: null,
        assignedAt: null,
      }
    });

    // Find a valid agent ID for tracking purposes
    const fallbackAgent = await prisma.agent.findFirst({
      where: { isActive: true },
      select: { id: true }
    });

    if (!fallbackAgent) {
      throw new Error('No valid agents found for missed call tracking');
    }

    // Create call session with missed call status
    const callSession = await prisma.callSession.create({
      data: {
        userId: BigInt(userId),
        agentId: fallbackAgent.id,
        callQueueId: missedCallQueue.id,
        twilioCallSid: callSid,
        status: 'missed_call',
        direction: 'inbound',
        startedAt: new Date(),
        endedAt: new Date(), // Immediate end for missed calls
        callSource: 'inbound',
        userClaimsContext: JSON.stringify({
          callerName,
          phoneNumber: from,
          missedCallReason: reason,
          lookupStatus: 'complete',
          outcome: 'missed_call',
          outcomeNotes: 
            reason === 'out_of_hours' ? 'Called outside business hours' : 
            reason === 'agents_busy' ? 'All agents busy during business hours' :
            reason === 'handler_error' ? 'System error occurred' :
            'No agents available'
        })
      }
    });

    // Apply missed call outcome using CallOutcomeManager
    try {
      const outcomeManager = new CallOutcomeManager();
      const outcomeContext = {
        sessionId: callSession.id,
        userId: Number(userId),
        agentId: fallbackAgent.id,
        callDurationSeconds: 0,
        callStartedAt: callSession.startedAt,
        previousOutcomes: [] // Could be enhanced to get actual previous outcomes
      };

      const outcomeResult = await outcomeManager.processOutcome(
        'missed_call',
        outcomeContext,
        { 
          notes: 
            reason === 'out_of_hours' ? 'Called outside business hours' : 
            reason === 'agents_busy' ? 'All agents busy during business hours' :
            reason === 'handler_error' ? 'System error occurred during call processing' :
            'No agents available',
          missedCallTime: new Date().toISOString() // Required field for missed call validation
        }
      );

      console.log(`✅ Applied missed call outcome to session ${callSession.id}:`, {
        scoreAdjustment: outcomeResult.scoreAdjustment,
        nextCallDelayHours: outcomeResult.nextCallDelayHours,
        callbackDateTime: outcomeResult.callbackDateTime
      });

      // Create callback if the outcome result includes callback information
      if (outcomeResult.callbackDateTime) {
        try {
          const callback = await prisma.callback.create({
            data: {
              userId: BigInt(userId),
              scheduledFor: outcomeResult.callbackDateTime,
              callbackReason: outcomeResult.callbackReason || `Return missed call from ${reason === 'out_of_hours' ? 'out of hours' : 'when agents unavailable'}`,
              originalCallSessionId: callSession.id,
              status: 'pending',
            },
          });
          console.log(`📞 Created callback for ${outcomeResult.callbackDateTime.toISOString()} for missed call session ${callSession.id}`);
        } catch (callbackError) {
          console.error(`⚠️ Failed to create callback for missed call session ${callSession.id}:`, callbackError);
        }
      }
    } catch (outcomeError) {
      console.error(`⚠️ Failed to apply missed call outcome to session ${callSession.id}:`, outcomeError);
      // Continue anyway - the session is still created
    }

    console.log(`✅ Created missed call session ${callSession.id} for ${callerName} - Reason: ${reason}`);
    return callSession.id;

  } catch (error) {
    console.error(`❌ Failed to create missed call session for ${from}:`, error);
    throw error;
  }
} 