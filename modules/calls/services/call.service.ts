import { PrismaClient, Prisma } from '@prisma/client';
import {
  CallSession,
  CallSessionOptions,
  CallUpdateOptions,
  CallOutcomeOptions,
  CallOutcome,
  CallSessionWithContext,
  UserCallContext,
  GetCallHistoryOptions,
  CallHistoryResult,
  CallAnalytics,
  CallAnalyticsFilters,
  Callback,
  CreateCallbackRequest,
  GetCallbacksOptions,
  CallbacksResult,
  TwilioWebhookData,
  InitiateCallRequest,
  InitiateCallResponse
} from '../types/call.types';
import { UserService } from '../../users/services/user.service';
import { PriorityScoringService } from '../../scoring/services/priority-scoring.service';
import { CallOutcomeManager } from '@/modules/call-outcomes/services/call-outcome-manager.service'
import type { CallOutcomeContext } from '@/modules/call-outcomes/types/call-outcome.types'

// Dependencies that will be injected
interface CallServiceDependencies {
  prisma: PrismaClient;
  userService?: UserService;
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
  scoringService: PriorityScoringService;
}

export class CallService {
  private userService: UserService;
  private callOutcomeManager: CallOutcomeManager

  constructor(private deps: CallServiceDependencies) {
    // Initialize UserService if not provided
    this.userService = deps.userService || new UserService();
    this.callOutcomeManager = new CallOutcomeManager()
  }

  /**
   * Initiate a new call session
   */
  async initiateCall(options: CallSessionOptions): Promise<InitiateCallResponse> {
    const { userId, agentId, queueId, direction = 'outbound', phoneNumber, twilioCallSid } = options;

    return await this.deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // For inbound calls with CallSid, first check if session already exists from webhook
      if (direction === 'inbound' && twilioCallSid) {
        console.log(`🔍 Checking for existing session with CallSid: ${twilioCallSid}`);
        
        const existingSession = await tx.callSession.findFirst({
          where: { twilioCallSid }
        });
        
        if (existingSession) {
          console.log(`✅ Found existing webhook session ${existingSession.id} for CallSid ${twilioCallSid}`);
          
          // Update the session with agent if needed
          const updatedSession = await tx.callSession.update({
            where: { id: existingSession.id },
            data: {
              agentId, // Ensure correct agent is assigned
              status: 'connected', // Update status to connected
              connectedAt: new Date()
            }
          });
          
          this.deps.logger.info('Using existing webhook session for inbound call', {
            sessionId: existingSession.id,
            twilioCallSid,
            userId,
            agentId
          });
          
          return {
            callSession: this.mapToCallSession(updatedSession),
            userContext: await this.getUserCallContext(userId)
          };
        } else {
          console.log(`⚠️ No existing session found for CallSid ${twilioCallSid}, creating new session`);
        }
      }
      // Get user context for the call
      const userContext = await this.getUserCallContext(userId);

      // Get queue context if available
      let queueContext: any = null;
      if (queueId) {
        queueContext = await tx.callQueue.findUnique({
          where: { id: queueId },
          select: {
            queueType: true,
            priorityScore: true,
            queuePosition: true,
            queueReason: true
          }
        });
      }

      // Calculate call attempt number for this user
      const previousAttempts = await tx.callSession.count({
        where: { userId: BigInt(userId) }
      });

      // Ensure UserCallScore exists before creating CallQueue (required for FK constraint)
      await tx.userCallScore.upsert({
        where: { userId: BigInt(userId) },
        update: {},
        create: {
          userId: BigInt(userId),
          currentScore: 0, // Default starting score - 0 is highest priority
          totalAttempts: 0,
          successfulCalls: 0
        }
      });

             // For manual calls, create a queue entry first to satisfy foreign key constraint
       let actualQueueId: string = queueId || '';
       if (!queueId) {
         const manualQueue = await tx.callQueue.create({
           data: {
             userId: BigInt(userId),
             queueType: 'manual_call',
             priorityScore: 0,
             status: 'pending', // Don't assign until we verify agent exists
             queueReason: 'Manual agent-initiated call',
             // assignedToAgentId: agentId, // Remove assignment for now
             // assignedAt: new Date(),
           }
         });
         actualQueueId = manualQueue.id;
       }

      // Create call session with enhanced context
      const callSession = await tx.callSession.create({
        data: {
          userId: BigInt(userId),
          agentId,
          callQueueId: actualQueueId,
          status: 'initiated',
          direction,
          startedAt: new Date(),
          userClaimsContext: JSON.stringify(userContext.claims),
          
          // Queue & priority context
          sourceQueueType: queueContext?.queueType || null,
          userPriorityScore: queueContext?.priorityScore || null,
          queuePosition: queueContext?.queuePosition || null,
          callAttemptNumber: previousAttempts + 1,
          callSource: queueId ? 'queue' : 'manual'
        }
      });

      // Update agent session to "on_call" if not already
      await tx.agentSession.updateMany({
        where: { agentId, status: { in: ['available', 'break'] } },
        data: { 
          status: 'on_call',
          currentCallSessionId: callSession.id,
          lastActivity: new Date()
        }
      });

      // Update queue entry status if from queue
      if (queueId) {
        await tx.callQueue.update({
          where: { id: queueId },
          data: { status: 'assigned' }
        });
      }

      this.deps.logger.info('Call session initiated', {
        callSessionId: callSession.id,
        userId,
        agentId,
        queueId,
        direction,
        phoneNumber: phoneNumber || userContext.phoneNumber
      });

      return {
        callSession: this.mapToCallSession(callSession),
        userContext
      };
    });
  }

  /**
   * Force end a call session - handles stuck/incomplete states
   * This is a cleanup method for when normal call ending flows fail
   */
  async forceEndCall(sessionId: string, agentId: number, reason: string = 'Force ended by agent'): Promise<void> {
    return await this.deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get the call session
      const callSession = await tx.callSession.findUnique({
        where: { id: sessionId }
      });

      if (!callSession) {
        throw new Error('Call session not found');
      }

      // Verify agent authorization
      if (callSession.agentId !== agentId) {
        throw new Error('Agent not authorized for this call session');
      }

      // Force update call session to completed
      await tx.callSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          endedAt: new Date(),
          lastOutcomeType: 'hung_up', // Updated to new vocabulary
          lastOutcomeNotes: reason,
          lastOutcomeAgentId: agentId,
          lastOutcomeAt: new Date()
        }
      });

      // Clear agent session
      await tx.agentSession.updateMany({
        where: { 
          agentId: agentId,
          currentCallSessionId: sessionId 
        },
        data: { 
          status: 'available',
          currentCallSessionId: null,
          lastActivity: new Date()
        }
      });

      // Complete queue entry if exists
      if (callSession.callQueueId) {
        await tx.callQueue.update({
          where: { id: callSession.callQueueId },
          data: { status: 'completed' }
        });
      }

      this.deps.logger.info('Call session force ended', {
        sessionId,
        agentId,
        reason
      });
    });
  }

  /**
   * Enhanced update call status with fallback lookup
   */
  async updateCallStatus(sessionId: string, updateData: CallUpdateOptions): Promise<CallSession> {
    // First try to find by session ID (direct call)
    let session = await this.deps.prisma.callSession.findUnique({
      where: { id: sessionId }
    });

    // If not found and we have a twilioCallSid, try finding by that
    if (!session && updateData.twilioCallSid) {
      session = await this.deps.prisma.callSession.findFirst({
        where: { twilioCallSid: updateData.twilioCallSid }
      });
    }

    if (!session) {
      throw new Error(`Call session not found: ${sessionId}`);
    }

    const updatedSession = await this.deps.prisma.callSession.update({
      where: { id: session.id },
      data: {
        status: updateData.status,
        twilioCallSid: updateData.twilioCallSid || session.twilioCallSid,
        connectedAt: updateData.connectedAt,
        endedAt: updateData.endedAt,
        // Calculate duration if call ended
        ...(updateData.endedAt && {
          durationSeconds: Math.floor(
            (updateData.endedAt.getTime() - (session.startedAt?.getTime() || new Date().getTime())) / 1000
          )
        }),
        // Calculate talk time if connected and ended
        ...(updateData.endedAt && (updateData.connectedAt || session.connectedAt) && {
          talkTimeSeconds: Math.floor(
            (updateData.endedAt.getTime() - (updateData.connectedAt || session.connectedAt)!.getTime()) / 1000
          )
        })
      }
    });

    // Auto-cleanup agent session if call ended
    if (updateData.status && ['completed', 'failed', 'no_answer'].includes(updateData.status)) {
      await this.deps.prisma.agentSession.updateMany({
        where: { 
          agentId: session.agentId,
          currentCallSessionId: session.id 
        },
        data: { 
          status: 'available',
          currentCallSessionId: null,
          lastActivity: new Date()
        }
      });
    }

    this.deps.logger.info('Call status updated', {
      sessionId: session.id,
      status: updateData.status,
      twilioCallSid: updateData.twilioCallSid
    });

    return this.mapToCallSession(updatedSession);
  }

  /**
   * Record call outcome and disposition with enhanced conversion tracking
   * Now using CallOutcomeManager for outcome processing
   */
  async recordCallOutcome(
    sessionId: string,
    agentId: number,
    outcome: {
      outcomeType: string;
      outcomeNotes?: string;
      magicLinkSent?: boolean;
      smsSent?: boolean;
      nextCallDelayHours?: number;
      documentsRequested?: string[];
      callbackDateTime?: Date;
      callbackReason?: string;
    }
  ): Promise<void> {
    try {
      console.log(`📋 Recording call outcome for session ${sessionId}:`, outcome);

      await this.deps.prisma.$transaction(async (tx) => {
        // Get the call session details for conversion tracking
        const callSession = await tx.callSession.findUnique({
          where: { id: sessionId },
          include: {
            callQueue: {
              include: {
                userCallScore: true
              }
            }
          }
        });

        if (!callSession) {
          throw new Error(`Call session ${sessionId} not found`);
        }

        // Process outcome using CallOutcomeManager
                 const outcomeContext: CallOutcomeContext = {
           sessionId,
           userId: Number(callSession.userId),
           agentId,
           callDurationSeconds: callSession.durationSeconds || 0,
           callStartedAt: callSession.startedAt,
           queueType: callSession.sourceQueueType || undefined
         };

        const outcomeResult = await this.callOutcomeManager.processOutcome(
          outcome.outcomeType as any,
          outcomeContext,
          outcome
        );

        // 1. Create CallOutcome record (preserve existing pattern)
        const callOutcome = await tx.callOutcome.create({
          data: {
            callSessionId: sessionId,
            outcomeType: outcome.outcomeType,
            outcomeNotes: outcomeResult.outcomeNotes || outcome.outcomeNotes,
            nextCallDelayHours: outcomeResult.nextCallDelayHours || outcome.nextCallDelayHours,
            magicLinkSent: outcomeResult.magicLinkSent || outcome.magicLinkSent || false,
            smsSent: outcomeResult.smsSent || outcome.smsSent || false,
            documentsRequested: outcomeResult.documentsRequested || outcome.documentsRequested || [],
            recordedByAgentId: agentId,
          },
        });

        // 2. Update denormalized CallSession fields
        await tx.callSession.update({
          where: { id: sessionId },
          data: {
            lastOutcomeType: outcome.outcomeType,
            lastOutcomeNotes: outcomeResult.outcomeNotes || outcome.outcomeNotes,
            lastOutcomeAgentId: agentId,
            lastOutcomeAt: new Date(),
            magicLinkSent: outcomeResult.magicLinkSent || outcome.magicLinkSent || false,
            smsSent: outcomeResult.smsSent || outcome.smsSent || false,
            callbackScheduled: !!(outcome.callbackDateTime || outcomeResult.callbackDateTime),
            followUpRequired: (outcomeResult.nextCallDelayHours !== null && outcomeResult.nextCallDelayHours !== undefined),
            updatedAt: new Date()
          },
        });

        // 3. Create callback if any outcome has callback data
        if (outcome.callbackDateTime || outcomeResult.callbackDateTime) {
          await tx.callback.create({
            data: {
              userId: callSession.userId,
              scheduledFor: outcomeResult.callbackDateTime || outcome.callbackDateTime!,
              callbackReason: outcomeResult.callbackReason || outcome.callbackReason || `Callback for ${outcome.outcomeType} outcome`,
              preferredAgentId: agentId, // Assign to current agent who processed the outcome
              originalCallSessionId: sessionId,
              status: 'pending',
            },
          });
          console.log(`📞 Created callback for ${outcomeResult.callbackDateTime || outcome.callbackDateTime} (outcome: ${outcome.outcomeType}) assigned to agent ${agentId}`);
        }

        // 4. Handle conversions using outcome result
        if (outcomeResult.conversions && outcomeResult.conversions.length > 0) {
          for (const conversion of outcomeResult.conversions) {
            await this.createConversion({
              tx,
              userId: Number(callSession.userId),
              agentId,
              outcomeType: outcome.outcomeType,
              outcomeNotes: outcomeResult.outcomeNotes,
              documentsRequested: outcomeResult.documentsRequested,
              queueType: callSession.sourceQueueType || 'unknown',
              totalAttempts: callSession.callQueue?.userCallScore?.totalAttempts || 0,
              claimId: callSession.callQueue?.claimId ? Number(callSession.callQueue.claimId) : undefined
            });
          }
        }

        // 5. Update user score using outcome result score adjustment
        await this.updateUserScoreAfterCall(
          tx,
          Number(callSession.userId),
          outcome.outcomeType,
          outcomeResult.scoreAdjustment
        );

        // 6. Check for pending callbacks for this user and mark them as completed
        await this.completeCallbacksForUser(tx, Number(callSession.userId), sessionId);

        console.log(`✅ Call outcome recorded successfully for session ${sessionId}`);
      });

    } catch (error: any) {
      console.error(`❌ Error recording call outcome:`, error);
      throw new Error(`Failed to record call outcome: ${error.message}`);
    }
  }

  /**
   * Get call history with filtering and pagination
   */
  async getCallHistory(options: GetCallHistoryOptions): Promise<CallHistoryResult> {
    const { page = 1, limit = 20, agentId, userId, startDate, endDate, outcome, status } = options;

    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (userId) where.userId = BigInt(userId);
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = startDate;
      if (endDate) where.startedAt.lte = endDate;
    }
    if (status) where.status = status;
    if (outcome) {
      where.callOutcomes = {
        some: { outcomeType: outcome }
      };
    }

    const [calls, total] = await Promise.all([
      this.deps.prisma.callSession.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          callOutcomes: true
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.deps.prisma.callSession.count({ where })
    ]);

    // Get user context for each call
    const callsWithContext = await Promise.all(
      calls.map(async (call: any) => {
        const userContext = await this.getUserCallContext(Number(call.userId));
        return {
          ...this.mapToCallSession(call),
          userContext,
          agent: call.agent
        };
      })
    );

    return {
      calls: callsWithContext,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get analytics for calls
   */
  async getCallAnalytics(filters: CallAnalyticsFilters): Promise<CallAnalytics> {
    const { agentId, startDate, endDate, outcomeType } = filters;

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
      this.deps.prisma.callSession.count({ where }),
      this.deps.prisma.callSession.count({ 
        where: { ...where, status: 'completed' } 
      }),
      this.deps.prisma.callOutcome.groupBy({
        by: ['outcomeType'],
        _count: { id: true },
        where: {
          callSession: where
        }
      }),
      this.deps.prisma.callSession.aggregate({
        where: { ...where, durationSeconds: { not: null } },
        _avg: { durationSeconds: true }
      }),
      this.deps.prisma.callSession.aggregate({
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
   * Get callbacks with filtering and pagination
   */
  async getCallbacks(options: GetCallbacksOptions): Promise<CallbacksResult> {
    const { page = 1, limit = 20, agentId, status, scheduledFrom, scheduledTo } = options;

    const where: any = {};
    if (agentId) where.preferredAgentId = agentId;
    if (status) where.status = status;
    if (scheduledFrom || scheduledTo) {
      where.scheduledFor = {};
      if (scheduledFrom) where.scheduledFor.gte = scheduledFrom;
      if (scheduledTo) where.scheduledFor.lte = scheduledTo;
    }

    const [callbacks, total] = await Promise.all([
      this.deps.prisma.callback.findMany({
        where,
        include: {
          preferredAgent: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { scheduledFor: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.deps.prisma.callback.count({ where })
    ]);

    // Get user context for each callback
    const callbacksWithContext = await Promise.all(
      callbacks.map(async (callback: any) => {
        const userContext = await this.getUserCallContext(Number(callback.userId));
        return {
          ...callback,
          user: {
            firstName: userContext.firstName,
            lastName: userContext.lastName,
            phoneNumber: userContext.phoneNumber
          },
          preferredAgent: callback.preferredAgent
        };
      })
    );

    return {
      callbacks: callbacksWithContext,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Handle Twilio webhook for call status updates
   */
  async handleTwilioWebhook(webhookData: TwilioWebhookData): Promise<void> {
    const { CallSid, CallStatus, Duration, CallDuration } = webhookData;

    // Find call session by Twilio SID
    const callSession = await this.deps.prisma.callSession.findFirst({
      where: { twilioCallSid: CallSid }
    });

    if (!callSession) {
      this.deps.logger.warn('Twilio webhook for unknown call session', { CallSid });
      return;
    }

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      'ringing': 'ringing',
      'in-progress': 'connected',
      'completed': 'completed',
      'busy': 'no_answer',
      'failed': 'hung_up', // Updated to new vocabulary
      'no-answer': 'no_answer',
      'canceled': 'hung_up' // Updated to new vocabulary
    };

    const updateData: CallUpdateOptions = {
              status: statusMap[CallStatus] as any || 'hung_up' // Updated to new vocabulary
    };

    // Set times based on status
    if (CallStatus === 'in-progress' && !callSession.connectedAt) {
      updateData.connectedAt = new Date();
    }

          if (['completed', 'busy', 'hung_up', 'no-answer', 'canceled'].includes(CallStatus)) {
      updateData.endedAt = new Date();
    }

    await this.updateCallStatus(callSession.id, updateData);

    this.deps.logger.info('Twilio webhook processed', {
      callSessionId: callSession.id,
      twilioStatus: CallStatus,
      ourStatus: updateData.status
    });
  }

  /**
   * Get all potentially stuck call sessions for cleanup
   */
  async getStuckCallSessions(olderThanMinutes: number = 30): Promise<CallSession[]> {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
    const stuckSessions = await this.deps.prisma.callSession.findMany({
      where: {
        status: { in: ['initiated', 'connecting', 'ringing', 'connected'] },
        startedAt: { lt: cutoffTime }
      },
      include: {
        agent: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return stuckSessions.map(session => this.mapToCallSession(session));
  }

  /**
   * Cleanup stuck call sessions (maintenance function)
   */
  async cleanupStuckSessions(olderThanMinutes: number = 30): Promise<number> {
    const stuckSessions = await this.getStuckCallSessions(olderThanMinutes);
    
    let cleaned = 0;
    for (const session of stuckSessions) {
      try {
        await this.forceEndCall(session.id, session.agentId, 'Auto-cleanup: stuck session');
        cleaned++;
      } catch (error) {
        this.deps.logger.error('Failed to cleanup stuck session', {
          sessionId: session.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.deps.logger.info('Cleanup completed', {
      found: stuckSessions.length,
      cleaned
    });

    return cleaned;
  }

  /**
   * Private helper methods
   */
  private async getUserCallContext(userId: number): Promise<UserCallContext> {
    try {
      // Use UserService to get real user data
      const userServiceContext = await this.userService.getUserCallContext(userId);
      
      if (userServiceContext) {
        // Map from UserService context to CallService context structure
        return {
          userId: userServiceContext.user.id,
          firstName: userServiceContext.user.firstName || 'Unknown',
          lastName: userServiceContext.user.lastName || 'User',
          email: userServiceContext.user.email || `user${userId}@unknown.com`,
          phoneNumber: userServiceContext.user.phoneNumber || '+44000000000',
          address: userServiceContext.user.address ? {
            fullAddress: userServiceContext.user.address.fullAddress || '',
            postCode: userServiceContext.user.address.postCode || '',
            county: userServiceContext.user.address.county || ''
          } : undefined,
          claims: userServiceContext.claims.map(claim => ({
            id: claim.id,
            type: claim.type || 'unknown',
            status: claim.status || 'unknown',
            lender: claim.lender || 'unknown',
            value: 0, // Would need to add this to the users module if needed
            requirements: claim.requirements.map(req => ({
              id: req.id,
              type: req.type || 'unknown',
              status: req.status || 'unknown',
              reason: req.reason || 'No reason provided'
            }))
          })),
          callScore: userServiceContext.callScore ? {
            currentScore: userServiceContext.callScore.currentScore,
            totalAttempts: userServiceContext.callScore.totalAttempts,
            lastOutcome: userServiceContext.callScore.lastOutcome || 'no_attempt'
          } : {
            currentScore: 50,
            totalAttempts: 0,
            lastOutcome: 'no_attempt'
          }
        };
      }
      
      // Fallback if user not found
      throw new Error(`User ${userId} not found`);
      
    } catch (error) {
      this.deps.logger.error(`Failed to get user context for ${userId}:`, error);
      throw error;
    }
  }

  private getDefaultDelayHours(outcomeType: string): number {
    // Use CallOutcomeManager for delay logic
    const handler = this.callOutcomeManager.getHandler(outcomeType as any);
    if (handler) {
      return handler.getDelayHours({} as any); // Simplified context for delay calculation
    }
    
    // Fallback mapping for legacy outcomes not in our new system
    const legacyDelayMap: Record<string, number> = {
      'contacted': 24,
      'busy': 2,
      'left_voicemail': 8,
      'failed': 1
    };
    return legacyDelayMap[outcomeType] || 4;
  }

  private async updateUserScoreAfterCall(
    tx: Prisma.TransactionClient,
    userId: number,
    outcomeType: string,
    scoreAdjustment?: number
  ): Promise<void> {
    try {
      // Get current user call score record 
      const userScore = await tx.userCallScore.findUnique({
        where: { userId: BigInt(userId) }
      });

      // Determine current queue type for this user
      const currentQueueType = await this.userService.determineUserQueueType(userId);
      
      // Check if we need a score reset (queue transition)
      const needsReset = userScore?.currentQueueType && 
        currentQueueType && 
        userScore.currentQueueType !== currentQueueType;

      // Create enhanced scoring context
      const scoringContext = {
        userId: Number(userId),
        userCreatedAt: new Date(), // We'll need to get this from user record
        currentTime: new Date(),
        lastResetDate: userScore?.lastResetDate || undefined,
        currentQueueType: userScore?.currentQueueType || undefined,
        previousQueueType: undefined, // Would need to track this separately
        lastOutcome: outcomeType,
        totalAttempts: userScore?.totalAttempts || 0,
        lastCallAt: new Date(),
        // ADDED: Whether this user has an existing scoring record
        hasExistingRecord: !!userScore,
        currentScore: userScore?.currentScore || 0
      };

      // Calculate new score using enhanced scoring service
      const newPriorityScore = await this.deps.scoringService.calculatePriority(scoringContext);

      // Check if outcome indicates conversion (score 200+)
      const shouldConvert = newPriorityScore.finalScore >= 200 || 
        ['requirements_completed', 'opted_out', 'already_completed'].includes(outcomeType);

      if (shouldConvert) {
        // Create conversion record
        await tx.conversion.create({
          data: {
            userId: BigInt(userId),
            previousQueueType: currentQueueType || 'unknown',
            conversionType: outcomeType === 'requirements_completed' ? 'completed' : 
                          outcomeType === 'opted_out' ? 'opted_out' : 'no_longer_eligible',
            conversionReason: `Outcome: ${outcomeType}, Final score: ${newPriorityScore.finalScore}`,
            finalScore: newPriorityScore.finalScore,
            totalCallAttempts: scoringContext.totalAttempts,
            lastCallAt: new Date(),
            convertedAt: new Date()
          }
        });

        // Mark user as inactive in scoring system
    await tx.userCallScore.upsert({
      where: { userId: BigInt(userId) },
      update: {
            isActive: false,
            currentScore: newPriorityScore.finalScore,
            updatedAt: new Date()
          },
          create: {
            userId: BigInt(userId),
            currentScore: newPriorityScore.finalScore,
            isActive: false,
            currentQueueType: currentQueueType,
            lastResetDate: needsReset ? new Date() : new Date(),
        lastOutcome: outcomeType,
        lastCallAt: new Date(),
            totalAttempts: 1
          }
        });

        this.deps.logger.info(`User ${userId} converted with outcome ${outcomeType}, score ${newPriorityScore.finalScore}`);
      } else {
        // Normal score update
        await tx.userCallScore.upsert({
          where: { userId: BigInt(userId) },
          update: {
            currentScore: newPriorityScore.finalScore,
            isActive: true,
            currentQueueType: currentQueueType,
            // FIXED: Set lastResetDate for existing users who don't have it (prevents future fresh start treatment)
            lastResetDate: needsReset ? new Date() : (userScore?.lastResetDate || new Date()),
            lastOutcome: outcomeType,
            lastCallAt: new Date(),
            totalAttempts: scoringContext.totalAttempts,
            successfulCalls: ['completed_form', 'going_to_complete', 'call_back'].includes(outcomeType) ? { increment: 1 } : undefined,
            lastQueueCheck: new Date(),
        updatedAt: new Date()
      },
      create: {
        userId: BigInt(userId),
            currentScore: newPriorityScore.finalScore,
            isActive: true,
            currentQueueType: currentQueueType,
            lastResetDate: new Date(),
        lastOutcome: outcomeType,
        lastCallAt: new Date(),
        totalAttempts: 1,
            successfulCalls: ['completed_form', 'going_to_complete', 'call_back'].includes(outcomeType) ? 1 : 0
          }
        });

        this.deps.logger.info(`Updated score for user ${userId}: ${newPriorityScore.finalScore} (${outcomeType})`);
      }

      // Remove from queue if converted or callback requested
              if (shouldConvert || outcomeType === 'call_back') {
        await tx.callQueue.updateMany({
          where: { 
            userId: BigInt(userId),
            status: 'pending'
          },
          data: { 
            status: shouldConvert ? 'converted' : 'completed',
            updatedAt: new Date()
      }
    });
      }

    } catch (error) {
      this.deps.logger.error(`Failed to update user score for ${userId}:`, error);
      // Don't throw - we don't want call outcome recording to fail due to scoring issues
    }
  }

  /**
   * Complete any pending callbacks for this user
   * Called after any call outcome is recorded to ensure callbacks are marked as complete
   */
  private async completeCallbacksForUser(
    tx: Prisma.TransactionClient,
    userId: number,
    completedCallSessionId: string
  ): Promise<void> {
    try {
      // Find all pending callbacks for this user
      const pendingCallbacks = await tx.callback.findMany({
        where: {
          userId: BigInt(userId),
          status: { in: ['pending', 'accepted'] }
        }
      });

      if (pendingCallbacks.length === 0) {
        return; // No callbacks to complete
      }

      // Mark all pending callbacks as completed
      const updatedCallbacks = await tx.callback.updateMany({
        where: {
          userId: BigInt(userId),
          status: { in: ['pending', 'accepted'] }
        },
        data: {
          status: 'completed',
          completedCallSessionId: completedCallSessionId
        }
      });

      // Remove any queue entries for these callbacks since they're now completed
      await tx.callQueue.deleteMany({
        where: {
          userId: BigInt(userId),
          callbackId: { in: pendingCallbacks.map(cb => cb.id) }
        }
      });

      console.log(`✅ Completed ${updatedCallbacks.count} callbacks for user ${userId} after call ${completedCallSessionId}`);

    } catch (error) {
      console.error(`⚠️ Failed to complete callbacks for user ${userId}:`, error);
      // Don't throw - we don't want call outcome recording to fail due to callback completion issues
    }
  }

  private calculateNextCallTime(outcomeType: string): Date {
    const now = new Date();
    const delayHours = this.getDefaultDelayHours(outcomeType);
    return new Date(now.getTime() + delayHours * 60 * 60 * 1000);
  }

  // Helper method to get userId from session
  private async getSessionUserId(sessionId: string, tx: any): Promise<bigint> {
    const session = await tx.callSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!session) throw new Error(`Call session ${sessionId} not found`);
    return session.userId;
  }

  /**
   * Mapping functions
   */
  private mapToCallSession(dbSession: any): CallSession {
    return {
      id: dbSession.id,
      userId: BigInt(dbSession.userId),
      agentId: dbSession.agentId,
      status: dbSession.status,
      twilioCallSid: dbSession.twilioCallSid,
      durationSeconds: dbSession.durationSeconds,
      recordingUrl: dbSession.recordingUrl,
      recordingDuration: dbSession.recordingDurationSeconds,
      recordingStatus: dbSession.recordingStatus,
      startedAt: dbSession.startedAt,
      endedAt: dbSession.endedAt,
      lastOutcomeType: dbSession.lastOutcomeType,
      lastOutcomeNotes: dbSession.lastOutcomeNotes,
      lastOutcomeAgentId: dbSession.lastOutcomeAgentId,
      lastOutcomeAt: dbSession.lastOutcomeAt,
      magicLinkSent: dbSession.magicLinkSent || false,
      smsSent: dbSession.smsSent || false,
      callbackScheduled: dbSession.callbackScheduled || false,
      followUpRequired: dbSession.followUpRequired || false,
      recordingTranscript: dbSession.transcriptText,
      transcriptStatus: dbSession.transcriptStatus,
      sourceQueueType: dbSession.sourceQueueType,
      createdAt: dbSession.createdAt,
      updatedAt: dbSession.updatedAt
    };
  }

  private mapToCallOutcome(dbOutcome: any): CallOutcome {
    return {
      id: dbOutcome.id,
      callSessionId: dbOutcome.callSessionId,
      outcomeType: dbOutcome.outcomeType,
      outcomeNotes: dbOutcome.outcomeNotes,
      nextCallDelayHours: dbOutcome.nextCallDelayHours,
      scoreAdjustment: dbOutcome.scoreAdjustment,
      magicLinkSent: dbOutcome.magicLinkSent,
      smsSent: dbOutcome.smsSent,
      documentsRequested: dbOutcome.documentsRequested ? 
        JSON.parse(dbOutcome.documentsRequested) : undefined,
      recordedByAgentId: dbOutcome.recordedByAgentId,
      createdAt: dbOutcome.createdAt
    };
  }

  /**
   * Check if an outcome type should trigger a conversion
   */
  private isConversionOutcome(outcomeType: string): boolean {
    const conversionOutcomes = [
      'requirements_completed',
      'signature_obtained', 
      'documents_received',
      'claim_completed',
      'signed'
    ];
    return conversionOutcomes.includes(outcomeType);
  }

  /**
   * Create a conversion record with agent attribution
   */
  private async createConversion({
    tx,
    userId,
    agentId,
    outcomeType,
    outcomeNotes,
    documentsRequested,
    queueType,
    totalAttempts,
    claimId
  }: {
    tx: any;
    userId: number;
    agentId: number;
    outcomeType: string;
    outcomeNotes?: string;
    documentsRequested?: string[];
    queueType: string;
    totalAttempts: number;
    claimId?: number;
  }): Promise<void> {
    try {
      // Get contributing agents from recent call sessions
      const recentSessions = await tx.callSession.findMany({
        where: {
          userId: BigInt(userId),
          startedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        select: {
          agentId: true,
          lastOutcomeType: true
        },
        distinct: ['agentId']
      });

      const contributingAgentIds = recentSessions
        .map((session: { agentId: number; lastOutcomeType: string | null }) => session.agentId)
        .filter((id: number) => id !== agentId); // Exclude primary agent

      // Determine conversion details
      const conversionType = this.mapOutcomeToConversionType(outcomeType);
      const signatureObtained = outcomeType.includes('sign') || outcomeType === 'signature_obtained';
      
      // Create conversion record
      await tx.conversion.create({
        data: {
          userId: BigInt(userId),
          previousQueueType: queueType,
          conversionType,
          conversionReason: outcomeNotes || `Converted via ${outcomeType}`,
          finalScore: 0, // Conversions always end with score 0
          totalCallAttempts: totalAttempts,
          lastCallAt: new Date(),
          convertedAt: new Date(),
          primaryAgentId: agentId,
          contributingAgents: contributingAgentIds.length > 0 ? contributingAgentIds : null,
          documentsReceived: documentsRequested || null,
          signatureObtained,
          requirementsMet: documentsRequested || null
        }
      });

      // Mark user as inactive in scoring system (converted)
      await tx.userCallScore.updateMany({
        where: { userId: BigInt(userId) },
        data: {
          isActive: false,
          currentScore: 0,
          updatedAt: new Date()
        }
      });

      // Remove from queue (converted)
      await tx.callQueue.updateMany({
        where: { 
          userId: BigInt(userId),
          status: 'pending'
        },
        data: { 
          status: 'converted',
          updatedAt: new Date()
        }
      });

      console.log(`🎉 Created conversion for user ${userId} by agent ${agentId} (${conversionType})`);

    } catch (error) {
      console.error(`❌ Failed to create conversion for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Map call outcome type to conversion type
   */
  private mapOutcomeToConversionType(outcomeType: string): string {
    const mapping: Record<string, string> = {
      'requirements_completed': 'requirements_completed',
      'signature_obtained': 'signed',
      'documents_received': 'info_received',
      'claim_completed': 'signed',
      'signed': 'signed'
    };
    return mapping[outcomeType] || 'requirements_completed';
  }
} 