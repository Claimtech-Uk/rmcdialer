import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/lib/trpc/server'
import { prisma } from '@/lib/db'

export const debugRouter = createTRPCRouter({
  // Public test endpoint
  publicTest: publicProcedure
    .query(() => {
      return {
        message: 'Public endpoint working',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    }),

  // Protected test endpoint
  protectedTest: protectedProcedure
    .query(({ ctx }) => {
      return {
        message: 'Protected endpoint working',
        timestamp: new Date().toISOString(),
        agent: {
          id: ctx.agent.id,
          email: ctx.agent.email,
          role: ctx.agent.role
        }
      }
    }),

  // Test database connectivity
  dbTest: protectedProcedure
    .query(async () => {
      try {
        const agentCount = await prisma.agent.count()
        const callSessionCount = await prisma.callSession.count()
        const agentSessionCount = await prisma.agentSession.count()
        
        return {
          success: true,
          counts: {
            agents: agentCount,
            callSessions: callSessionCount,
            agentSessions: agentSessionCount
          }
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }),

  // Test analytics query (simplified version)
  simpleAnalytics: protectedProcedure
    .query(async () => {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const callsToday = await prisma.callSession.count({
          where: {
            startedAt: {
              gte: today
            }
          }
        })
        
        return {
          success: true,
          callsToday
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
}) 