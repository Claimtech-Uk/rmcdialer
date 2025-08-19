// =============================================================================
// Inbound Call Queue Service - Call Queue Module
// =============================================================================
// Manages queue-based call holding with position tracking and wait time estimation

import { PrismaClient, Prisma } from '@prisma/client';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

// Simple logger interface to avoid winston import issues
interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
}

// Dependencies that will be injected
interface InboundCallQueueDependencies {
  prisma: PrismaClient;
  logger: Logger;
}

export interface InboundCallInfo {
  twilioCallSid: string;
  callerPhone: string;
  callerName?: string;
  userId?: number;
  priorityScore?: number;
  metadata?: any;
}

export interface QueuePosition {
  id: string;
  position: number;
  estimatedWaitSeconds: number;
  totalInQueue: number;
}

export interface QueuedCall {
  id: string;
  twilioCallSid: string;
  callerPhone: string;
  callerName?: string;
  userId?: number;
  priorityScore: number;
  queuePosition?: number;
  estimatedWaitSeconds?: number;
  enteredQueueAt: Date;
  assignedToAgentId?: number;
  assignedAt?: Date;
  status: string;
  attemptsCount: number;
  lastAttemptAt?: Date;
  lastAttemptAgentId?: number;
  abandonedAt?: Date;
  connectedAt?: Date;
  completedAt?: Date;
  totalWaitSeconds?: number;
  maxWaitReached: boolean;
  callbackOffered: boolean;
  callbackAccepted: boolean;
  metadata?: any;
}

export interface QueueStats {
  totalInQueue: number;
  averageWaitTime: number;
  longestWaitTime: number;
  queuedCalls: number;
  connectedCalls: number;
  abandonedCalls: number;
}

export class InboundCallQueueService {
  private readonly MAX_QUEUE_SIZE = 50; // Prevent queue from growing too large
  private readonly DEFAULT_WAIT_ESTIMATE = 120; // 2 minutes default estimate
  private readonly POSITION_UPDATE_INTERVAL = 30; // seconds

  constructor(private deps: InboundCallQueueDependencies) {}

  /**
   * Add caller to queue and return their position
   */
  async enqueueCall(callInfo: InboundCallInfo): Promise<QueuePosition> {
    try {
      const now = new Date();
      
      // Check if queue is at capacity
      const queueSize = await this.getQueueSize();
      if (queueSize >= this.MAX_QUEUE_SIZE) {
        throw new Error('Queue at maximum capacity');
      }

      // Calculate priority score if not provided
      const priorityScore = callInfo.priorityScore || await this.calculatePriority(callInfo);
      
      // Create queue entry
      const queueEntry = await this.deps.prisma.inboundCallQueue.create({
        data: {
          twilioCallSid: callInfo.twilioCallSid,
          callerPhone: callInfo.callerPhone,
          callerName: callInfo.callerName,
          userId: callInfo.userId ? BigInt(callInfo.userId) : null,
          priorityScore,
          status: 'waiting',
          enteredQueueAt: now,
          metadata: callInfo.metadata || undefined
        }
      });

      // Calculate and assign queue position
      const position = await this.calculateQueuePosition(queueEntry.id, priorityScore);
      const estimatedWaitSeconds = await this.estimateWaitTime(position);

      // Update queue entry with position and estimate
      await this.deps.prisma.inboundCallQueue.update({
        where: { id: queueEntry.id },
        data: {
          queuePosition: position,
          estimatedWaitSeconds
        }
      });

      // Reorder queue positions after insertion
      await this.reorderQueuePositions();

      this.deps.logger.info('Call added to queue', {
        callSid: callInfo.twilioCallSid,
        callerPhone: callInfo.callerPhone,
        position,
        estimatedWaitSeconds,
        priorityScore,
        queueSize: queueSize + 1
      });

      return {
        id: queueEntry.id,
        position,
        estimatedWaitSeconds,
        totalInQueue: queueSize + 1
      };

    } catch (error) {
      this.deps.logger.error('Failed to enqueue call', {
        callSid: callInfo.twilioCallSid,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get the next call from queue for agent assignment
   */
  async dequeueNextCall(): Promise<QueuedCall | null> {
    try {
      // Find highest priority waiting call
      const nextCall = await this.deps.prisma.inboundCallQueue.findFirst({
        where: {
          status: 'waiting',
          queuePosition: { not: null }
        },
        orderBy: [
          { priorityScore: 'desc' },
          { queuePosition: 'asc' },
          { enteredQueueAt: 'asc' }
        ]
      });

      if (!nextCall) {
        return null;
      }

      // Mark as assigned (will be updated with agent details by calling service)
      await this.deps.prisma.inboundCallQueue.update({
        where: { id: nextCall.id },
        data: {
          status: 'assigned',
          assignedAt: new Date()
        }
      });

      this.deps.logger.info('Call dequeued for assignment', {
        callId: nextCall.id,
        callSid: nextCall.twilioCallSid,
        callerPhone: nextCall.callerPhone,
        queuePosition: nextCall.queuePosition,
        waitTime: Date.now() - nextCall.enteredQueueAt.getTime()
      });

      return {
        id: nextCall.id,
        twilioCallSid: nextCall.twilioCallSid,
        callerPhone: nextCall.callerPhone,
        callerName: nextCall.callerName || undefined,
        userId: nextCall.userId ? Number(nextCall.userId) : undefined,
        priorityScore: nextCall.priorityScore,
        queuePosition: nextCall.queuePosition || undefined,
        estimatedWaitSeconds: nextCall.estimatedWaitSeconds || undefined,
        enteredQueueAt: nextCall.enteredQueueAt,
        assignedToAgentId: nextCall.assignedToAgentId || undefined,
        assignedAt: nextCall.assignedAt || undefined,
        status: 'assigned',
        attemptsCount: nextCall.attemptsCount,
        lastAttemptAt: nextCall.lastAttemptAt || undefined,
        lastAttemptAgentId: nextCall.lastAttemptAgentId || undefined,
        abandonedAt: nextCall.abandonedAt || undefined,
        connectedAt: nextCall.connectedAt || undefined,
        completedAt: nextCall.completedAt || undefined,
        totalWaitSeconds: nextCall.totalWaitSeconds || undefined,
        maxWaitReached: nextCall.maxWaitReached,
        callbackOffered: nextCall.callbackOffered,
        callbackAccepted: nextCall.callbackAccepted,
        metadata: nextCall.metadata || undefined
      };

    } catch (error) {
      this.deps.logger.error('Failed to dequeue call', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update queue position and estimated wait time for specific call
   */
  async updateQueuePosition(callSid: string): Promise<void> {
    try {
      const queueEntry = await this.deps.prisma.inboundCallQueue.findUnique({
        where: { twilioCallSid: callSid }
      });

      if (!queueEntry || queueEntry.status !== 'waiting') {
        return; // Call not in queue or no longer waiting
      }

      const newPosition = await this.calculateQueuePosition(queueEntry.id, queueEntry.priorityScore);
      const estimatedWaitSeconds = await this.estimateWaitTime(newPosition);

      await this.deps.prisma.inboundCallQueue.update({
        where: { id: queueEntry.id },
        data: {
          queuePosition: newPosition,
          estimatedWaitSeconds
        }
      });

      if (INBOUND_CALL_FLAGS.INBOUND_CALL_DEBUG) {
        this.deps.logger.info('Queue position updated', {
          callSid,
          newPosition,
          estimatedWaitSeconds
        });
      }

    } catch (error) {
      this.deps.logger.error('Failed to update queue position', {
        callSid,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get estimated wait time based on queue position
   */
  async getEstimatedWaitTime(): Promise<number> {
    try {
      // Calculate based on current queue length and average processing time
      const queueSize = await this.getQueueSize();
      const averageCallDuration = await this.getAverageCallDuration();
      const availableAgents = await this.getAvailableAgentCount();

      if (availableAgents === 0) {
        return this.DEFAULT_WAIT_ESTIMATE * 2; // Longer wait if no agents
      }

      // Estimate: (queue size / available agents) * average call duration
      const estimatedMinutes = (queueSize / availableAgents) * (averageCallDuration / 60);
      return Math.max(30, Math.min(600, estimatedMinutes * 60)); // Between 30s and 10min

    } catch (error) {
      this.deps.logger.error('Failed to estimate wait time', {
        error: error instanceof Error ? error.message : String(error)
      });
      return this.DEFAULT_WAIT_ESTIMATE;
    }
  }

  /**
   * Mark call as connected when agent answers
   */
  async markCallConnected(callSid: string, agentId: number): Promise<void> {
    try {
      const now = new Date();
      
      const updatedCall = await this.deps.prisma.inboundCallQueue.update({
        where: { twilioCallSid: callSid },
        data: {
          status: 'connected',
          assignedToAgentId: agentId,
          connectedAt: now,
          totalWaitSeconds: {
            // Calculate wait time from queue entry to connection
            set: Math.floor((now.getTime() - new Date().getTime()) / 1000)
          }
        }
      });

      // Reorder remaining queue positions
      await this.reorderQueuePositions();

      this.deps.logger.info('Call connected from queue', {
        callSid,
        agentId,
        waitTime: updatedCall.totalWaitSeconds
      });

    } catch (error) {
      this.deps.logger.error('Failed to mark call as connected', {
        callSid,
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Mark call as abandoned when caller hangs up
   */
  async markCallAbandoned(callSid: string, reason: string = 'caller_hangup'): Promise<void> {
    try {
      const now = new Date();
      
      // Get the queue entry to extract caller info
      const queueEntry = await this.deps.prisma.inboundCallQueue.findUnique({
        where: { twilioCallSid: callSid }
      });

      if (!queueEntry) {
        this.deps.logger.warn('Queue entry not found for abandoned call', { callSid });
        return;
      }

      // Update queue status
      await this.deps.prisma.inboundCallQueue.update({
        where: { twilioCallSid: callSid },
        data: {
          status: 'abandoned',
          abandonedAt: now,
          metadata: JSON.stringify({
            abandonReason: reason,
            abandonedAt: now.toISOString()
          })
        }
      });

      // **NEW: Create a missed call session for tracking**
      await this.createMissedCallSession(queueEntry, reason);

      // Reorder remaining queue positions
      await this.reorderQueuePositions();

      this.deps.logger.info('Call abandoned from queue and logged as missed call', {
        callSid,
        reason,
        userId: queueEntry.userId
      });

    } catch (error) {
      this.deps.logger.error('Failed to mark call as abandoned', {
        callSid,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Create a missed call session when a caller abandons the queue
   */
  private async createMissedCallSession(queueEntry: any, reason: string): Promise<void> {
    try {
      // Check if call session already exists
      const existingSession = await this.deps.prisma.callSession.findFirst({
        where: { twilioCallSid: queueEntry.twilioCallSid }
      });

      if (existingSession) {
        // Update existing session to missed call
        await this.deps.prisma.callSession.update({
          where: { id: existingSession.id },
          data: {
            status: 'missed_call',
            endedAt: new Date(),
            lastOutcomeType: 'missed_call',
            lastOutcomeNotes: `Caller hung up while waiting in queue: ${reason}`,
            lastOutcomeAt: new Date()
          }
        });
        this.deps.logger.info('Updated existing call session to missed call', {
          sessionId: existingSession.id,
          callSid: queueEntry.twilioCallSid
        });
        return;
      }

      // Find a valid agent for session tracking
      const fallbackAgent = await this.deps.prisma.agent.findFirst({
        where: { isActive: true },
        select: { id: true }
      });

      if (!fallbackAgent) {
        this.deps.logger.error('No active agents found for missed call session tracking');
        return;
      }

      // Create new missed call session
      const userId = queueEntry.userId || 999999; // Use special ID for unknown callers

      // Create a call queue entry for the missed call
      // Ensure a corresponding user_call_scores row exists to satisfy FK constraint
      await this.deps.prisma.userCallScore.upsert({
        where: { userId: BigInt(userId) },
        update: {},
        create: {
          userId: BigInt(userId),
          currentScore: 0,
          totalAttempts: 0,
          successfulCalls: 0
        }
      });

      const callQueue = await this.deps.prisma.callQueue.create({
        data: {
          userId: BigInt(userId),
          queueType: 'inbound_call',
          priorityScore: 0,
          status: 'missed',
          queueReason: `Abandoned call: ${reason}`,
          assignedToAgentId: null,
          assignedAt: null,
        }
      });
      
      const callSession = await this.deps.prisma.callSession.create({
        data: {
          userId: BigInt(userId),
          agentId: fallbackAgent.id,
          callQueueId: callQueue.id,
          twilioCallSid: queueEntry.twilioCallSid,
          status: 'missed_call',
          direction: 'inbound',
          startedAt: queueEntry.enteredQueueAt,
          endedAt: new Date(),
          callSource: 'inbound_queue_abandoned',
          lastOutcomeType: 'missed_call',
          lastOutcomeNotes: `Caller hung up while waiting in queue: ${reason}`,
          lastOutcomeAt: new Date(),
          userClaimsContext: JSON.stringify({
            callerName: queueEntry.callerName || 'Unknown Caller',
            phoneNumber: queueEntry.callerPhone,
            queueWaitTime: Math.floor((Date.now() - queueEntry.enteredQueueAt.getTime()) / 1000),
            abandonReason: reason
          })
        }
      });

      this.deps.logger.info('Created missed call session for abandoned queue call', {
        sessionId: callSession.id,
        callSid: queueEntry.twilioCallSid,
        userId,
        waitTime: Math.floor((Date.now() - queueEntry.enteredQueueAt.getTime()) / 1000)
      });

    } catch (error) {
      this.deps.logger.error('Failed to create missed call session for abandoned call', {
        callSid: queueEntry.twilioCallSid,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Mark call as completed when it successfully ends
   */
  async markCallCompleted(callSid: string, duration?: number): Promise<void> {
    try {
      const now = new Date();
      
      await this.deps.prisma.inboundCallQueue.update({
        where: { twilioCallSid: callSid },
        data: {
          status: 'completed',
          completedAt: now,
          totalWaitSeconds: duration ? Math.floor(duration) : undefined,
          metadata: JSON.stringify({
            completedReason: 'call_ended',
            completedAt: now.toISOString(),
            duration: duration
          })
        }
      });

      // Reorder remaining queue positions
      await this.reorderQueuePositions();

      this.deps.logger.info('Call completed from queue', {
        callSid,
        duration,
        completedAt: now.toISOString()
      });

    } catch (error) {
      this.deps.logger.error('Failed to mark call as completed', {
        callSid,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get queue statistics for monitoring
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const [
        totalInQueue,
        avgWaitTime,
        longestWait,
        statusStats
      ] = await Promise.all([
        this.getQueueSize(),
        this.getAverageWaitTime(),
        this.getLongestWaitTime(),
        this.getStatusDistribution()
      ]);

      return {
        totalInQueue,
        averageWaitTime: avgWaitTime,
        longestWaitTime: longestWait,
        queuedCalls: statusStats.waiting || 0,
        connectedCalls: statusStats.connected || 0,
        abandonedCalls: statusStats.abandoned || 0
      };

    } catch (error) {
      this.deps.logger.error('Failed to get queue stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        totalInQueue: 0,
        averageWaitTime: 0,
        longestWaitTime: 0,
        queuedCalls: 0,
        connectedCalls: 0,
        abandonedCalls: 0
      };
    }
  }

  /**
   * Clean up old queue entries (completed, abandoned, etc.)
   * Since queue is not needed for historical storage, we clean aggressively
   */
  async cleanupOldEntries(olderThanHours: number = 1): Promise<{ cleanedCount: number }> {
    try {
      const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
      
      // Clean up all non-active queue entries older than specified time
      // Active statuses: 'waiting', 'assigned', 'connecting'
      // Clean statuses: 'completed', 'abandoned'
      const deletedEntries = await this.deps.prisma.inboundCallQueue.deleteMany({
        where: {
          status: { in: ['completed', 'abandoned'] },
          updatedAt: { lt: cutoffTime }
        }
      });

      this.deps.logger.info('Cleaned up old queue entries', {
        cleanedCount: deletedEntries.count,
        olderThanHours,
        timestamp: new Date().toISOString()
      });

      return { cleanedCount: deletedEntries.count };

    } catch (error) {
      this.deps.logger.error('Failed to cleanup old queue entries', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { cleanedCount: 0 };
    }
  }

  /**
   * Aggressive cleanup - removes ALL completed and abandoned entries regardless of age
   * Use this when queue gets too large and historical data is not needed
   */
  async aggressiveCleanup(): Promise<{ cleanedCount: number }> {
    try {
      const deletedEntries = await this.deps.prisma.inboundCallQueue.deleteMany({
        where: {
          status: { in: ['completed', 'abandoned'] }
        }
      });

      this.deps.logger.info('Aggressive queue cleanup completed', {
        cleanedCount: deletedEntries.count,
        timestamp: new Date().toISOString()
      });

      return { cleanedCount: deletedEntries.count };

    } catch (error) {
      this.deps.logger.error('Failed to perform aggressive cleanup', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { cleanedCount: 0 };
    }
  }

  // Private helper methods

  private async calculatePriority(callInfo: InboundCallInfo): Promise<number> {
    // Basic priority calculation - can be enhanced later
    let priority = 50; // Base priority

    // Known user gets higher priority
    if (callInfo.userId) {
      priority += 20;
    }

    // Add any other priority factors here
    return priority;
  }

  private async calculateQueuePosition(callId: string, priorityScore: number): Promise<number> {
    const higherPriorityCalls = await this.deps.prisma.inboundCallQueue.count({
      where: {
        status: 'waiting',
        id: { not: callId },
        priorityScore: { gt: priorityScore }
      }
    });

    return higherPriorityCalls + 1;
  }

  private async estimateWaitTime(position: number): Promise<number> {
    const averageProcessingTime = await this.getAverageCallDuration();
    const availableAgents = await this.getAvailableAgentCount();

    if (availableAgents === 0) {
      return this.DEFAULT_WAIT_ESTIMATE * 2;
    }

    // Estimate based on position and agent availability
    const estimatedSeconds = (position / availableAgents) * (averageProcessingTime / 60) * 60;
    return Math.max(30, Math.min(600, estimatedSeconds)); // 30s to 10min range
  }

  private async reorderQueuePositions(): Promise<void> {
    // Reorder all waiting calls by priority and entry time
    const waitingCalls = await this.deps.prisma.inboundCallQueue.findMany({
      where: { status: 'waiting' },
      orderBy: [
        { priorityScore: 'desc' },
        { enteredQueueAt: 'asc' }
      ]
    });

    // Update positions in batch
    const updatePromises = waitingCalls.map((call, index) =>
      this.deps.prisma.inboundCallQueue.update({
        where: { id: call.id },
        data: { queuePosition: index + 1 }
      })
    );

    await Promise.all(updatePromises);
  }

  private async getQueueSize(): Promise<number> {
    return await this.deps.prisma.inboundCallQueue.count({
      where: { status: 'waiting' }
    });
  }

  private async getAverageCallDuration(): Promise<number> {
    // Get average from recent completed calls
    const recentCalls = await this.deps.prisma.inboundCallQueue.findMany({
      where: {
        status: 'completed',
        completedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        },
        totalWaitSeconds: { not: null }
      },
      select: { totalWaitSeconds: true }
    });

    if (recentCalls.length === 0) {
      return 300; // Default 5 minutes
    }

    const average = recentCalls.reduce((sum, call) => sum + (call.totalWaitSeconds || 0), 0) / recentCalls.length;
    return Math.max(60, average); // Minimum 1 minute
  }

  private async getAvailableAgentCount(): Promise<number> {
    return await this.deps.prisma.agentSession.count({
      where: {
        status: 'available',
        logoutAt: null,
        agent: { isActive: true }
      }
    });
  }

  private async getAverageWaitTime(): Promise<number> {
    const result = await this.deps.prisma.inboundCallQueue.aggregate({
      where: {
        status: { in: ['connected', 'completed'] },
        totalWaitSeconds: { not: null }
      },
      _avg: { totalWaitSeconds: true }
    });

    return result._avg.totalWaitSeconds || 0;
  }

  private async getLongestWaitTime(): Promise<number> {
    const result = await this.deps.prisma.inboundCallQueue.aggregate({
      where: { status: 'waiting' },
      _min: { enteredQueueAt: true }
    });

    if (!result._min.enteredQueueAt) {
      return 0;
    }

    return Math.floor((Date.now() - result._min.enteredQueueAt.getTime()) / 1000);
  }

  private async getStatusDistribution(): Promise<Record<string, number>> {
    const stats = await this.deps.prisma.inboundCallQueue.groupBy({
      by: ['status'],
      _count: { status: true }
    });

    return stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, number>);
  }
}

// Factory function for dependency injection
export function createInboundCallQueueService(prisma: PrismaClient): InboundCallQueueService {
  const simpleLogger: Logger = {
    info: (message: string, meta?: any) => console.log(`[InboundQueue] ${message}`, meta || ''),
    error: (message: string, meta?: any) => console.error(`[InboundQueue ERROR] ${message}`, meta || ''),
    warn: (message: string, meta?: any) => console.warn(`[InboundQueue WARN] ${message}`, meta || '')
  };

  return new InboundCallQueueService({
    prisma,
    logger: simpleLogger
  });
}