import { PrismaClient } from '@prisma/client';

export interface MissedCallEntry {
  id: string;
  phoneNumber: string;
  callerName: string | null;
  userId: bigint | null;
  missedAt: Date;
  reason: string;
  status: string;
  assignedToAgentId: number | null;
  assignedAt: Date | null;
  twilioCallSid: string | null;
  sessionId: string | null;
  createdAt: Date;
}

export interface CreateMissedCallData {
  phoneNumber: string;
  callerName?: string;
  userId?: bigint;
  reason: 'out_of_hours' | 'agents_busy';
  twilioCallSid?: string;
  sessionId?: string;
}

export interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, error?: any) => void;
  warn: (message: string, meta?: any) => void;
}

export class MissedCallService {
  constructor(
    private deps: {
      prisma: PrismaClient;
      logger: Logger;
    }
  ) {}

  /**
   * 🎯 Create a new missed call entry for priority callback
   */
  async createMissedCall(data: CreateMissedCallData): Promise<MissedCallEntry> {
    try {
      this.deps.logger.info('Creating missed call entry', {
        phoneNumber: data.phoneNumber,
        reason: data.reason,
        callerName: data.callerName
      });

      const missedCall = await this.deps.prisma.missedCall.create({
        data: {
          phoneNumber: data.phoneNumber,
          callerName: data.callerName,
          userId: data.userId,
          reason: data.reason,
          status: 'pending',
          twilioCallSid: data.twilioCallSid,
          sessionId: data.sessionId,
          missedAt: new Date(),
          createdAt: new Date()
        }
      });

      this.deps.logger.info('Missed call entry created successfully', {
        id: missedCall.id,
        phoneNumber: data.phoneNumber
      });

      return missedCall;
    } catch (error) {
      this.deps.logger.error('Failed to create missed call entry', error);
      throw error;
    }
  }

  /**
   * 🎯 Find and atomically assign the next pending missed call to an agent
   * Uses database transaction to prevent race conditions
   */
  async findAndAssignNextMissedCall(agentId: number): Promise<MissedCallEntry | null> {
    try {
      this.deps.logger.info('Finding next missed call for agent', { agentId });

      const result = await this.deps.prisma.$transaction(async (tx) => {
        // 1. Find the oldest pending missed call
        const missedCall = await tx.missedCall.findFirst({
          where: {
            status: 'pending'
          },
          orderBy: {
            missedAt: 'asc' // Oldest first for FIFO processing
          }
        });

        if (!missedCall) {
          this.deps.logger.info('No pending missed calls found', { agentId });
          return null;
        }

        // 2. Atomically assign it to this agent
        const updateResult = await tx.missedCall.updateMany({
          where: {
            id: missedCall.id,
            status: 'pending' // Double-check it's still available
          },
          data: {
            status: 'assigned',
            assignedToAgentId: agentId,
            assignedAt: new Date()
          }
        });

        // 3. Return the missed call if successfully assigned
        if (updateResult.count > 0) {
          this.deps.logger.info('Successfully assigned missed call to agent', {
            missedCallId: missedCall.id,
            agentId,
            phoneNumber: missedCall.phoneNumber
          });
          
          return {
            ...missedCall,
            status: 'assigned',
            assignedToAgentId: agentId,
            assignedAt: new Date()
          };
        } else {
          this.deps.logger.warn('Missed call was claimed by another agent', {
            missedCallId: missedCall.id,
            agentId
          });
          return null;
        }
      });

      return result;
    } catch (error) {
      this.deps.logger.error('Failed to find and assign missed call', { agentId, error });
      throw error;
    }
  }

  /**
   * 🎯 Delete missed call after callback attempt (regardless of outcome)
   * This prevents the same call from being attempted multiple times
   */
  async deleteAfterAttempt(missedCallId: string, reason: string = 'callback_attempted'): Promise<void> {
    try {
      this.deps.logger.info('Deleting missed call after attempt', {
        missedCallId,
        reason
      });

      await this.deps.prisma.missedCall.delete({
        where: {
          id: missedCallId
        }
      });

      this.deps.logger.info('Missed call deleted successfully', {
        missedCallId,
        reason
      });
    } catch (error) {
      this.deps.logger.error('Failed to delete missed call after attempt', {
        missedCallId,
        error
      });
      // Don't throw - this is cleanup, shouldn't break the workflow
    }
  }

  /**
   * 🧹 Clean up stale assignments (agents that claimed but didn't call)
   * Should be run periodically to prevent missed calls from getting stuck
   */
  async cleanupStaleAssignments(maxAgeMinutes: number = 10): Promise<number> {
    try {
      this.deps.logger.info('Cleaning up stale missed call assignments', { maxAgeMinutes });

      const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

      const result = await this.deps.prisma.missedCall.updateMany({
        where: {
          status: 'assigned',
          assignedAt: {
            lt: cutoffTime
          }
        },
        data: {
          status: 'pending',
          assignedToAgentId: null,
          assignedAt: null
        }
      });

      this.deps.logger.info('Cleaned up stale assignments', {
        count: result.count,
        maxAgeMinutes
      });

      return result.count;
    } catch (error) {
      this.deps.logger.error('Failed to cleanup stale assignments', error);
      return 0;
    }
  }

  /**
   * 📊 Get statistics about missed calls
   */
  async getMissedCallStats(): Promise<{
    totalPending: number;
    totalAssigned: number;
    oldestPendingMinutes: number | null;
  }> {
    try {
      const [totalPending, totalAssigned, oldestPending] = await Promise.all([
        this.deps.prisma.missedCall.count({
          where: { status: 'pending' }
        }),
        this.deps.prisma.missedCall.count({
          where: { status: 'assigned' }
        }),
        this.deps.prisma.missedCall.findFirst({
          where: { status: 'pending' },
          orderBy: { missedAt: 'asc' },
          select: { missedAt: true }
        })
      ]);

      const oldestPendingMinutes = oldestPending
        ? Math.floor((Date.now() - oldestPending.missedAt.getTime()) / (1000 * 60))
        : null;

      return {
        totalPending,
        totalAssigned,
        oldestPendingMinutes
      };
    } catch (error) {
      this.deps.logger.error('Failed to get missed call stats', error);
      return {
        totalPending: 0,
        totalAssigned: 0,
        oldestPendingMinutes: null
      };
    }
  }

  /**
   * 🔍 Get all pending missed calls (for admin/debugging)
   */
  async getAllPendingMissedCalls(): Promise<MissedCallEntry[]> {
    try {
      return await this.deps.prisma.missedCall.findMany({
        where: { status: 'pending' },
        orderBy: { missedAt: 'asc' }
      });
    } catch (error) {
      this.deps.logger.error('Failed to get pending missed calls', error);
      return [];
    }
  }
}

/**
 * 🏭 Factory function to create MissedCallService with dependencies
 */
export function createMissedCallService(
  prisma: PrismaClient,
  logger?: Logger
): MissedCallService {
  const defaultLogger: Logger = {
    info: (message: string, meta?: any) => console.log(`[MissedCallService] ${message}`, meta),
    error: (message: string, error?: any) => console.error(`[MissedCallService ERROR] ${message}`, error),
    warn: (message: string, meta?: any) => console.warn(`[MissedCallService WARN] ${message}`, meta)
  };

  return new MissedCallService({
    prisma,
    logger: logger || defaultLogger
  });
}