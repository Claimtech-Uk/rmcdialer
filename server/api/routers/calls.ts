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
import { PriorityScoringService } from '@/modules/scoring/services/priority-scoring.service';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { CallOutcomeType } from '@/modules/call-outcomes/types/call-outcome.types';

// Create array of outcome types for validation
const outcomeTypeValues = [
  'completed_form',
  'going_to_complete', 
  'might_complete',
  'call_back',
  'no_answer',
  'missed_call',
  'hung_up',
  'bad_number',
  'no_claim',
  'not_interested',
  'do_not_contact'
] as const;

// Create logger instance (in production this would come from a shared logger service)
const logger = {
  info: (message: string, meta?: any) => console.log(`[Calls] ${message}`, meta),
  error: (message: string, error?: any) => console.error(`[Calls ERROR] ${message}`, error),
  warn: (message: string, meta?: any) => console.warn(`[Calls WARN] ${message}`, meta)
};

// Initialize services with dependencies
const userService = new UserService();
const scoringService = new PriorityScoringService({ logger });
const callService = new CallService({ prisma, userService, scoringService, logger });

// Input validation schemas
const InitiateCallSchema = z.object({
  userId: z.number().positive(),
  queueId: z.string().uuid().optional(),
  phoneNumber: z.string().optional(),
  direction: z.enum(['outbound', 'inbound']).default('outbound'),
  twilioCallSid: z.string().optional() // For matching existing webhook sessions
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
  outcomeType: z.enum(outcomeTypeValues), // Updated to use new vocabulary
  outcomeNotes: z.string().optional(),
  magicLinkSent: z.boolean().default(false),
  smsSent: z.boolean().default(false),
  callbackScheduled: z.boolean().default(false),
  nextCallDelayHours: z.number().int().min(0).max(8760).optional(),
  documentsRequested: z.array(z.string()).optional(),
  followUpRequired: z.boolean().default(false),
  // Callback-specific fields
  callbackDateTime: z.date().optional(),
  callbackReason: z.string().optional()
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

const FindSessionByCallSidSchema = z.object({
  callSid: z.string().min(1, 'CallSid is required')
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

  // Record call outcome
  recordOutcome: protectedProcedure
    .input(RecordOutcomeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(`📋 Recording outcome via tRPC:`, input);
        
        await callService.recordCallOutcome(
          input.sessionId,
          ctx.agent.id,
          {
            outcomeType: input.outcomeType,
            outcomeNotes: input.outcomeNotes,
            magicLinkSent: input.magicLinkSent,
            smsSent: input.smsSent,
            nextCallDelayHours: input.nextCallDelayHours,
            documentsRequested: input.documentsRequested,
            callbackDateTime: input.callbackDateTime,
            callbackReason: input.callbackReason,
          }
        );

        console.log(`✅ Call outcome recorded successfully via tRPC`);
        
        // Return success status
        return {
          success: true,
          message: 'Call outcome recorded successfully'
        };
        
      } catch (error: any) {
        console.error(`❌ tRPC recordOutcome error:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to record call outcome: ${error.message}`,
        });
      }
    }),

  // Find call session by Twilio CallSid
  findSessionByCallSid: protectedProcedure
    .input(FindSessionByCallSidSchema)
    .query(async ({ input, ctx }) => {
      try {
        console.log(`🔍 Looking up session by CallSid: ${input.callSid}`);
        
        const session = await prisma.callSession.findFirst({
          where: {
            twilioCallSid: input.callSid
          },
          select: {
            id: true,
            userId: true,
            agentId: true,
            direction: true,
            status: true,
            startedAt: true
          }
        });

        if (!session) {
          console.log(`⚠️ No session found for CallSid: ${input.callSid}`);
          return { sessionId: null };
        }

        console.log(`✅ Found session ${session.id} for CallSid: ${input.callSid}`);
        return { 
          sessionId: session.id,
          userId: Number(session.userId),
          agentId: session.agentId,
          direction: session.direction,
          status: session.status
        };
        
      } catch (error: any) {
        console.error(`❌ Error finding session by CallSid:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to find session: ${error.message}`,
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

  // Get call session by Twilio Call SID (for inbound call interface)
  getCallSessionByCallSid: protectedProcedure
    .input(z.object({
      callSid: z.string().min(1) // Twilio Call SID
    }))
    .query(async ({ input, ctx }) => {
      try {
        console.log(`🔍 Looking up call session by Twilio Call SID: ${input.callSid}`);
        
        // CRITICAL: Validate Twilio Call SID format
        if (!input.callSid.startsWith('CA') || input.callSid.length !== 34) {
          console.error(`🚨 Invalid Twilio Call SID format: ${input.callSid}`);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid Twilio Call SID format. Expected format: CA + 32 characters. Received: ${input.callSid} (length: ${input.callSid.length})`
          });
        }
        
        const session = await prisma.callSession.findFirst({
          where: { twilioCallSid: input.callSid },
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
          console.log(`❓ No call session found for Call SID: ${input.callSid}`);
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Call session not found for Call SID: ${input.callSid}. This may indicate the call was not properly recorded in the database.`
          });
        }

        // Check permissions - agents can only see their own calls
        if (ctx.agent.role === 'agent' && session.agentId !== ctx.agent.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        console.log(`✅ Found call session: ${session.id} for user ${session.userId}`);

        return {
          success: true,
          callSession: {
            id: session.id,
            userId: Number(session.userId), // Convert BigInt to number
            agentId: session.agentId,
            twilioCallSid: session.twilioCallSid,
            status: session.status,
            direction: session.direction,
            startedAt: session.startedAt,
            connectedAt: session.connectedAt,
            endedAt: session.endedAt,
            userClaimsContext: session.userClaimsContext,
            agent: session.agent,
            callOutcomes: session.callOutcomes
          }
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error(`❌ Failed to get call session by Call SID ${input.callSid}:`, error);
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
            sessionId: session.id,
            twilioCallSid: session.twilioCallSid,
            recordingSid: session.recordingSid,
            status: session.recordingStatus,
            durationSeconds: session.recordingDurationSeconds,
            streamUrl: `/api/calls/${input.sessionId}/recording?action=stream`,
            downloadUrl: `/api/calls/${input.sessionId}/recording?action=download`,
            callInfo: {
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
          select: {
            id: true,
            userId: true,
            agentId: true,
            status: true,
            direction: true,
            startedAt: true,
            connectedAt: true,
            endedAt: true,
            durationSeconds: true,
            talkTimeSeconds: true,
            twilioCallSid: true,
            
            // Recording fields
            recordingUrl: true,
            recordingSid: true,
            recordingStatus: true,
            recordingDurationSeconds: true,
            
            // **CONSOLIDATED OUTCOME FIELDS**
            lastOutcomeType: true,
            lastOutcomeNotes: true,
            lastOutcomeAgentId: true,
            lastOutcomeAt: true,
            
            // Action flags
            magicLinkSent: true,
            smsSent: true,
            callbackScheduled: true,
            followUpRequired: true,
            
            // Relations
            agent: {
              select: {
                firstName: true,
                lastName: true
              }
            },
            // **FALLBACK: Include CallOutcome for missing consolidated fields**
            callOutcomes: {
              select: {
                nextCallDelayHours: true,
                scoreAdjustment: true,
                documentsRequested: true,
                createdAt: true
              },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          },
          orderBy: { startedAt: 'desc' },
          take: filters.limit || 25,
          skip: (filters.page - 1) * (filters.limit || 25)
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
          const latestOutcome = session.callOutcomes[0]; // Fallback outcome data
          
          // Use consolidated CallSession outcome data with CallOutcome fallback
          const outcomeType = session.lastOutcomeType;
          const outcomeNotes = session.lastOutcomeNotes;
          
          // Smart outcome determination - if call has duration but no outcome, infer it was connected
          let smartOutcome = outcomeType;
          if (!smartOutcome || smartOutcome === 'no_outcome') {
            if (session.durationSeconds && session.durationSeconds > 0) {
              // Call had duration, likely was answered
              smartOutcome = 'contacted';
            } else if (session.status === 'no_answer') {
              smartOutcome = 'no_answer';
            } else if (session.status === 'failed') {
              smartOutcome = 'failed';
            } else {
              smartOutcome = 'no_outcome';
            }
          }

          // Calculate talk time more accurately
          let calculatedTalkTime = session.talkTimeSeconds;
          if (!calculatedTalkTime && session.durationSeconds && session.durationSeconds > 0) {
            // If no talk time but has duration, use duration as estimate
            calculatedTalkTime = session.durationSeconds;
          }

          return {
            id: session.id,
            userId: Number(session.userId),
            userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown User',
            userPhone: user?.phone_number || 'Unknown',
            agentId: session.agentId,
            agentName: `${session.agent.firstName} ${session.agent.lastName}`,
            direction: session.direction, // Added direction field
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            durationSeconds: session.durationSeconds,
            talkTimeSeconds: calculatedTalkTime,
            outcome: smartOutcome,
            outcomeNotes: outcomeNotes,
            magicLinkSent: session.magicLinkSent || false,
            smsSent: session.smsSent || false,
            callbackScheduled: session.callbackScheduled || false, // Now using CallSession field
            followUpRequired: session.followUpRequired || false,
            nextCallDelay: latestOutcome?.nextCallDelayHours || null, // Fallback to CallOutcome
            documentsRequested: (() => {
              if (!latestOutcome?.documentsRequested) return [];
              try {
                // Handle both string and already-parsed JSON
                if (typeof latestOutcome.documentsRequested === 'string') {
                  // Validate string is not empty before parsing
                  const trimmed = latestOutcome.documentsRequested.trim();
                  if (!trimmed || trimmed === '""' || trimmed === "''") return [];
                  return JSON.parse(trimmed);
                } else {
                  // Already parsed JSON from Prisma
                  return Array.isArray(latestOutcome.documentsRequested) ? latestOutcome.documentsRequested : [];
                }
              } catch (error) {
                                 console.error('Failed to parse documentsRequested JSON', { 
                   value: latestOutcome.documentsRequested,
                   error: error instanceof Error ? error.message : String(error)
                 });
                return [];
              }
            })(),
            twilioCallSid: session.twilioCallSid,
            recordingUrl: session.recordingUrl,
            recordingStatus: session.recordingStatus,
            recordingDurationSeconds: session.recordingDurationSeconds,
            status: session.status,
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