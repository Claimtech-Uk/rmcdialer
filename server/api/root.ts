import { createTRPCRouter } from '@/lib/trpc/server'
import { authRouter } from './routers/auth'
import { queueRouter } from './routers/queue'
import { scoringRouter } from './routers/scoring'
import { callsRouter } from './routers/calls'
import { communicationsRouter } from './routers/communications'
import { usersRouter } from './routers/users'

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  queue: queueRouter,
  scoring: scoringRouter,
  calls: callsRouter,
  communications: communicationsRouter,
  users: usersRouter,
})

// export type definition of API
export type AppRouter = typeof appRouter 