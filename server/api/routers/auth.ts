import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/lib/trpc/server'
import { TRPCError } from '@trpc/server'
import { AuthService, type LoginRequest, type AgentStatusUpdate, type CreateAgentRequest } from '@/modules/auth'
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

// Agent Management Schemas
const CreateAgentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['agent', 'supervisor', 'admin']),
  isAiAgent: z.boolean().default(false)
})

const UpdateAgentSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['agent', 'supervisor', 'admin']).optional(),
  isActive: z.boolean().optional(),
  isAiAgent: z.boolean().optional(),
  twilioWorkerSid: z.string().nullable().optional()
})

const DeleteAgentSchema = z.object({
  id: z.number()
})

const GetAgentsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  role: z.enum(['agent', 'supervisor', 'admin']).optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional()
})

const ResetPasswordSchema = z.object({
  id: z.number(),
  newPassword: z.string().min(8)
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

  // 🎯 ENHANCED: Logout agent with availability-preserving logic
  logout: protectedProcedure
    .input(z.object({ forceOffline: z.boolean().optional().default(false) }))
    .mutation(async ({ input, ctx }) => {
      try {
        await authService.logout(ctx.agent.id, input.forceOffline)
        return { 
          success: true,
          status: input.forceOffline ? 'offline' : 'break',
          preservedSession: !input.forceOffline
        }
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
    }),

  // ===============================================
  // AGENT MANAGEMENT ENDPOINTS (Admin Only)
  // ===============================================

  // Create new agent (admin only)
  createAgent: protectedProcedure
    .input(CreateAgentSchema)
    .mutation(async ({ input, ctx }) => {
      // Check permissions - only admin can create agents
      if (ctx.agent.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admin can create agents'
        })
      }

      try {
        const agent = await authService.createAgent(input)
        logger.info('Agent created', { 
          createdById: ctx.agent.id, 
          newAgentEmail: input.email,
          newAgentRole: input.role 
        })
        return agent
      } catch (error: any) {
        logger.error('Failed to create agent', { 
          error: error.message, 
          email: input.email 
        })
        
        // Handle unique constraint errors
        if (error.message.includes('email') || error.code === 'P2002') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'An agent with this email already exists'
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create agent'
        })
      }
    }),

  // Update agent (admin only)
  updateAgent: protectedProcedure
    .input(UpdateAgentSchema)
    .mutation(async ({ input, ctx }) => {
      // Check permissions - only admin can update agents
      if (ctx.agent.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admin can update agents'
        })
      }

      try {
        // Handle null twilioWorkerSid by converting to undefined
        const updateData = {
          ...input,
          twilioWorkerSid: input.twilioWorkerSid === null ? undefined : input.twilioWorkerSid
        };
        const agent = await authService.updateAgent(input.id, updateData)
        logger.info('Agent updated', { 
          updatedById: ctx.agent.id, 
          agentId: input.id 
        })
        return agent
      } catch (error: any) {
        logger.error('Failed to update agent', { 
          error: error.message, 
          agentId: input.id 
        })

        if (error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Agent not found'
          })
        }

        if (error.message.includes('email') || error.code === 'P2002') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'An agent with this email already exists'
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update agent'
        })
      }
    }),

  // Delete agent (admin only)
  deleteAgent: protectedProcedure
    .input(DeleteAgentSchema)
    .mutation(async ({ input, ctx }) => {
      // Check permissions - only admin can delete agents
      if (ctx.agent.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admin can delete agents'
        })
      }

      // Prevent self-deletion
      if (input.id === ctx.agent.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete your own account'
        })
      }

      try {
        await authService.deleteAgent(input.id)
        logger.info('Agent deleted', { 
          deletedById: ctx.agent.id, 
          agentId: input.id 
        })
        return { success: true }
      } catch (error: any) {
        logger.error('Failed to delete agent', { 
          error: error.message, 
          agentId: input.id 
        })

        if (error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Agent not found'
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete agent'
        })
      }
    }),

  // Get all agents with filtering (admin/supervisor)
  getAllAgents: protectedProcedure
    .input(GetAgentsSchema)
    .query(async ({ input, ctx }) => {
      // Check permissions
      const permissions = authService.getAgentPermissions(ctx.agent.role)
      if (!permissions.canManageAgents && !permissions.canViewSupervisorDashboard) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to view agents'
        })
      }

      try {
        const result = await authService.getAllAgents(input)
        return result
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get agents'
        })
      }
    }),

  // Reset agent password (admin only)
  resetAgentPassword: protectedProcedure
    .input(ResetPasswordSchema)
    .mutation(async ({ input, ctx }) => {
      // Check permissions - only admin can reset passwords
      if (ctx.agent.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admin can reset passwords'
        })
      }

      try {
        await authService.resetAgentPassword(input.id, input.newPassword)
        logger.info('Agent password reset', { 
          resetById: ctx.agent.id, 
          agentId: input.id 
        })
        return { success: true }
      } catch (error: any) {
        logger.error('Failed to reset agent password', { 
          error: error.message, 
          agentId: input.id 
        })

        if (error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Agent not found'
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset password'
        })
      }
    })
}) 