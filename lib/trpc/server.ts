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
        const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as any
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
        zodError: error.cause instanceof z.ZodError ? error.cause.flatten() : null
      }
    }
  }
})

// Auth middleware
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.agent) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      agent: ctx.agent
    }
  })
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed) 