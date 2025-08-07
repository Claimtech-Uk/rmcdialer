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
    // Check both Authorization header and cookies
    let token = null
    
    // First try Authorization header
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '')
    }
    
    // If no header token, try cookies
    if (!token) {
      const cookieHeader = req.headers.get('cookie')
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=')
          acc[key] = value
          return acc
        }, {} as Record<string, string>)
        token = cookies['auth-token']
      }
    }
    
    // Verify token if found
    if (token) {
      try {
        const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-secret-for-build'
        const decoded = jwt.verify(token, jwtSecret) as any
        agent = decoded
      } catch (error) {
        // Invalid token, continue without agent
        console.warn('Invalid JWT token in TRPC context:', error instanceof Error ? error.message : 'Unknown error')
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