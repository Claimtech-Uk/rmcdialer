// =============================================================================
// Multi-Agent Fallback Service - Agent Management Module
// =============================================================================
// Handles intelligent fallback when primary agent assignments fail

import { PrismaClient } from '@prisma/client';
import { logger } from '@/modules/core';
import { createInboundCallQueueService } from '@/modules/call-queue/services/inbound-call-queue.service';
import { createAgentPollingService, AvailableAgent } from '@/modules/agents/services/agent-polling.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

interface MultiAgentFallbackDependencies {
  prisma: PrismaClient;
  logger: typeof logger;
}

export interface FallbackAttempt {
  attemptNumber: number;
  agentId: number;
  startTime: Date;
  endTime?: Date;
  status: 'attempting' | 'successful' | 'failed' | 'timeout';
  failureReason?: string;
  responseTimeMs?: number;
}

export interface FallbackStrategy {
  maxAttempts: number;
  attemptTimeoutMs: number;
  cooldownBetweenAttemptsMs: number;
  prioritizeByReadinessScore: boolean;
  allowSameAgentRetry: boolean;
  escalationThreshold: number; // After this many failures, escalate
}

export interface FallbackResult {
  success: boolean;
  finalAgentId?: number;
  totalAttempts: number;
  totalTimeMs: number;
  attempts: FallbackAttempt[];
  escalated: boolean;
  failureReason?: string;
}

export class MultiAgentFallbackService {
  private readonly defaultStrategy: FallbackStrategy = {
    maxAttempts: 3,
    attemptTimeoutMs: 600000, // 10 minutes per agent attempt (generous timeout)
    cooldownBetweenAttemptsMs: 2000, // 2 seconds between attempts
    prioritizeByReadinessScore: true,
    allowSameAgentRetry: false,
    escalationThreshold: 2 // Escalate after 2 failed attempts
  };

  constructor(private deps: MultiAgentFallbackDependencies) {}

  /**
   * Execute multi-agent fallback for a queued call
   */
  async executeFallback(
    queuedCallId: string,
    excludeAgentIds: number[] = [],
    customStrategy?: Partial<FallbackStrategy>
  ): Promise<FallbackResult> {
    try {
      const strategy = { ...this.defaultStrategy, ...customStrategy };
      const startTime = Date.now();
      
      console.log(`🔄 Starting multi-agent fallback for call ${queuedCallId}`, {
        excludeAgents: excludeAgentIds,
        strategy
      });

      // Get queue and polling services
      const queueService = createInboundCallQueueService(this.deps.prisma);
      const agentPollingService = createAgentPollingService(this.deps.prisma);

      // Get the queued call details
      const queuedCall = await this.deps.prisma.inboundCallQueue.findUnique({
        where: { id: queuedCallId }
      });

      if (!queuedCall) {
        throw new Error(`Queued call ${queuedCallId} not found`);
      }

      const fallbackResult: FallbackResult = {
        success: false,
        totalAttempts: 0,
        totalTimeMs: 0,
        attempts: [],
        escalated: false
      };

      // Track excluded agents (cumulative)
      const allExcludedAgents = new Set(excludeAgentIds);

      for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
        fallbackResult.totalAttempts = attempt;

        console.log(`🎯 Fallback attempt ${attempt}/${strategy.maxAttempts} for call ${queuedCallId}`);

        // Find next best agent
        const availableAgent = await agentPollingService.findBestAgent(Array.from(allExcludedAgents));

        if (!availableAgent) {
          console.log(`📭 No more agents available for attempt ${attempt}`);
          fallbackResult.failureReason = 'No available agents';
          break;
        }

        // Create attempt record
        const attemptRecord: FallbackAttempt = {
          attemptNumber: attempt,
          agentId: availableAgent.agentId,
          startTime: new Date(),
          status: 'attempting'
        };

        fallbackResult.attempts.push(attemptRecord);

        try {
          console.log(`📞 Attempting assignment to agent ${availableAgent.agentId} (attempt ${attempt})`);

          // Attempt the assignment
          const assignmentResult = await this.attemptAgentAssignment(
            queuedCall,
            availableAgent,
            strategy.attemptTimeoutMs,
            attempt
          );

          attemptRecord.endTime = new Date();
          attemptRecord.responseTimeMs = attemptRecord.endTime.getTime() - attemptRecord.startTime.getTime();

          if (assignmentResult.success) {
            // Success!
            attemptRecord.status = 'successful';
            fallbackResult.success = true;
            fallbackResult.finalAgentId = availableAgent.agentId;

            console.log(`✅ Fallback successful on attempt ${attempt} with agent ${availableAgent.agentId}`);
            break;

          } else {
            // Failed - record failure and continue
            attemptRecord.status = 'failed';
            attemptRecord.failureReason = assignmentResult.failureReason;
            
            console.log(`❌ Attempt ${attempt} failed: ${assignmentResult.failureReason}`);

            // Add agent to exclusion list
            if (!strategy.allowSameAgentRetry) {
              allExcludedAgents.add(availableAgent.agentId);
            }

            // Check if we should escalate
            if (attempt >= strategy.escalationThreshold && !fallbackResult.escalated) {
              console.log(`🚨 Escalating after ${attempt} failed attempts`);
              await this.escalateCall(queuedCall, fallbackResult.attempts);
              fallbackResult.escalated = true;
            }
          }

        } catch (attemptError) {
          console.error(`❌ Error in fallback attempt ${attempt}:`, attemptError);
          
          attemptRecord.status = 'failed';
          attemptRecord.failureReason = attemptError instanceof Error ? attemptError.message : 'Unknown error';
          attemptRecord.endTime = new Date();
          attemptRecord.responseTimeMs = attemptRecord.endTime.getTime() - attemptRecord.startTime.getTime();

          // Add agent to exclusion list
          allExcludedAgents.add(availableAgent.agentId);
        }

        // Cooldown between attempts (except on last attempt)
        if (attempt < strategy.maxAttempts) {
          console.log(`⏳ Waiting ${strategy.cooldownBetweenAttemptsMs}ms before next attempt`);
          await this.sleep(strategy.cooldownBetweenAttemptsMs);
        }
      }

      fallbackResult.totalTimeMs = Date.now() - startTime;

      // Log final result
      if (fallbackResult.success) {
        this.deps.logger.info('✅ Multi-agent fallback completed successfully', {
          queuedCallId,
          finalAgentId: fallbackResult.finalAgentId,
          totalAttempts: fallbackResult.totalAttempts,
          totalTimeMs: fallbackResult.totalTimeMs
        });
      } else {
        this.deps.logger.warn('❌ Multi-agent fallback failed', {
          queuedCallId,
          totalAttempts: fallbackResult.totalAttempts,
          totalTimeMs: fallbackResult.totalTimeMs,
          failureReason: fallbackResult.failureReason
        });

        // If all attempts failed, handle final fallback
        await this.handleFinalFallback(queuedCall, fallbackResult);
      }

      return fallbackResult;

    } catch (error) {
      this.deps.logger.error('❌ Multi-agent fallback error', {
        queuedCallId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        totalAttempts: 0,
        totalTimeMs: 0,
        attempts: [],
        escalated: false,
        failureReason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Attempt assignment to a specific agent with timeout
   */
  private async attemptAgentAssignment(
    queuedCall: any,
    agent: AvailableAgent,
    timeoutMs: number,
    attemptNumber: number
  ): Promise<{ success: boolean; failureReason?: string }> {
    try {
      console.log(`📞 Assigning call ${queuedCall.id} to agent ${agent.agentId} (timeout: ${timeoutMs}ms)`);

      // Update queue with assignment
      await this.deps.prisma.inboundCallQueue.update({
        where: { id: queuedCall.id },
        data: {
          status: 'assigned',
          assignedToAgentId: agent.agentId,
          assignedAt: new Date(),
          attemptsCount: attemptNumber,
          lastAttemptAt: new Date(),
          lastAttemptAgentId: agent.agentId
        }
      });

      // Simulate agent call attempt (in real implementation, this would trigger Twilio call)
      const callResult = await this.makeAgentCallWithTimeout(queuedCall, agent, timeoutMs);

      if (callResult.success) {
        // Mark as connecting
        await this.deps.prisma.inboundCallQueue.update({
          where: { id: queuedCall.id },
          data: {
            status: 'connecting',
            connectedAt: new Date()
          }
        });

        return { success: true };
      } else {
        // Reset assignment on failure
        await this.deps.prisma.inboundCallQueue.update({
          where: { id: queuedCall.id },
          data: {
            status: 'waiting',
            assignedToAgentId: null,
            assignedAt: null
          }
        });

        return { 
          success: false, 
          failureReason: callResult.failureReason 
        };
      }

    } catch (error) {
      console.error(`❌ Agent assignment error:`, error);
      return { 
        success: false, 
        failureReason: error instanceof Error ? error.message : 'Assignment error' 
      };
    }
  }

  /**
   * Make agent call with timeout protection
   */
  private async makeAgentCallWithTimeout(
    queuedCall: any,
    agent: AvailableAgent,
    timeoutMs: number
  ): Promise<{ success: boolean; failureReason?: string }> {
    try {
      // This would integrate with the queue processor's makeAgentCall function
      // For now, simulate the call attempt
      
      console.log(`📱 Making agent call with ${timeoutMs}ms timeout`);

      // Simulate agent response time based on their availability
      const simulatedResponseTime = this.calculateSimulatedResponseTime(agent);
      
      if (simulatedResponseTime > timeoutMs) {
        return { 
          success: false, 
          failureReason: 'Agent response timeout' 
        };
      }

      // Simulate waiting for agent response
      await this.sleep(Math.min(simulatedResponseTime, 1000)); // Cap simulation at 1s

      // Simulate success/failure based on agent readiness
      const successProbability = agent.readinessScore / 100;
      const isSuccessful = Math.random() < successProbability;

      if (isSuccessful) {
        console.log(`✅ Agent ${agent.agentId} answered successfully`);
        return { success: true };
      } else {
        const failureReasons = [
          'Agent did not answer',
          'Agent device offline',
          'Agent busy with another call',
          'Network connectivity issue'
        ];
        const failureReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
        
        console.log(`❌ Agent ${agent.agentId} call failed: ${failureReason}`);
        return { success: false, failureReason };
      }

    } catch (error) {
      return { 
        success: false, 
        failureReason: error instanceof Error ? error.message : 'Call error' 
      };
    }
  }

  /**
   * Escalate call to supervisors or management
   */
  private async escalateCall(queuedCall: any, attempts: FallbackAttempt[]): Promise<void> {
    try {
      console.log(`🚨 Escalating call ${queuedCall.id} after failed attempts`);

      // Update queue with escalation status
      await this.deps.prisma.inboundCallQueue.update({
        where: { id: queuedCall.id },
        data: {
          metadata: JSON.stringify({
            escalated: true,
            escalatedAt: new Date().toISOString(),
            failedAttempts: attempts.length,
            originalMetadata: queuedCall.metadata
          })
        }
      });

      // Here you could:
      // 1. Send alerts to supervisors
      // 2. Move to priority queue
      // 3. Trigger emergency callback protocols
      // 4. Send notifications to management

      this.deps.logger.warn('🚨 Call escalated due to repeated assignment failures', {
        queuedCallId: queuedCall.id,
        callerPhone: queuedCall.callerPhone,
        failedAttempts: attempts.length
      });

    } catch (error) {
      this.deps.logger.error('❌ Failed to escalate call', {
        queuedCallId: queuedCall.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle final fallback when all agent attempts fail
   */
  private async handleFinalFallback(queuedCall: any, fallbackResult: FallbackResult): Promise<void> {
    try {
      console.log(`🔄 Handling final fallback for call ${queuedCall.id}`);

      // Offer callback if enabled
      if (INBOUND_CALL_FLAGS.CALLBACK_REQUEST_SYSTEM && !queuedCall.callbackOffered) {
        await this.offerCallback(queuedCall);
      } else {
        // Mark as abandoned with apology
        await this.deps.prisma.inboundCallQueue.update({
          where: { id: queuedCall.id },
          data: {
            status: 'abandoned',
            abandonedAt: new Date(),
            metadata: JSON.stringify({
              abandonReason: 'multi_agent_fallback_failed',
              fallbackAttempts: fallbackResult.totalAttempts,
              totalFallbackTimeMs: fallbackResult.totalTimeMs
            })
          }
        });
      }

    } catch (error) {
      this.deps.logger.error('❌ Failed to handle final fallback', {
        queuedCallId: queuedCall.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Offer callback to caller
   */
  private async offerCallback(queuedCall: any): Promise<void> {
    console.log(`📞 Offering callback to caller ${queuedCall.callerPhone}`);

    await this.deps.prisma.inboundCallQueue.update({
      where: { id: queuedCall.id },
      data: {
        callbackOffered: true,
        status: 'callback_offered'
      }
    });

    // This would trigger callback TwiML (handled by queue processor)
  }

  // Helper methods

  private calculateSimulatedResponseTime(agent: AvailableAgent): number {
    // Simulate response time based on agent readiness
    const baseTime = 5000; // 5 seconds base
    const readinessFactor = (100 - agent.readinessScore) / 100;
    return baseTime + (readinessFactor * 15000); // Up to 20s for poor readiness
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get fallback statistics for monitoring
   */
  async getFallbackStats(timeRangeHours: number = 24): Promise<{
    totalFallbacks: number;
    successfulFallbacks: number;
    escalatedCalls: number;
    averageAttempts: number;
    averageTimeMs: number;
  }> {
    try {
      const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

      const fallbackCalls = await this.deps.prisma.inboundCallQueue.findMany({
        where: {
          attemptsCount: { gt: 1 },
          updatedAt: { gte: since }
        },
        select: {
          attemptsCount: true,
          status: true,
          enteredQueueAt: true,
          connectedAt: true,
          abandonedAt: true,
          metadata: true
        }
      });

      const totalFallbacks = fallbackCalls.length;
      const successfulFallbacks = fallbackCalls.filter(call => 
        call.status === 'connected' || call.status === 'completed'
      ).length;

      const escalatedCalls = fallbackCalls.filter(call => {
        if (!call.metadata) return false;
        try {
          const metadata = JSON.parse(String(call.metadata));
          return metadata.escalated === true;
        } catch {
          return false;
        }
      }).length;

      const totalAttempts = fallbackCalls.reduce((sum, call) => sum + call.attemptsCount, 0);
      const averageAttempts = totalFallbacks > 0 ? totalAttempts / totalFallbacks : 0;

      const totalTime = fallbackCalls.reduce((sum, call) => {
        const endTime = call.connectedAt || call.abandonedAt;
        if (!endTime) return sum;
        return sum + (endTime.getTime() - call.enteredQueueAt.getTime());
      }, 0);
      const averageTimeMs = totalFallbacks > 0 ? totalTime / totalFallbacks : 0;

      return {
        totalFallbacks,
        successfulFallbacks,
        escalatedCalls,
        averageAttempts,
        averageTimeMs
      };

    } catch (error) {
      this.deps.logger.error('❌ Failed to get fallback stats', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        totalFallbacks: 0,
        successfulFallbacks: 0,
        escalatedCalls: 0,
        averageAttempts: 0,
        averageTimeMs: 0
      };
    }
  }
}

// Factory function for dependency injection
export function createMultiAgentFallbackService(prisma: PrismaClient): MultiAgentFallbackService {
  return new MultiAgentFallbackService({
    prisma,
    logger
  });
}