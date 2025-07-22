import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server';
import { TRPCError } from '@trpc/server';
import { callSessionValidation } from '@/lib/validation/call-session';
import {
  CallService,
  type CallSessionOptions,
  type CallUpdateOptions,
  type CallOutcomeOptions,
  type GetCallHistoryOptions,
  type CallAnalyticsFilters,
  type GetCallbacksOptions
} from '@/modules/calls';
import { UserService } from '@/modules/users';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';

// Create logger instance (in production this would come from a shared logger service)
const logger = {
  info: (message: string, meta?: any) => console.log(`[Calls] ${message}`, meta),
  error: (message: string, error?: any) => console.error(`[Calls ERROR] ${message}`, error),
  warn: (message: string, meta?: any) => console.warn(`[Calls WARN] ${message}`, meta)
};

// Initialize services with dependencies
const userService = new UserService();
const callService = new CallService({ prisma, userService, logger });

// Input validation schemas
const InitiateCallSchema = z.object({
  userId: z.number().positive(),
  queueId: z.string().uuid().optional(),
  phoneNumber: z.string().optional(),
  direction: z.enum(['outbound', 'inbound']).default('outbound')
});

// Enhanced schema with UUID validation
const UpdateCallStatusSchema = z.object({
  sessionId: callSessionValidation.schema.shape.id, // Use our UUID validation
  status: z.enum(['initiated', 'connecting', 'ringing', 'connected', 'completed', 'failed', 'no_answer']).optional(),
  twilioCallSid: z.string().optional(),
  connectedAt: z.date().optional(),
  endedAt: z.date().optional(),
  failureReason: z.string().optional()
});

const RecordOutcomeSchema = z.object({
  sessionId: callSessionValidation.schema.shape.id, // Use our UUID validation
  outcomeType: z.enum(['contacted', 'no_answer', 'busy', 'wrong_number', 'not_interested', 'callback_requested', 'left_voicemail', 'failed']),
  outcomeNotes: z.string().optional(),
  magicLinkSent: z.boolean().default(false),
  smsSent: z.boolean().default(false),
  callbackScheduled: z.boolean().default(false),
  nextCallDelayHours: z.number().int().min(0).max(8760).optional(),
  documentsRequested: z.array(z.string()).optional(),
  followUpRequired: z.boolean().default(false)
});

const CallHistoryFiltersSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  agentId: z.number().optional(),
  userId: z.number().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  outcome: z.string().optional(),
  status: z.string().optional()
});

const CallAnalyticsFiltersSchema = z.object({
  agentId: z.number().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  outcomeType: z.string().optional()
});

const CallbackFiltersSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  agentId: z.number().optional(),
  status: z.enum(['pending', 'completed', 'cancelled']).optional(),
  scheduledFrom: z.date().optional(),
  scheduledTo: z.date().optional()
});

const TwilioWebhookSchema = z.object({
  CallSid: z.string(),
  CallStatus: z.string(),
  Direction: z.string(),
  From: z.string(),
  To: z.string(),
  Duration: z.string().optional(),
  CallDuration: z.string().optional(),
  RecordingUrl: z.string().optional(),
  Digits: z.string().optional()
});

// Add validation middleware for session ID parameters
const validateSessionId = (sessionId: string, context: string) => {
  try {
    return callSessionValidation.validateWithContext(sessionId, context);
  } catch (error: any) {
    console.error(`🚨 [tRPC VALIDATION] ${context}:`, error.message);
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid call session ID: ${error.message}`,
      cause: error
    });
  }
};

export const callsRouter = createTRPCRouter({
  // Initiate a new call session
  initiateCall: protectedProcedure
    .input(InitiateCallSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info('Initiating call with input:', { 
          userId: input.userId, 
          agentId: ctx.agent?.id,
          direction: input.direction 
        });

        // Validate agent context
        if (!ctx.agent?.id) {
          logger.error('No agent ID in context');
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Agent not authenticated'
          });
        }

        const callOptions: CallSessionOptions = {
          userId: input.userId,
          agentId: ctx.agent.id,
          queueId: input.queueId,
          direction: input.direction,
          phoneNumber: input.phoneNumber
        };

        logger.info('Calling callService.initiateCall with options:', callOptions);
        const result = await callService.initiateCall(callOptions);
        logger.info('Call initiated successfully:', { sessionId: result.callSession.id });
        return result;
      } catch (error: any) {
        logger.error('Failed to initiate call:', {
          error: error.message,
          stack: error.stack,
          input,
          agentId: ctx.agent?.id
        });
        
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Failed to initiate call',
          cause: error
        });
      }
    }),

  // Update call session status (typically from Twilio webhooks)
  updateCallStatus: protectedProcedure
    .input(UpdateCallStatusSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { sessionId, ...updateData } = input;
        
        // Validate session ID format
        validateSessionId(sessionId, 'updateCallStatus');
        
        const session = await callService.updateCallStatus(sessionId, updateData);
        return session;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to update call status'
        });
      }
    }),

  // Record call outcome and disposition
  recordOutcome: protectedProcedure
    .input(RecordOutcomeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { sessionId, ...outcomeData } = input;
        
        // Validate session ID format
        validateSessionId(sessionId, 'recordOutcome');
        
        const outcome = await callService.recordCallOutcome(sessionId, ctx.agent.id, outcomeData);
        return outcome;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to record call outcome'
        });
      }
    }),

  // Get call history with filtering and pagination
  getCallHistory: protectedProcedure
    .input(CallHistoryFiltersSchema)
    .query(async ({ input, ctx }) => {
      try {
        // If not admin/supervisor, limit to agent's own calls
        const filters = { ...input };
        if (ctx.agent.role === 'agent') {
          filters.agentId = ctx.agent.id;
        }

        const history = await callService.getCallHistory(filters);
        return history;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get call history'
        });
      }
    }),

  // Get call analytics and metrics
  getAnalytics: protectedProcedure
    .input(CallAnalyticsFiltersSchema)
    .query(async ({ input, ctx }) => {
      try {
        // If not admin/supervisor, limit to agent's own analytics
        const filters = { ...input };
        if (ctx.agent.role === 'agent') {
          filters.agentId = ctx.agent.id;
        }

        const analytics = await callService.getCallAnalytics(filters);
        return analytics;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get call analytics'
        });
      }
    }),

  // Get callbacks with filtering
  getCallbacks: protectedProcedure
    .input(CallbackFiltersSchema)
    .query(async ({ input, ctx }) => {
      try {
        // If not admin/supervisor, limit to agent's preferred callbacks
        const filters = { ...input };
        if (ctx.agent.role === 'agent') {
          filters.agentId = ctx.agent.id;
        }

        const callbacks = await callService.getCallbacks(filters);
        return callbacks;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get callbacks'
        });
      }
    }),

  // Get current call session for agent (if any)
  getCurrentCall: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Find current call session for this agent
        const currentSession = await prisma.callSession.findFirst({
          where: {
            agentId: ctx.agent.id,
            status: { in: ['initiated', 'connecting', 'ringing', 'connected'] }
          },
          orderBy: { startedAt: 'desc' }
        });

        if (!currentSession) {
          return null;
        }

        // Get user context for the current call
        const userContext = await callService['getUserCallContext'](Number(currentSession.userId));

        return {
          ...currentSession,
          userContext
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get current call'
        });
      }
    }),

  // Handle Twilio webhook (public endpoint, but we'll add auth later)
  handleTwilioWebhook: protectedProcedure // In production, this should be a public procedure with Twilio auth
    .input(TwilioWebhookSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        await callService.handleTwilioWebhook(input);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to process Twilio webhook'
        });
      }
    }),

  // Get call session by ID (for detailed view)
  getCallSession: protectedProcedure
    .input(z.object({
      sessionId: callSessionValidation.schema.shape.id // Use our UUID validation
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Validate session ID format
        validateSessionId(input.sessionId, 'getCallSession');
        
        const session = await prisma.callSession.findUnique({
          where: { id: input.sessionId },
          include: {
            agent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            callOutcomes: {
              include: {
                recordedByAgent: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        });

        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Call session not found'
          });
        }

        // Check permissions - agents can only see their own calls
        if (ctx.agent.role === 'agent' && session.agentId !== ctx.agent.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        // Get user context
        const userContext = await callService['getUserCallContext'](Number(session.userId));

        return {
          ...session,
          userContext,
          agent: session.agent
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get call session'
        });
      }
    }),

  // Get recording information for a call session
  getRecording: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const session = await prisma.callSession.findUnique({
          where: { id: input.sessionId },
          select: {
            id: true,
            agentId: true,
            recordingUrl: true,
            recordingSid: true,
            recordingStatus: true,
            recordingDurationSeconds: true,
            twilioCallSid: true,
            direction: true,
            startedAt: true,
            endedAt: true,
            durationSeconds: true,
            agent: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        });

        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Call session not found'
          });
        }

        // Check permissions - agents can only access their own call recordings
        if (ctx.agent.role === 'agent' && session.agentId !== ctx.agent.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        return {
          hasRecording: !!session.recordingUrl && session.recordingStatus === 'completed',
          recording: session.recordingUrl && session.recordingStatus === 'completed' ? {
            url: session.recordingUrl,
            sid: session.recordingSid,
            status: session.recordingStatus,
            durationSeconds: session.recordingDurationSeconds,
            callInfo: {
              sessionId: session.id,
              twilioCallSid: session.twilioCallSid,
              direction: session.direction,
              startedAt: session.startedAt,
              endedAt: session.endedAt,
              durationSeconds: session.durationSeconds,
              agentName: `${session.agent.firstName} ${session.agent.lastName}`
            }
          } : null,
          status: session.recordingStatus || 'no_recording',
          message: session.recordingStatus === 'failed' 
            ? 'Recording failed' 
            : session.recordingStatus === 'completed' 
              ? 'Recording available'
              : 'Recording not available'
        };

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get recording'
        });
      }
    }),

  // Get today's call summary for agent dashboard
  getTodaysSummary: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const analytics = await callService.getCallAnalytics({
          agentId: ctx.agent.id,
          startDate: today,
          endDate: new Date()
        });

        return {
          callsToday: analytics.totalCalls,
          contactsToday: analytics.successfulContacts,
          avgTalkTime: analytics.avgTalkTimeMinutes,
          contactRate: analytics.contactRate
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get today\'s summary'
        });
      }
    }),

  // Force end a call session (for stuck calls)
  forceEndCall: protectedProcedure
    .input(z.object({
      sessionId: callSessionValidation.schema.shape.id, // Use our UUID validation
      reason: z.string().optional().default('Force ended by agent')
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate session ID format
        validateSessionId(input.sessionId, 'forceEndCall');
        
        await callService.forceEndCall(input.sessionId, ctx.agent.id, input.reason);
        return { success: true, message: 'Call session force ended' };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to force end call'
        });
      }
    }),

  // Get stuck call sessions for debugging
  getStuckSessions: protectedProcedure
    .input(z.object({
      olderThanMinutes: z.number().min(1).max(1440).default(30)
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Only allow admin/supervisor to see all stuck sessions
        if (ctx.agent.role === 'agent') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        const stuckSessions = await callService.getStuckCallSessions(input.olderThanMinutes);
        return {
          sessions: stuckSessions,
          count: stuckSessions.length,
          olderThanMinutes: input.olderThanMinutes
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get stuck sessions'
        });
      }
    }),

  // Cleanup stuck sessions (admin only)
  cleanupStuckSessions: protectedProcedure
    .input(z.object({
      olderThanMinutes: z.number().min(1).max(1440).default(30)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Only allow admin to run cleanup
        if (ctx.agent.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required'
          });
        }

        const cleanedCount = await callService.cleanupStuckSessions(input.olderThanMinutes);
        return {
          success: true,
          cleanedCount,
          message: `Cleaned up ${cleanedCount} stuck call sessions`
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cleanup stuck sessions'
        });
      }
    }),

  // Get call history formatted for table display
  getCallHistoryTable: protectedProcedure
    .input(CallHistoryFiltersSchema)
    .query(async ({ input, ctx }) => {
      try {
        // If not admin/supervisor, limit to agent's own calls
        const filters = { ...input };
        if (ctx.agent.role === 'agent') {
          filters.agentId = ctx.agent.id;
        }

        // Get call sessions with outcomes and user/agent details
        const callSessions = await prisma.callSession.findMany({
          where: {
            ...(filters.agentId && { agentId: filters.agentId }),
            ...(filters.userId && { userId: filters.userId }),
            ...(filters.startDate && { startedAt: { gte: filters.startDate } }),
            ...(filters.endDate && { startedAt: { lte: filters.endDate } }),
            ...(filters.status && { status: filters.status })
          },
          include: {
            agent: {
              select: {
                firstName: true,
                lastName: true
              }
            },
            callOutcomes: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          },
          orderBy: { startedAt: 'desc' },
          skip: (filters.page - 1) * filters.limit,
          take: filters.limit
        });

        // Get user details from replica DB for each call
        const userIds = [...new Set(callSessions.map((call: any) => call.userId))];
        const users = userIds.length > 0 ? await replicaDb.user.findMany({
          where: {
            id: {
              in: userIds.map(id => BigInt(id))
            }
          },
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phone_number: true
          }
        }) : [];

        const userMap = new Map(users.map(user => [Number(user.id), user]));

        // Format for table display
        const formattedCalls = callSessions.map((session: any) => {
          const user = userMap.get(Number(session.userId));
          const outcome = session.callOutcomes[0];
          
          return {
            id: session.id,
            userId: Number(session.userId),
            userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown User',
            userPhone: user?.phone_number || 'Unknown',
            agentId: session.agentId,
            agentName: `${session.agent.firstName} ${session.agent.lastName}`,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            durationSeconds: session.durationSeconds,
            talkTimeSeconds: session.talkTimeSeconds,
            outcome: outcome?.outcomeType || 'no_outcome',
            outcomeNotes: outcome?.outcomeNotes,
            magicLinkSent: outcome?.magicLinkSent || false,
            smsSent: outcome?.smsSent || false,
            nextCallDelay: outcome?.nextCallDelayHours,
            documentsRequested: outcome?.documentsRequested ? JSON.parse(outcome.documentsRequested) : [],
            twilioCallSid: session.twilioCallSid
          };
        });

        const total = await prisma.callSession.count({
          where: {
            ...(filters.agentId && { agentId: filters.agentId }),
            ...(filters.userId && { userId: filters.userId }),
            ...(filters.startDate && { startedAt: { gte: filters.startDate } }),
            ...(filters.endDate && { startedAt: { lte: filters.endDate } }),
            ...(filters.status && { status: filters.status })
          }
        });

        return {
          calls: formattedCalls,
          meta: {
            page: filters.page,
            limit: filters.limit,
            total,
            totalPages: Math.ceil(total / filters.limit)
          }
        };
      } catch (error) {
        logger.error('Failed to get call history table', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get call history'
        });
      }
    })
}); 