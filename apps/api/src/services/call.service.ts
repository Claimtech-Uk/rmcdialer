import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CallSessionOptions {
  userId: number;
  agentId: number;
  queueId?: string;
  direction?: 'outbound' | 'inbound';
  phoneNumber?: string;
}

export interface CallUpdateOptions {
  status?: 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'no_answer';
  twilioCallSid?: string;
  connectedAt?: Date;
  endedAt?: Date;
  failureReason?: string;
}

export interface CallOutcomeOptions {
  outcomeType: 'contacted' | 'no_answer' | 'busy' | 'wrong_number' | 'not_interested' | 'callback_requested' | 'left_voicemail' | 'failed';
  outcomeNotes?: string;
  nextCallDelayHours?: number;
  magicLinkSent?: boolean;
  documentsRequested?: string[];
  callbackDateTime?: Date;
  callbackReason?: string;
  scoreAdjustment?: number;
}

export interface GetCallHistoryOptions {
  page?: number;
  limit?: number;
  agentId?: number;
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  outcome?: string;
  status?: string;
}

export class CallService {
  /**
   * Initiate a new call session
   */
  async initiateCall(options: CallSessionOptions) {
    const { userId, agentId, queueId, direction = 'outbound', phoneNumber } = options;

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Verify agent is available
      const agentSession = await tx.agentSession.findFirst({
        where: { agentId, status: 'available' }
      });

      if (!agentSession) {
        throw new Error('Agent is not available for calls');
      }

      // Get user context for the call
      const userContext = await this.getUserCallContext(userId);

      // Create call session
      const callSessionData: any = {
        userId,
        agentId,
        direction,
        status: 'initiated',
        startedAt: new Date(),
        userClaimsContext: userContext.claimsContext
      };

      if (queueId) {
        callSessionData.callQueueId = queueId;
      }

      const callSession = await tx.callSession.create({
        data: callSessionData
      });

      // Update agent status to on_call
      await tx.agentSession.updateMany({
        where: { agentId },
        data: { 
          status: 'on_call',
          currentCallSessionId: callSession.id
        }
      });

      // If this call was from a queue, mark queue entry as assigned
      if (queueId) {
        await tx.callQueue.updateMany({
          where: { id: queueId },
          data: { 
            status: 'assigned',
            assignedToAgentId: agentId,
            assignedAt: new Date()
          }
        });
      }

      logger.info('Call session initiated', {
        callSessionId: callSession.id,
        userId,
        agentId,
        queueId,
        direction,
        phoneNumber: phoneNumber || userContext.phoneNumber
      });

      return {
        ...callSession,
        userContext
      };
    });
  }

  /**
   * Update call session status
   */
  async updateCallStatus(sessionId: string, updateData: CallUpdateOptions) {
    const session = await prisma.callSession.update({
      where: { id: sessionId },
      data: {
        status: updateData.status,
        twilioCallSid: updateData.twilioCallSid,
        connectedAt: updateData.connectedAt,
        endedAt: updateData.endedAt,
        // Calculate duration if call ended
        ...(updateData.endedAt && {
          durationSeconds: Math.floor(
            (updateData.endedAt.getTime() - new Date().getTime()) / 1000
          )
        }),
        // Calculate talk time if connected and ended
        ...(updateData.endedAt && updateData.connectedAt && {
          talkTimeSeconds: Math.floor(
            (updateData.endedAt.getTime() - updateData.connectedAt.getTime()) / 1000
          )
        })
      }
    });

    logger.info('Call status updated', {
      sessionId,
      status: updateData.status,
      twilioCallSid: updateData.twilioCallSid
    });

    return session;
  }

  /**
   * Record call outcome and disposition
   */
  async recordCallOutcome(sessionId: string, agentId: number, outcome: CallOutcomeOptions) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get the call session
      const callSession = await tx.callSession.findUnique({
        where: { id: sessionId },
        include: { callQueue: true }
      });

      if (!callSession) {
        throw new Error('Call session not found');
      }

      if (callSession.agentId !== agentId) {
        throw new Error('Agent not authorized for this call session');
      }

      // Create call outcome record
      const callOutcome = await tx.callOutcome.create({
        data: {
          callSessionId: sessionId,
          outcomeType: outcome.outcomeType,
          outcomeNotes: outcome.outcomeNotes || '',
          nextCallDelayHours: outcome.nextCallDelayHours || this.getDefaultDelayHours(outcome.outcomeType),
          scoreAdjustment: outcome.scoreAdjustment || this.getScoreAdjustment(outcome.outcomeType),
          magicLinkSent: outcome.magicLinkSent || false,
          documentsRequested: outcome.documentsRequested ? JSON.stringify(outcome.documentsRequested) : undefined,
          recordedByAgentId: agentId
        }
      });

      // Update user call score
      await this.updateUserScoreAfterCall(tx, Number(callSession.userId), outcome.outcomeType, outcome.scoreAdjustment);

      // Create callback if requested
      if (outcome.outcomeType === 'callback_requested' && outcome.callbackDateTime) {
        await tx.callback.create({
          data: {
            userId: callSession.userId,
            scheduledFor: outcome.callbackDateTime,
            callbackReason: outcome.callbackReason || 'User requested callback',
            preferredAgentId: agentId,
            originalCallSessionId: sessionId,
            status: 'pending'
          }
        });
      }

      // Update call session status to completed
      await tx.callSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          endedAt: new Date()
        }
      });

      // Update queue entry status if applicable
      if (callSession.callQueueId) {
        await tx.callQueue.update({
          where: { id: callSession.callQueueId },
          data: { status: 'completed' }
        });
      }

      // Update agent status back to available
      await tx.agentSession.updateMany({
        where: { agentId },
        data: { 
          status: 'available',
          currentCallSessionId: null
        }
      });

      // Update agent session stats
      await this.updateAgentSessionStats(tx, agentId, callSession);

      logger.info('Call outcome recorded', {
        sessionId,
        agentId,
        userId: callSession.userId,
        outcome: outcome.outcomeType,
        nextCallDelay: outcome.nextCallDelayHours
      });

      return {
        callOutcome,
        nextCallAfter: new Date(Date.now() + (outcome.nextCallDelayHours || 0) * 60 * 60 * 1000)
      };
    });
  }

  /**
   * End a call session (without outcome)
   */
  async endCall(sessionId: string, agentId: number) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const callSession = await tx.callSession.findUnique({
        where: { id: sessionId }
      });

      if (!callSession) {
        throw new Error('Call session not found');
      }

      if (callSession.agentId !== agentId) {
        throw new Error('Agent not authorized for this call session');
      }

      // Update call session
      const updatedSession = await tx.callSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          endedAt: new Date(),
          durationSeconds: Math.floor(
            (new Date().getTime() - callSession.startedAt.getTime()) / 1000
          )
        }
      });

      // Update agent status
      await tx.agentSession.updateMany({
        where: { agentId },
        data: { 
          status: 'available',
          currentCallSessionId: null
        }
      });

      logger.info('Call ended', {
        sessionId,
        agentId,
        durationSeconds: updatedSession.durationSeconds
      });

      return updatedSession;
    });
  }

  /**
   * Get call history with filtering and pagination
   */
  async getCallHistory(options: GetCallHistoryOptions = {}) {
    const { 
      page = 1, 
      limit = 20, 
      agentId, 
      userId, 
      startDate, 
      endDate, 
      outcome,
      status 
    } = options;

    const where: any = {};

    if (agentId) where.agentId = agentId;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = startDate;
      if (endDate) where.startedAt.lte = endDate;
    }
    if (status) where.status = status;
    if (outcome) {
      where.callOutcome = {
        some: { outcomeType: outcome }
      };
    }

    const [callHistory, total] = await Promise.all([
      prisma.callSession.findMany({
        where,
        include: {
          callOutcomes: true,
          agent: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.callSession.count({ where })
    ]);

    // Enhance with user data (mock for now)
    const enhancedHistory = callHistory.map((call: any) => ({
      ...call,
      user: this.getMockUserData(Number(call.userId)),
      outcome: call.callOutcomes?.[0] || null
    }));

    return {
      callHistory: enhancedHistory,
      total,
      hasMore: callHistory.length === limit && total > limit,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get active call sessions for an agent
   */
  async getAgentActiveCalls(agentId: number) {
    const activeCalls = await prisma.callSession.findMany({
      where: {
        agentId,
        status: {
          in: ['initiated', 'ringing', 'connected']
        }
      },
      include: {
        callOutcomes: true
      }
    });

    return activeCalls.map((call: any) => ({
      ...call,
      user: this.getMockUserData(Number(call.userId))
    }));
  }

  /**
   * Get call statistics for an agent or overall
   */
  async getCallStats(agentId?: number, startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = startDate;
      if (endDate) where.startedAt.lte = endDate;
    }

    const [
      totalCalls,
      completedCalls,
      outcomeStats,
      avgDuration,
      avgTalkTime
    ] = await Promise.all([
      prisma.callSession.count({ where }),
      prisma.callSession.count({ 
        where: { ...where, status: 'completed' } 
      }),
      prisma.callOutcome.groupBy({
        by: ['outcomeType'],
        _count: { id: true },
        where: {
          callSession: where
        }
      }),
      prisma.callSession.aggregate({
        where: { ...where, durationSeconds: { not: null } },
        _avg: { durationSeconds: true }
      }),
      prisma.callSession.aggregate({
        where: { ...where, talkTimeSeconds: { not: null } },
        _avg: { talkTimeSeconds: true }
      })
    ]);

    const outcomes: Record<string, number> = {};
    outcomeStats.forEach((stat: any) => {
      outcomes[stat.outcomeType] = stat._count.id;
    });

    return {
      totalCalls,
      completedCalls,
      successfulContacts: outcomes.contacted || 0,
      noAnswers: outcomes.no_answer || 0,
      callbacks: outcomes.callback_requested || 0,
      notInterested: outcomes.not_interested || 0,
      avgDurationMinutes: avgDuration._avg.durationSeconds ? 
        Math.round((avgDuration._avg.durationSeconds / 60) * 100) / 100 : 0,
      avgTalkTimeMinutes: avgTalkTime._avg.talkTimeSeconds ? 
        Math.round((avgTalkTime._avg.talkTimeSeconds / 60) * 100) / 100 : 0,
      contactRate: totalCalls > 0 ? 
        Math.round((outcomes.contacted || 0) / totalCalls * 100) : 0
    };
  }

  /**
   * Private helper methods
   */
  private async getUserCallContext(userId: number) {
    // In production, this would query the replica database
    // For now, using mock data
    const mockUser = this.getMockUserData(userId);
    
    return {
      phoneNumber: mockUser.phoneNumber,
      claimsContext: JSON.stringify({
        claims: mockUser.claims,
        totalRequirements: mockUser.claims?.reduce((acc: number, claim: any) => 
          acc + (claim.requirements?.length || 0), 0) || 0,
        highestValueClaim: Math.max(
          ...(mockUser.claims?.map((c: any) => c.value || 0) || [0])
        )
      })
    };
  }

  private getDefaultDelayHours(outcomeType: string): number {
    const delayMap: Record<string, number> = {
      'contacted': 24,
      'no_answer': 4,
      'busy': 2,
      'wrong_number': 48,
      'not_interested': 48,
      'callback_requested': 0,
      'left_voicemail': 8,
      'failed': 1
    };
    return delayMap[outcomeType] || 4;
  }

  private getScoreAdjustment(outcomeType: string): number {
    const adjustmentMap: Record<string, number> = {
      'contacted': -10,      // Lower score = higher priority for follow-up
      'no_answer': 5,
      'busy': 2,
      'wrong_number': 50,    // Much lower priority
      'not_interested': 100, // Lowest priority
      'callback_requested': -20, // High priority
      'left_voicemail': 10,
      'failed': 0
    };
    return adjustmentMap[outcomeType] || 0;
  }

  private async updateUserScoreAfterCall(
    tx: Prisma.TransactionClient, 
    userId: number, 
    outcome: string, 
    scoreAdjustment?: number
  ) {
    const adjustment = scoreAdjustment || this.getScoreAdjustment(outcome);
    const nextCallAfter = new Date(
      Date.now() + this.getDefaultDelayHours(outcome) * 60 * 60 * 1000
    );

    await tx.userCallScore.upsert({
      where: { userId },
      update: {
        currentScore: {
          increment: adjustment
        },
        lastOutcome: outcome,
        nextCallAfter,
        totalAttempts: {
          increment: 1
        },
        successfulCalls: outcome === 'contacted' ? {
          increment: 1
        } : undefined,
        lastCallAt: new Date(),
        updatedAt: new Date()
      },
      create: {
        userId,
        currentScore: Math.max(0, adjustment),
        lastOutcome: outcome,
        nextCallAfter,
        totalAttempts: 1,
        successfulCalls: outcome === 'contacted' ? 1 : 0,
        lastCallAt: new Date(),
        baseScore: 0
      }
    });
  }

  private async updateAgentSessionStats(
    tx: Prisma.TransactionClient,
    agentId: number,
    callSession: any
  ) {
    const talkTime = callSession.talkTimeSeconds || 0;
    
    await tx.agentSession.updateMany({
      where: { agentId },
      data: {
        callsCompletedToday: {
          increment: 1
        },
        totalTalkTimeSeconds: {
          increment: talkTime
        }
      }
    });
  }

  private getMockUserData(userId: number) {
    const mockUsers: Record<number, any> = {
      12345: {
        id: 12345,
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@email.com',
        phoneNumber: '+447700123456',
        claims: [{
          id: 67890,
          type: 'VEHICLE',
          status: 'documents_needed',
          lender: 'Santander',
          value: 15000,
          requirements: [
            { type: 'ID_DOCUMENT', status: 'PENDING' },
            { type: 'BANK_STATEMENTS', status: 'PENDING' }
          ]
        }]
      },
      23456: {
        id: 23456,
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.j@email.com',
        phoneNumber: '+447700234567',
        claims: [{
          id: 78901,
          type: 'BANK_FRAUD',
          status: 'documents_needed',
          lender: 'Barclays',
          value: 8000,
          requirements: [
            { type: 'BANK_STATEMENTS', status: 'PENDING' }
          ]
        }]
      },
      34567: {
        id: 34567,
        firstName: 'Michael',
        lastName: 'Brown',
        email: 'mike.brown@email.com',
        phoneNumber: '+447700345678',
        claims: [{
          id: 89012,
          type: 'VEHICLE',
          status: 'documents_needed',
          lender: 'Close Brothers',
          value: 25000,
          requirements: [
            { type: 'ID_DOCUMENT', status: 'PENDING' },
            { type: 'VEHICLE_DOCS', status: 'PENDING' },
            { type: 'FINANCE_AGREEMENT', status: 'PENDING' }
          ]
        }]
      },
      45678: {
        id: 45678,
        firstName: 'Emma',
        lastName: 'Wilson',
        email: 'emma.wilson@email.com',
        phoneNumber: '+447700456789',
        claims: [{
          id: 90123,
          type: 'CREDIT_CARD',
          status: 'documents_needed',
          lender: 'MBNA',
          value: 5000,
          requirements: [
            { type: 'CREDIT_STATEMENTS', status: 'PENDING' }
          ]
        }]
      },
      56789: {
        id: 56789,
        firstName: 'David',
        lastName: 'Taylor',
        email: 'david.taylor@email.com',
        phoneNumber: '+447700567890',
        claims: [{
          id: 12340,
          type: 'LOAN',
          status: 'documents_needed',
          lender: 'Provident',
          value: 12000,
          requirements: [
            { type: 'ID_DOCUMENT', status: 'PENDING' },
            { type: 'BANK_STATEMENTS', status: 'PENDING' }
          ]
        }]
      }
    };

    return mockUsers[userId] || {
      id: userId,
      firstName: 'Unknown',
      lastName: 'User',
      email: `user${userId}@email.com`,
      phoneNumber: '+447700000000',
      claims: []
    };
  }
}

export const callService = new CallService(); 