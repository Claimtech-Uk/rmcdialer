import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/lib/trpc/server'
import { TRPCError } from '@trpc/server'
import { AuthService, type LoginRequest, type AgentStatusUpdate } from '@/modules/auth'
import { prisma } from '@/lib/db'

// Create logger instance (in production this would come from a shared logger service)
const logger = {
  info: (message: string, meta?: any) => console.log(`[Auth] ${message}`, meta),
  error: (message: string, error?: any) => console.error(`[Auth ERROR] ${message}`, error),
  warn: (message: string, meta?: any) => console.warn(`[Auth WARN] ${message}`, meta)
}

// Initialize auth service with dependencies
const authService = new AuthService({ prisma, logger })

// Input validation schemas
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

const StatusUpdateSchema = z.object({
  status: z.enum(['available', 'on_call', 'break', 'offline']),
  breakReason: z.string().optional()
})

const PerformanceQuerySchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional()
})

export const authRouter = createTRPCRouter({
  // Authenticate agent with email and password
  login: publicProcedure
    .input(LoginSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info('Login attempt', { email: input.email })
        const result = await authService.login(input)
        logger.info('Login successful', { email: input.email, hasData: !!result.data })
        return result.data
      } catch (error) {
        logger.error('Login failed', { email: input.email, error: error instanceof Error ? error.message : String(error) })
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials'
        })
      }
    }),

  // Get current agent profile and session
  me: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const [agent, session, permissions] = await Promise.all([
          authService.getAgentProfile(ctx.agent.id),
          authService.getAgentStatus(ctx.agent.id),
          authService.getAgentPermissions(ctx.agent.role)
        ])

        if (!agent) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Agent not found'
          })
        }

        return {
          agent,
          session,
          permissions
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get agent profile'
        })
      }
    }),

  // Logout agent and end session
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        await authService.logout(ctx.agent.id)
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to logout'
        })
      }
    }),

  // Update agent status (available, break, offline, etc.)
  updateStatus: protectedProcedure
    .input(StatusUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const session = await authService.setAgentStatus(ctx.agent.id, input)
        return session
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to update status'
        })
      }
    }),

  // Get current session status
  getStatus: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const status = await authService.getAgentStatus(ctx.agent.id)
        return status
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get status'
        })
      }
    }),

  // Get agent performance metrics
  getPerformance: protectedProcedure
    .input(PerformanceQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        const performance = await authService.getAgentPerformance(
          ctx.agent.id,
          input.startDate,
          input.endDate
        )
        return performance
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get performance data'
        })
      }
    }),

  // Get all agents status (for supervisors)
  getAllAgentsStatus: protectedProcedure
    .query(async ({ ctx }) => {
      // Check permissions
      const permissions = authService.getAgentPermissions(ctx.agent.role)
      if (!permissions.canViewSupervisorDashboard) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        })
      }

      try {
        const agentsStatus = await authService.getAllAgentsStatus()
        return agentsStatus
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get agents status'
        })
      }
    }),

  // Cleanup inactive agents (for admin/system)
  cleanupInactiveAgents: protectedProcedure
    .input(z.object({
      maxInactiveHours: z.number().min(1).max(24).default(8)
    }))
    .mutation(async ({ input, ctx }) => {
      // Check permissions - only admin can run cleanup
      if (ctx.agent.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admin can cleanup inactive agents'
        })
      }

      try {
        const loggedOutCount = await authService.logoutInactiveAgents(input.maxInactiveHours)
        return { loggedOutCount }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cleanup inactive agents'
        })
      }
    })
}) 