import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server';
import { TRPCError } from '@trpc/server';
import { prisma } from '@/lib/db';
import { TeamType, getTeamConfig, validateTeamAccess } from '@/lib/config/teams';

// Input validation schemas
const TeamTypeSchema = z.enum(['unsigned', 'requirements']);

const AutoDialerSettingsSchema = z.object({
  timeBetweenCallsSeconds: z.number().min(10).max(300),
  autoStartEnabled: z.boolean(),
  maxCallsPerSession: z.number().min(10).max(200),
  breakIntervalMinutes: z.number().min(30).max(480),
  audioNotificationsEnabled: z.boolean(),
  keyboardShortcutsEnabled: z.boolean()
});

const StartSessionSchema = z.object({
  teamType: TeamTypeSchema,
  autoStart: z.boolean().default(false)
});

const UpdateSessionStatsSchema = z.object({
  callsCompleted: z.number().optional(),
  lastCallAt: z.date().optional()
});

export const autoDialerRouter = createTRPCRouter({
  // Get agent's auto-dialer settings
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const settings = await prisma.autoDialerSettings.findFirst({
          where: { agentId: ctx.agent.id }
        });

        if (!settings) {
          // Return default settings if none exist
          const teamConfig = getTeamConfig(ctx.agent.team as TeamType || 'unsigned');
          return {
            id: null,
            agentId: ctx.agent.id,
            team: ctx.agent.team || 'general',
            timeBetweenCallsSeconds: teamConfig.callSettings.defaultTimeBetweenCalls,
            autoStartEnabled: false,
            maxCallsPerSession: teamConfig.callSettings.maxCallsPerSession,
            breakIntervalMinutes: teamConfig.callSettings.breakIntervalMinutes,
            audioNotificationsEnabled: true,
            keyboardShortcutsEnabled: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }

        return settings;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get auto-dialer settings'
        });
      }
    }),

  // Update auto-dialer settings
  updateSettings: protectedProcedure
    .input(AutoDialerSettingsSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const settings = await prisma.autoDialerSettings.upsert({
          where: { agentId: ctx.agent.id },
          update: {
            ...input,
            team: ctx.agent.team || 'general',
            updatedAt: new Date()
          },
          create: {
            agentId: ctx.agent.id,
            team: ctx.agent.team || 'general',
            ...input
          }
        });

        return settings;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update auto-dialer settings'
        });
      }
    }),

  // Start auto-dialer session
  startSession: protectedProcedure
    .input(StartSessionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { teamType, autoStart } = input;
        const teamConfig = getTeamConfig(teamType);
        
        // Validate agent has access to this team
        if (!validateTeamAccess(ctx.agent.team, teamType)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Access denied to ${teamConfig.displayName}`
          });
        }

        // Try to update existing active session first
        const existingSession = await prisma.agentSession.updateMany({
          where: { 
            agentId: ctx.agent.id,
            logoutAt: null
          },
          data: {
            autoDialerActive: true,
            autoDialerQueueType: teamConfig.queueType,
            callsCompletedInSession: 0,
            lastActivity: new Date()
          }
        });

        // If no active session exists, create a new one for authenticated agent
        if (existingSession.count === 0) {
          console.log(`🔄 No active session found for agent ${ctx.agent.id}, creating new session for auto dialer`);
          
          await prisma.agentSession.create({
            data: {
              agentId: ctx.agent.id,
              status: 'available',
              autoDialerActive: true,
              autoDialerQueueType: teamConfig.queueType,
              callsCompletedInSession: 0,
              deviceConnected: true, // Assume connected since they're authenticated
              lastActivity: new Date(),
              lastHeartbeat: new Date()
            }
          });
          
          console.log(`✅ Created new agent session for agent ${ctx.agent.id} to start auto dialer`);
        }

        return { 
          success: true, 
          teamType,
          queueType: teamConfig.queueType,
          autoStart 
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to start auto-dialer session'
        });
      }
    }),

  // End auto-dialer session
  endSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const agentSession = await prisma.agentSession.updateMany({
          where: { 
            agentId: ctx.agent.id,
            logoutAt: null
          },
          data: {
            autoDialerActive: false,
            autoDialerQueueType: null,
            lastActivity: new Date()
          }
        });

        return { success: true, sessionsUpdated: agentSession.count };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to end auto-dialer session'
        });
      }
    }),

  // Get current session status
  getSessionStatus: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const agentSession = await prisma.agentSession.findFirst({
          where: { 
            agentId: ctx.agent.id,
            logoutAt: null
          },
          orderBy: { loginAt: 'desc' }
        });

        if (!agentSession) {
          return {
            isActive: false,
            queueType: null,
            callsCompletedInSession: 0,
            sessionStartTime: null
          };
        }

        return {
          isActive: agentSession.autoDialerActive,
          queueType: agentSession.autoDialerQueueType,
          callsCompletedInSession: agentSession.callsCompletedInSession,
          sessionStartTime: agentSession.loginAt,
          lastActivity: agentSession.lastActivity,
          lastAutoCallAt: agentSession.lastAutoCallAt
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get session status'
        });
      }
    }),

  // Update session statistics
  updateSessionStats: protectedProcedure
    .input(UpdateSessionStatsSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const updateData: any = {
          lastActivity: new Date()
        };

        if (input.callsCompleted !== undefined) {
          updateData.callsCompletedInSession = { increment: input.callsCompleted };
        }

        if (input.lastCallAt) {
          updateData.lastAutoCallAt = input.lastCallAt;
        }

        const agentSession = await prisma.agentSession.updateMany({
          where: { 
            agentId: ctx.agent.id,
            logoutAt: null,
            autoDialerActive: true
          },
          data: updateData
        });

        return { success: true, sessionsUpdated: agentSession.count };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update session statistics'
        });
      }
    }),

  // Get session analytics
  getSessionAnalytics: protectedProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { startDate, endDate } = input;
        const where: any = { agentId: ctx.agent.id };

        if (startDate || endDate) {
          where.loginAt = {};
          if (startDate) where.loginAt.gte = startDate;
          if (endDate) where.loginAt.lte = endDate;
        }

        const sessions = await prisma.agentSession.findMany({
          where,
          select: {
            autoDialerActive: true,
            autoDialerQueueType: true,
            callsCompletedInSession: true,
            loginAt: true,
            logoutAt: true,
            lastAutoCallAt: true
          }
        });

        const analytics = {
          totalSessions: sessions.length,
          autoDialerSessions: sessions.filter(s => s.autoDialerActive).length,
          totalCallsCompleted: sessions.reduce((sum, s) => sum + (s.callsCompletedInSession || 0), 0),
          avgCallsPerSession: 0,
          queueTypeBreakdown: {} as Record<string, number>,
          lastSessionDate: sessions.length > 0 ? sessions[0].loginAt : null
        };

        // Calculate averages
        const activeDialerSessions = sessions.filter(s => s.autoDialerActive && s.callsCompletedInSession > 0);
        if (activeDialerSessions.length > 0) {
          analytics.avgCallsPerSession = analytics.totalCallsCompleted / activeDialerSessions.length;
        }

        // Queue type breakdown
        sessions.forEach(session => {
          if (session.autoDialerQueueType) {
            analytics.queueTypeBreakdown[session.autoDialerQueueType] = 
              (analytics.queueTypeBreakdown[session.autoDialerQueueType] || 0) + 1;
          }
        });

        return analytics;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get session analytics'
        });
      }
    }),

  // Reset settings to defaults
  resetSettings: protectedProcedure
    .input(z.object({ teamType: TeamTypeSchema }))
    .mutation(async ({ input, ctx }) => {
      try {
        const teamConfig = getTeamConfig(input.teamType);
        
        // Validate team access
        if (!validateTeamAccess(ctx.agent.team, input.teamType)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Access denied to ${teamConfig.displayName}`
          });
        }

        const defaultSettings = {
          timeBetweenCallsSeconds: teamConfig.callSettings.defaultTimeBetweenCalls,
          autoStartEnabled: false,
          maxCallsPerSession: teamConfig.callSettings.maxCallsPerSession,
          breakIntervalMinutes: teamConfig.callSettings.breakIntervalMinutes,
          audioNotificationsEnabled: true,
          keyboardShortcutsEnabled: true
        };

        const settings = await prisma.autoDialerSettings.upsert({
          where: { agentId: ctx.agent.id },
          update: {
            ...defaultSettings,
            team: ctx.agent.team || 'general',
            updatedAt: new Date()
          },
          create: {
            agentId: ctx.agent.id,
            team: ctx.agent.team || 'general',
            ...defaultSettings
          }
        });

        return settings;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset settings'
        });
      }
    })
}); 