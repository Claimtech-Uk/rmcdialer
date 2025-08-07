// =============================================================================
// Agent Polling Service - Agent Management Module
// =============================================================================
// Continuously monitors agent availability and assigns queued calls

import { PrismaClient } from '@prisma/client';
import { logger } from '@/modules/core';
import { createInboundCallQueueService } from '@/modules/call-queue/services/inbound-call-queue.service';
import { createDeviceConnectivityService } from '@/modules/twilio-voice/services/device-connectivity.service';
import { createAgentHeartbeatService } from '@/modules/agents/services/agent-heartbeat.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

interface AgentPollingDependencies {
  prisma: PrismaClient;
  logger: typeof logger;
}

export interface AvailableAgent {
  agentId: number;
  agentSessionId: string;
  lastActivity: Date;
  lastHeartbeat?: Date;
  deviceConnected: boolean;
  maxConcurrentCalls: number;
  currentCalls: number;
  readinessScore: number;
  availability: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentAssignment {
  queuedCallId: string;
  assignedAgentId: number;
  assignmentReason: string;
  estimatedResponseTime: number;
  fallbackAgentsAvailable: number;
}

export class AgentPollingService {
  private isPolling = false;
  private pollingInterval?: NodeJS.Timeout;
  private readonly POLLING_INTERVAL_MS: number;
  private readonly MAX_ASSIGNMENT_ATTEMPTS = 3;
  private readonly READINESS_THRESHOLD = INBOUND_CALL_FLAGS.AGENT_READINESS_THRESHOLD; // Use shared threshold

  constructor(private deps: AgentPollingDependencies) {
    this.POLLING_INTERVAL_MS = (INBOUND_CALL_FLAGS.QUEUE_POLLING_INTERVAL || 10) * 1000;
    console.log('🔄 AgentPollingService initialized', {
      pollingIntervalMs: this.POLLING_INTERVAL_MS,
      readinessThreshold: this.READINESS_THRESHOLD
    });
  }

  /**
   * Start continuous agent polling for queue processing
   */
  startPolling(): void {
    if (this.isPolling) {
      this.deps.logger.warn('Agent polling is already running');
      return;
    }

    this.isPolling = true;
    this.deps.logger.info('🔄 Starting continuous agent polling', {
      intervalMs: this.POLLING_INTERVAL_MS
    });

    // Start immediate polling cycle
    this.processPendingAssignments();

    // Set up recurring polling
    this.pollingInterval = setInterval(() => {
      this.processPendingAssignments();
    }, this.POLLING_INTERVAL_MS);
  }

  /**
   * Stop continuous agent polling
   */
  stopPolling(): void {
    if (!this.isPolling) {
      this.deps.logger.warn('Agent polling is not running');
      return;
    }

    this.isPolling = false;
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    this.deps.logger.info('⏹️ Stopped continuous agent polling');
  }

  /**
   * Get all currently available agents with readiness scores
   */
  async getAvailableAgents(): Promise<AvailableAgent[]> {
    try {
      const deviceConnectivityService = createDeviceConnectivityService(this.deps.prisma);
      const heartbeatService = createAgentHeartbeatService(this.deps.prisma);

      // Get basic available agents
      const agentSessions = await this.deps.prisma.agentSession.findMany({
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
              isActive: true
            }
          }
        },
        orderBy: { lastActivity: 'desc' }
      });

      if (agentSessions.length === 0) {
        return [];
      }

      console.log(`🔍 Found ${agentSessions.length} basic available agents, validating readiness...`);

      // Enhance with readiness validation
      const availableAgents: AvailableAgent[] = [];

      for (const session of agentSessions) {
        try {
          // 🎯 FINAL BOSS: Enhanced validation with heartbeat + device connectivity
          const readiness = await deviceConnectivityService.validateAgentReadiness(session.agentId);
          
          // 🎯 FINAL BOSS: Additional heartbeat validation for double-checking
          const heartbeatValidation = await heartbeatService.validateAgentHeartbeat(session.agentId);
          
          // Get current call count
          const currentCalls = await this.getCurrentCallCount(session.agentId);
          
          // Determine availability level
          let availability: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
          if (readiness.readinessScore >= 90 && heartbeatValidation.isValid) availability = 'excellent';
          else if (readiness.readinessScore >= 80 && heartbeatValidation.isValid) availability = 'good';
          else if (readiness.readinessScore >= 70 && heartbeatValidation.isValid) availability = 'fair';

          // 🎯 FINAL BOSS: Only include agents that pass BOTH validations
          if (readiness.isReady && heartbeatValidation.isValid && readiness.readinessScore >= this.READINESS_THRESHOLD) {
            availableAgents.push({
              agentId: session.agentId,
              agentSessionId: session.id,
              lastActivity: session.lastActivity,
              lastHeartbeat: session.lastHeartbeat || undefined,
              deviceConnected: session.deviceConnected,
              maxConcurrentCalls: session.maxConcurrentCalls,
              currentCalls,
              readinessScore: readiness.readinessScore,
              availability
            });
          } else {
            if (INBOUND_CALL_FLAGS.INBOUND_CALL_DEBUG) {
              console.log(`❌ FINAL BOSS: Agent ${session.agentId} failed validation`, {
                deviceReady: readiness.isReady,
                readinessScore: readiness.readinessScore,
                threshold: this.READINESS_THRESHOLD,
                heartbeatValid: heartbeatValidation.isValid,
                heartbeatReason: heartbeatValidation.reason,
                heartbeatLastSeen: heartbeatValidation.lastHeartbeat?.toISOString()
              });
            }
          }

        } catch (agentError) {
          console.warn(`⚠️ Failed to validate agent ${session.agentId}:`, agentError);
        }
      }

      // Sort by readiness score and availability
      availableAgents.sort((a, b) => {
        // Prioritize by availability level, then by readiness score
        const availabilityOrder = { excellent: 4, good: 3, fair: 2, poor: 1 };
        const levelDiff = availabilityOrder[b.availability] - availabilityOrder[a.availability];
        
        if (levelDiff !== 0) return levelDiff;
        return b.readinessScore - a.readinessScore;
      });

      console.log(`✅ Found ${availableAgents.length} ready agents after validation`);
      return availableAgents;

    } catch (error) {
      this.deps.logger.error('Failed to get available agents', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * 🎯 ENHANCED: Find the best agent with comprehensive heartbeat validation
   */
  async findBestAgent(excludeAgentIds: number[] = []): Promise<AvailableAgent | null> {
    try {
      const availableAgents = await this.getAvailableAgents();
      
      // Filter out excluded agents and agents at capacity
      const eligibleAgents = availableAgents.filter(agent => 
        !excludeAgentIds.includes(agent.agentId) &&
        agent.currentCalls < agent.maxConcurrentCalls
      );

      if (eligibleAgents.length === 0) {
        console.log('📭 No eligible agents available for assignment');
        return null;
      }

      // 🎯 NEW: Comprehensive heartbeat validation for eligible agents
      const heartbeatService = createAgentHeartbeatService(this.deps.prisma);
      const agentIds = eligibleAgents.map(a => a.agentId);
      const heartbeatValidations = await heartbeatService.validateMultipleAgentHeartbeats(agentIds);

      // Filter agents by heartbeat validation
      const heartbeatValidAgents = eligibleAgents.filter(agent => {
        const validation = heartbeatValidations.get(agent.agentId);
        
        if (!validation?.isValid) {
          if (INBOUND_CALL_FLAGS.INBOUND_CALL_DEBUG) {
            console.log(`⚠️ Agent ${agent.agentId} excluded due to heartbeat validation: ${validation?.reason}`);
          }
          return false;
        }

        // Warn about agents close to timeout but still include them
        if (validation.timeoutWarning) {
          console.log(`⏰ Agent ${agent.agentId} has timeout warning but is still valid`);
        }

        return true;
      });

      if (heartbeatValidAgents.length === 0) {
        console.log('💔 No agents passed heartbeat validation - all agents may be experiencing connectivity issues');
        
        // Log detailed validation results for debugging
        if (INBOUND_CALL_FLAGS.INBOUND_CALL_DEBUG) {
          eligibleAgents.forEach(agent => {
            const validation = heartbeatValidations.get(agent.agentId);
            console.log(`  Agent ${agent.agentId}: ${validation?.isValid ? 'VALID' : 'INVALID'} - ${validation?.reason || 'No reason'}`);
          });
        }
        
        return null;
      }

      // Return the highest scoring heartbeat-validated agent
      const bestAgent = heartbeatValidAgents[0];
      const bestAgentValidation = heartbeatValidations.get(bestAgent.agentId);
      
      console.log(`🎯 Best agent selected (with heartbeat validation): ${bestAgent.agentId}`, {
        readinessScore: bestAgent.readinessScore,
        availability: bestAgent.availability,
        currentCalls: bestAgent.currentCalls,
        maxCalls: bestAgent.maxConcurrentCalls,
        heartbeatValid: bestAgentValidation?.isValid,
        lastHeartbeat: bestAgentValidation?.lastHeartbeat?.toISOString(),
        timeoutWarning: bestAgentValidation?.timeoutWarning,
        totalEligible: eligibleAgents.length,
        heartbeatValidCount: heartbeatValidAgents.length
      });

      return bestAgent;

    } catch (error) {
      this.deps.logger.error('Failed to find best agent with heartbeat validation', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Assign queued call to available agent
   */
  async assignQueuedCall(queuedCallId: string, agent: AvailableAgent, attemptNumber: number = 1): Promise<AgentAssignment | null> {
    try {
      console.log(`📞 Assigning queued call ${queuedCallId} to agent ${agent.agentId} (attempt ${attemptNumber})`);

      // Update queue entry with agent assignment
      const updatedCall = await this.deps.prisma.inboundCallQueue.update({
        where: { id: queuedCallId },
        data: {
          status: 'assigned',
          assignedToAgentId: agent.agentId,
          assignedAt: new Date(),
          attemptsCount: attemptNumber,
          lastAttemptAt: new Date(),
          lastAttemptAgentId: agent.agentId
        }
      });

      // Update agent session to indicate incoming assignment
      await this.deps.prisma.agentSession.update({
        where: { id: agent.agentSessionId },
        data: {
          lastActivity: new Date()
        }
      });

      // Calculate fallback agents available
      const availableAgents = await this.getAvailableAgents();
      const fallbackCount = availableAgents.filter(a => 
        a.agentId !== agent.agentId && 
        a.currentCalls < a.maxConcurrentCalls
      ).length;

      const assignment: AgentAssignment = {
        queuedCallId,
        assignedAgentId: agent.agentId,
        assignmentReason: `Selected based on readiness score ${agent.readinessScore} (${agent.availability})`,
        estimatedResponseTime: this.calculateEstimatedResponseTime(agent),
        fallbackAgentsAvailable: fallbackCount
      };

      this.deps.logger.info('✅ Call assignment completed', {
        queuedCallId,
        agentId: agent.agentId,
        attemptNumber,
        fallbackCount
      });

      return assignment;

    } catch (error) {
      this.deps.logger.error('Failed to assign queued call', {
        queuedCallId,
        agentId: agent.agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Process all pending queue assignments (main polling function)
   */
  private async processPendingAssignments(): Promise<void> {
    try {
      if (!INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE) {
        return; // Queue system disabled
      }

      const queueService = createInboundCallQueueService(this.deps.prisma);

      // Get next queued call waiting for assignment
      const nextCall = await queueService.dequeueNextCall();
      
      if (!nextCall) {
        if (INBOUND_CALL_FLAGS.INBOUND_CALL_DEBUG) {
          console.log('📋 No calls in queue waiting for assignment');
        }
        return;
      }

      console.log(`🔄 Processing queue assignment for call ${nextCall.twilioCallSid}`);

      // Get previously attempted agents to avoid reassignment
      const excludeAgentIds: number[] = [];
      if (nextCall.attemptsCount > 0 && nextCall.lastAttemptAgentId) {
        excludeAgentIds.push(nextCall.lastAttemptAgentId);
      }

      // Find best available agent
      const bestAgent = await this.findBestAgent(excludeAgentIds);

      if (!bestAgent) {
        console.log(`📭 No agents available for call ${nextCall.twilioCallSid}, keeping in queue`);
        
        // Return call to waiting status if no agent available
        await this.deps.prisma.inboundCallQueue.update({
          where: { id: nextCall.id },
          data: {
            status: 'waiting',
            assignedToAgentId: null,
            assignedAt: null
          }
        });
        return;
      }

      // Attempt assignment
      const assignment = await this.assignQueuedCall(
        nextCall.id, 
        bestAgent, 
        nextCall.attemptsCount + 1
      );

      if (assignment) {
        console.log(`✅ Successfully assigned call ${nextCall.twilioCallSid} to agent ${assignment.assignedAgentId}`);
        
        // Here we would trigger the actual Twilio call to the agent
        // This will be handled by the queue processor cron job
        await this.triggerAgentCall(nextCall, bestAgent);
      }

    } catch (error) {
      this.deps.logger.error('Error processing pending assignments', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Trigger actual Twilio call to assigned agent
   */
  private async triggerAgentCall(queuedCall: any, agent: AvailableAgent): Promise<void> {
    try {
      console.log(`📱 Triggering Twilio call to agent ${agent.agentId} for queued call ${queuedCall.twilioCallSid}`);
      
      // This will be implemented in the queue processor cron job
      // For now, just log the action
      console.log('🔄 Call assignment recorded, queue processor will handle Twilio connection');

    } catch (error) {
      this.deps.logger.error('Failed to trigger agent call', {
        queuedCallId: queuedCall.id,
        agentId: agent.agentId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Private helper methods

  private async getCurrentCallCount(agentId: number): Promise<number> {
    // Count active calls for this agent
    const activeCalls = await this.deps.prisma.callSession.count({
      where: {
        agentId,
        status: { in: ['ringing', 'in_progress'] }
      }
    });

    return activeCalls;
  }

  private calculateEstimatedResponseTime(agent: AvailableAgent): number {
    // Base response time on agent availability and current load
    let baseTime = 10; // seconds
    
    switch (agent.availability) {
      case 'excellent': baseTime = 5; break;
      case 'good': baseTime = 10; break;
      case 'fair': baseTime = 15; break;
      case 'poor': baseTime = 30; break;
    }

    // Adjust for current call load
    const loadFactor = agent.currentCalls / agent.maxConcurrentCalls;
    return Math.round(baseTime * (1 + loadFactor));
  }

  /**
   * Get polling status and statistics
   */
  getPollingStatus(): { isPolling: boolean; intervalMs: number; stats?: any } {
    return {
      isPolling: this.isPolling,
      intervalMs: this.POLLING_INTERVAL_MS
    };
  }
}

// Factory function for dependency injection
export function createAgentPollingService(prisma: PrismaClient): AgentPollingService {
  return new AgentPollingService({
    prisma,
    logger
  });
}