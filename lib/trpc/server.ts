import { initTRPC, TRPCError } from '@trpc/server'
import { type NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import superjson from 'superjson'

interface CreateContextOptions {
  req?: NextRequest
  agent?: {
    id: number
    email: string
    role: string
  }
}

export const createTRPCContext = async (opts: CreateContextOptions) => {
  const { req } = opts

  // Extract token from request if available
  let agent = null
  if (req) {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-secret-for-build'
        const decoded = jwt.verify(token, jwtSecret) as any
        agent = decoded
      } catch (error) {
        // Invalid token, continue without agent
      }
    }
  }

  return {
    req,
    prisma,
    agent
  }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        code: error.code,
        httpStatus: error.cause?.name === 'ZodError' ? 400 : 500,
      },
    }
  },
})

// Auth helpers
export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.agent) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    })
  }

  return next({
    ctx: {
      ...ctx,
      agent: ctx.agent,
    },
  })
})

// Admin procedure for admin-only actions
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.agent.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    })
  }

  return next({ ctx })
}) 