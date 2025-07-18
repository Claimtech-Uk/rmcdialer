# Dialler System - Next.js 14 + tRPC Migration Plan

## Pre-Migration Setup (Day 0)

### Architecture Change Overview
**FROM**: Separate Express API + React Vite frontend
**TO**: Unified Next.js 14 application with tRPC

### Environment Setup
```bash
# Create new Next.js app structure
npx create-next-app@latest dialler-system --typescript --tailwind --eslint --app
cd dialler-system

# Install core dependencies
npm install @trpc/server @trpc/client @trpc/next @trpc/react-query
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install prisma @prisma/client
npm install zod
npm install @next/bundle-analyzer

# Install UI dependencies  
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-toast
npm install class-variance-authority clsx tailwind-merge
npm install react-hook-form @hookform/resolvers

# Install Twilio and external services
npm install twilio @twilio/voice-sdk
npm install jsonwebtoken bcryptjs
npm install @types/jsonwebtoken @types/bcryptjs

# Development dependencies
npm install -D @types/node tsx
```

### Initial Configuration Files
```json
// package.json (root)
{
  "name": "dialler-system",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "type-check": "tsc --noEmit"
  }
}
```

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    serverComponentsExternalPackages: ['@prisma/client']
  },
  eslint: {
    dirs: ['app', 'components', 'lib', 'server']
  }
}

module.exports = nextConfig
```

### Pre-Migration Checklist
- [ ] Next.js 14 app created with App Router
- [ ] tRPC setup with type-safe client/server
- [ ] Prisma schema moved to new structure
- [ ] Environment variables migrated to .env.local
- [ ] shadcn/ui components initialized

---

## Week 1: Foundation & Core Migration

### Day 1-2: Next.js Foundation + tRPC Setup

#### Morning Day 1: Next.js App Structure
```bash
# Create directory structure
mkdir -p app/(dashboard)/{calls,queue,sms,analytics}
mkdir -p app/api/{trpc,auth,webhooks}
mkdir -p components/{ui,forms,layout}
mkdir -p lib/{trpc,auth,utils}
mkdir -p server/{api/routers,services,middleware}
mkdir -p types
```

#### tRPC Setup
```typescript
// lib/trpc/server.ts
import { initTRPC, TRPCError } from '@trpc/server'
import { type NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/db'
import { z } from 'zod'

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
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null
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
```

#### Client Setup
```typescript
// lib/trpc/client.ts
import { createTRPCReact } from '@trpc/react-query'
import { type AppRouter } from '@/server/api/root'

export const api = createTRPCReact<AppRouter>()

// lib/trpc/provider.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { loggerLink, unstable_httpBatchStreamLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { useState } from 'react'
import { api } from './client'
import superjson from 'superjson'

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
    },
  }))

  const [trpcClient] = useState(() =>
    api.createClient({
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === 'development' ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        unstable_httpBatchStreamLink({
          url: '/api/trpc',
          headers() {
            const token = localStorage.getItem('auth-token')
            return token ? { authorization: `Bearer ${token}` } : {}
          },
        }),
      ],
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </api.Provider>
    </QueryClientProvider>
  )
}
```

#### Day 1 Afternoon: Database Migration
```typescript
// Move Prisma schema to new location
// Copy apps/api/prisma/schema.prisma to prisma/schema.prisma

// lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Day 2: Authentication Migration

#### Next.js Middleware for Auth
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export function middleware(request: NextRequest) {
  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      jwt.verify(token, process.env.NEXTAUTH_SECRET!)
  } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

#### Auth Router
```typescript
// server/api/routers/auth.ts
import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '@/lib/trpc/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { TRPCError } from '@trpc/server'

export const authRouter = createTRPCRouter({
  login: publicProcedure
    .input(z.object({
  email: z.string().email(),
  password: z.string().min(8)
    }))
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input

      const agent = await ctx.prisma.agent.findUnique({
      where: { email, isActive: true } 
      })
    
    if (!agent || !bcrypt.compareSync(password, agent.passwordHash)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials'
        })
      }
    
    // Create/update session
      const session = await ctx.prisma.agentSession.upsert({
      where: { agentId: agent.id },
      update: { 
        status: 'available', 
        loginAt: new Date(),
        lastActivity: new Date()
      },
      create: { 
        agentId: agent.id, 
        status: 'available',
        loginAt: new Date()
      }
      })
    
    // Generate token
    const token = jwt.sign(
      { id: agent.id, email: agent.email, role: agent.role },
        process.env.NEXTAUTH_SECRET!,
      { expiresIn: '8h' }
      )

      return {
        token, 
        agent: {
          id: agent.id,
          email: agent.email,
          firstName: agent.firstName,
          lastName: agent.lastName,
          role: agent.role
        },
        sessionId: session.id
      } 
    }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      const agent = await ctx.prisma.agent.findUnique({
        where: { id: ctx.agent.id },
        include: {
          sessions: {
            where: { status: 'available' },
            orderBy: { loginAt: 'desc' },
            take: 1
          }
        }
      })

      if (!agent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent not found'
        })
      }
      
      return agent
    }),

  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.prisma.agentSession.updateMany({
        where: { agentId: ctx.agent.id },
        data: { 
          status: 'offline',
          logoutAt: new Date()
        }
      })

      return { success: true }
    })
})
```

### Day 3-4: Core Services Migration

#### Queue Service as tRPC Router
```typescript
// server/api/routers/queue.ts
import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server'
import { QueueService } from '@/server/services/queue.service'

const queueService = new QueueService()

export const queueRouter = createTRPCRouter({
  getQueue: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      status: z.string().default('pending')
    }))
    .query(async ({ input, ctx }) => {
      const { page, limit, status } = input
  
      const queue = await ctx.prisma.callQueue.findMany({
        where: { status },
    include: {
      user: true,
      assignedAgent: true
    },
    orderBy: [
      { priorityScore: 'asc' },
      { createdAt: 'asc' }
    ],
        skip: (page - 1) * limit,
        take: limit
      })
  
      const total = await ctx.prisma.callQueue.count({ where: { status } })

      return {
        queue,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    }),

  assignCall: protectedProcedure
    .input(z.object({
      queueId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const { queueId } = input
  
  // Check if agent is available
      const agentSession = await ctx.prisma.agentSession.findFirst({
        where: { agentId: ctx.agent.id, status: 'available' }
      })
  
  if (!agentSession) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Agent not available'
        })
  }
  
  // Assign the call
      const queueEntry = await ctx.prisma.callQueue.update({
    where: { id: queueId },
    data: {
      status: 'assigned',
          assignedToAgentId: ctx.agent.id,
      assignedAt: new Date()
    }
      })

      return queueEntry
    }),

  refreshQueue: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Only supervisors can refresh queue
      if (ctx.agent.role !== 'supervisor' && ctx.agent.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        })
      }

      await queueService.refreshQueue()
      return { success: true }
    }),

  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const [totalPending, totalAssigned, totalCompleted] = await Promise.all([
        ctx.prisma.callQueue.count({ where: { status: 'pending' } }),
        ctx.prisma.callQueue.count({ where: { status: 'assigned' } }),
        ctx.prisma.callQueue.count({ where: { status: 'completed' } })
      ])

      return {
        totalPending,
        totalAssigned,
        totalCompleted,
        totalInQueue: totalPending + totalAssigned
  }
    })
})
```

#### Call Service Migration
```typescript
// server/api/routers/calls.ts
import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server'
import { CallService } from '@/server/services/call.service'
import { TRPCError } from '@trpc/server'

const callService = new CallService()

export const callsRouter = createTRPCRouter({
  initiate: protectedProcedure
    .input(z.object({
      queueId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await callService.initiateCall(input.queueId, ctx.agent.id)
      return session
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      status: z.enum(['initiated', 'connected', 'completed', 'failed']),
      twilioSid: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { sessionId, status, twilioSid } = input
      
      // Verify the session belongs to the agent
      const session = await ctx.prisma.callSession.findFirst({
        where: { id: sessionId, agentId: ctx.agent.id }
      })

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Call session not found'
        })
      }

      return await callService.updateCallStatus(sessionId, status, twilioSid)
    }),

  recordOutcome: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      outcomeType: z.enum(['contacted', 'no_answer', 'busy', 'voicemail', 'wrong_number', 'not_interested', 'callback_requested']),
      notes: z.string().optional(),
      callbackDate: z.date().optional(),
      magicLinkSent: z.boolean().default(false),
      documentsRequested: z.array(z.string()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const outcome = await ctx.prisma.callOutcome.create({
      data: {
          callSessionId: input.sessionId,
          outcomeType: input.outcomeType,
          notes: input.notes,
          callbackScheduled: !!input.callbackDate,
          callbackDate: input.callbackDate,
          magicLinkSent: input.magicLinkSent,
          documentsRequested: input.documentsRequested || [],
          recordedByAgentId: ctx.agent.id
        }
      })

      // Update user call score based on outcome
      await callService.updateUserScore(input.sessionId, input.outcomeType)

      return outcome
    }),

  getHistory: protectedProcedure
    .input(z.object({
      agentId: z.number().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional()
    }))
    .query(async ({ input, ctx }) => {
      const { page, limit, agentId, dateFrom, dateTo } = input

      const where: any = {}
      
      if (agentId) where.agentId = agentId
      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = dateFrom
        if (dateTo) where.createdAt.lte = dateTo
      }

      const sessions = await ctx.prisma.callSession.findMany({
        where,
        include: {
          agent: true,
          outcome: true,
          queue: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })

      const total = await ctx.prisma.callSession.count({ where })

      return {
        sessions,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    })
})
```

### Day 5: React Components Migration

#### App Layout Structure
```typescript
// app/layout.tsx
import { Inter } from 'next/font/google'
import { TRPCProvider } from '@/lib/trpc/provider'
import { Toaster } from '@/components/ui/toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'RMC Dialler System',
  description: 'Intelligent call management for financial claims',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TRPCProvider>
          {children}
          <Toaster />
        </TRPCProvider>
      </body>
    </html>
  )
}

// app/(dashboard)/layout.tsx
import { Navigation } from '@/components/layout/Navigation'
import { AuthProvider } from '@/components/layout/AuthProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <div className="flex h-screen bg-gray-100">
        <Navigation />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </AuthProvider>
  )
}
```

#### Queue Management Component
```typescript
// app/(dashboard)/queue/page.tsx
'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'

export default function QueuePage() {
  const [page, setPage] = useState(1)
  
  const { data: queueData, isLoading, refetch } = api.queue.getQueue.useQuery({ 
    page, 
    limit: 20 
  })
  
  const { data: stats } = api.queue.getStats.useQuery()
  
  const assignCallMutation = api.queue.assignCall.useMutation({
    onSuccess: () => {
      toast({ title: 'Call assigned successfully' })
      refetch()
    },
    onError: (error) => {
      toast({ 
        title: 'Assignment failed', 
        description: error.message,
        variant: 'destructive'
      })
    }
  })
  
  const refreshQueueMutation = api.queue.refreshQueue.useMutation({
    onSuccess: () => {
      toast({ title: 'Queue refreshed' })
      refetch()
    }
  })

  const handleAssignCall = (queueId: string) => {
    assignCallMutation.mutate({ queueId })
  }

  if (isLoading) return <div>Loading queue...</div>
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Call Queue</h1>
        <Button 
          onClick={() => refreshQueueMutation.mutate()}
          disabled={refreshQueueMutation.isLoading}
        >
          Refresh Queue
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Assigned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAssigned}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Completed Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCompleted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total In Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInQueue}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {queueData?.queue.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">
                    {entry.user.firstName} {entry.user.lastName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {entry.user.phoneNumber} • Score: {entry.priorityScore}
                  </div>
                  <div className="text-sm text-gray-600">
                    Reason: {entry.queueReason}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={entry.status === 'pending' ? 'default' : 'secondary'}>
                    {entry.status}
                  </Badge>
                  {entry.status === 'pending' && (
                    <Button 
                      size="sm"
                      onClick={() => handleAssignCall(entry.id)}
                      disabled={assignCallMutation.isLoading}
                    >
                      Claim Call
                    </Button>
                  )}
              </div>
            </div>
          ))}
        </div>
        </CardContent>
      </Card>
      </div>
  )
}
```

---

## Week 2: Feature Migration & Enhancement

### Day 6-7: SMS & Magic Links Migration

#### SMS Router
```typescript
// server/api/routers/sms.ts
import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/lib/trpc/server'
import { SMSService } from '@/server/services/sms.service'

const smsService = new SMSService()

export const smsRouter = createTRPCRouter({
  getConversations: protectedProcedure
    .input(z.object({
      status: z.enum(['active', 'closed', 'opted_out']).optional(),
      page: z.number().default(1),
      limit: z.number().default(20)
    }))
    .query(async ({ input, ctx }) => {
      const { status, page, limit } = input
      
      const where: any = {}
      if (status) where.status = status

      const conversations = await ctx.prisma.smsConversation.findMany({
        where,
        include: {
          user: true,
          assignedAgent: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
      }
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })

      const total = await ctx.prisma.smsConversation.count({ where })
    
    return {
        conversations,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    }),

  getMessages: protectedProcedure
    .input(z.object({
      conversationId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const messages = await ctx.prisma.smsMessage.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: 'asc' }
      })

      // Mark as read
      await ctx.prisma.smsConversation.update({
        where: { id: input.conversationId },
        data: { unreadCount: 0 }
      })

      return messages
    }),

  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      body: z.string().min(1).max(1600)
    }))
    .mutation(async ({ input, ctx }) => {
      const conversation = await ctx.prisma.smsConversation.findUnique({
        where: { id: input.conversationId }
      })

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found'
        })
      }

      const twilioResponse = await smsService.sendSMS(conversation.phoneNumber, input.body)

      const message = await ctx.prisma.smsMessage.create({
        data: {
          conversationId: input.conversationId,
          direction: 'outbound',
          body: input.body,
          twilioMessageSid: twilioResponse.sid,
          sentByAgentId: ctx.agent.id,
          sentAt: new Date()
        }
      })

      // Update conversation
      await ctx.prisma.smsConversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          assignedAgentId: ctx.agent.id
        }
      })

      return message
    }),

  // Webhook for incoming messages
  handleIncoming: publicProcedure
    .input(z.object({
      From: z.string(),
      Body: z.string(),
      MessageSid: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      return await smsService.handleIncomingMessage(input.From, input.Body, input.MessageSid)
    })
})
```

#### Magic Links Router
```typescript
// server/api/routers/magicLinks.ts
import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server'
import { MagicLinkService } from '@/server/services/magic-link.service'

const magicLinkService = new MagicLinkService()

export const magicLinksRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(z.object({
      userId: z.number(),
      linkType: z.enum(['firstLogin', 'claimPortal', 'documentUpload', 'claimCompletion']),
      sessionId: z.string().optional(),
      customExpiry: z.number().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      return await magicLinkService.generateMagicLink(
        input.userId,
        input.linkType,
        ctx.agent.id,
        input.sessionId,
        input.customExpiry
      )
    }),

  sendViaSMS: protectedProcedure
    .input(z.object({
      userId: z.number(),
      phoneNumber: z.string(),
      linkType: z.enum(['firstLogin', 'claimPortal', 'documentUpload', 'claimCompletion']),
      sessionId: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      return await magicLinkService.sendMagicLink(
        input.userId,
        input.phoneNumber,
        input.linkType,
        ctx.agent.id,
        input.sessionId
      )
    }),

  getAnalytics: protectedProcedure
    .input(z.object({
      agentId: z.number().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional()
    }))
    .query(async ({ input, ctx }) => {
      return await magicLinkService.getMagicLinkAnalytics(
        input.agentId,
        input.dateFrom && input.dateTo ? { start: input.dateFrom, end: input.dateTo } : undefined
      )
    }),

  getHistory: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      linkType: z.string().optional(),
      agentId: z.number().optional()
    }))
    .query(async ({ input, ctx }) => {
      const { page, limit, linkType, agentId } = input

      const where: any = {}
      if (linkType) where.linkType = linkType
      if (agentId) where.sentByAgentId = agentId

      const activities = await ctx.prisma.magicLinkActivity.findMany({
        where,
        include: {
          sentByAgent: {
            select: { firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })

      const total = await ctx.prisma.magicLinkActivity.count({ where })

      return {
        activities,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    })
})
```

### Day 8-9: Twilio Integration Migration

#### Twilio Service Setup for Next.js
```typescript
// server/services/twilio.service.ts
import twilio from 'twilio'
import { type NextRequest } from 'next/server'

export class TwilioService {
  private client: twilio.Twilio
  private accountSid: string
  private authToken: string
  private phoneNumber: string
  private twimlApp: string
  
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID!
    this.authToken = process.env.TWILIO_AUTH_TOKEN!
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER!
    this.twimlApp = process.env.TWILIO_TWIML_APP_SID!
    
    this.client = twilio(this.accountSid, this.authToken)
  }

  async generateAccessToken(agentId: number) {
    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant
    
    const accessToken = new AccessToken(
      this.accountSid,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      { identity: `agent_${agentId}` }
    )
    
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: this.twimlApp,
      incomingAllow: true
    })
    
    accessToken.addGrant(voiceGrant)
    return accessToken.toJwt()
  }
  
  generateTwiML(phoneNumber: string, callbackUrl: string) {
    const response = new twilio.twiml.VoiceResponse()
    
    const dial = response.dial({
      callerId: this.phoneNumber,
      record: 'record-from-answer',
      recordingStatusCallback: `${callbackUrl}/api/webhooks/twilio/recording`
    })
    
    dial.number(phoneNumber)
    
    return response.toString()
  }
  
  async sendSMS(to: string, message: string) {
    return await this.client.messages.create({
      body: message,
      from: this.phoneNumber,
      to
    })
  }
}

// app/api/twilio/token/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TwilioService } from '@/server/services/twilio.service'
import jwt from 'jsonwebtoken'

const twilioService = new TwilioService()

export async function POST(request: NextRequest) {
  try {
    // Verify JWT token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as any

    // Generate Twilio token
    const twilioToken = await twilioService.generateAccessToken(decoded.id)

    return NextResponse.json({ token: twilioToken })
    } catch (error) {
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}

// app/api/twilio/twiml/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TwilioService } from '@/server/services/twilio.service'

const twilioService = new TwilioService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const to = body.get('To') as string
    const callbackUrl = process.env.NEXTAUTH_URL!

    const twiml = twilioService.generateTwiML(to, callbackUrl)

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate TwiML' }, { status: 500 })
  }
}
```

### Day 10-11: Complete UI Migration

#### Dashboard Home Page
```typescript
// app/(dashboard)/page.tsx
'use client'

import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Phone, MessageSquare, Link, Users } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: queueStats } = api.queue.getStats.useQuery()
  const { data: agent } = api.auth.me.useQuery()
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Welcome back, {agent?.firstName}!
        </h1>
        <p className="text-gray-600">
          Ready to help users with their claims
        </p>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.totalPending || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.totalAssigned || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.totalCompleted || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Magic Links Sent</CardTitle>
            <Link className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/queue">
              <Button className="w-full justify-start" variant="outline">
                <Phone className="mr-2 h-4 w-4" />
                View Call Queue
              </Button>
            </Link>
            <Link href="/dashboard/sms">
              <Button className="w-full justify-start" variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                SMS Conversations
              </Button>
            </Link>
            <Link href="/dashboard/analytics">
              <Button className="w-full justify-start" variant="outline">
                <Users className="mr-2 h-4 w-4" />
                View Analytics
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Your recent calls and interactions will appear here
            </p>
          </CardContent>
        </Card>
        </div>
        </div>
  )
}
```

---

## Week 3: Production Setup & Deployment

### Day 12-13: Production Configuration

#### Vercel Configuration
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "DATABASE_URL": "@database-url",
    "REPLICA_DATABASE_URL": "@replica-database-url",
    "REDIS_URL": "@redis-url",
    "TWILIO_ACCOUNT_SID": "@twilio-account-sid",
    "TWILIO_AUTH_TOKEN": "@twilio-auth-token",
    "NEXTAUTH_SECRET": "@nextauth-secret",
    "NEXTAUTH_URL": "@nextauth-url"
  }
}
```

#### Environment Configuration
```bash
# .env.local (development)
DATABASE_URL="postgresql://..."
REPLICA_DATABASE_URL="mysql://..."
REDIS_URL="redis://..."
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# .env.production (Vercel)
DATABASE_URL="postgresql://..."
REPLICA_DATABASE_URL="mysql://..."
REDIS_URL="redis://..."
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://dialler.resolvemyclaim.co.uk"
```

### Day 14: Testing & Final Migration

#### Clean Up Old Structure
```bash
# Remove old apps directory
rm -rf apps/
rm -rf packages/

# Update package.json scripts
# Remove turbo dependency
# Update deployment scripts
```

#### Migration Verification Checklist
- [ ] All tRPC routes working
- [ ] Authentication flow complete
- [ ] Database connections tested
- [ ] Twilio integration verified
- [ ] SMS webhooks configured
- [ ] Magic links generating correctly
- [ ] Queue management operational
- [ ] Call session tracking working
- [ ] All UI pages accessible
- [ ] Production deployment successful

---

## Migration Benefits

### **Performance Improvements**
- **Unified deployment** - Single app instead of two
- **Type safety** - End-to-end type safety with tRPC
- **Better caching** - Next.js built-in optimizations
- **Reduced latency** - No separate API calls

### **Developer Experience**
- **Better DX** - Single codebase to maintain
- **Type safety** - Catch errors at compile time
- **Modern patterns** - App Router, Server Components
- **Built-in optimizations** - Image optimization, bundling

### **Operational Benefits**
- **Simpler deployment** - Single Vercel project
- **Better monitoring** - Unified error tracking
- **Easier scaling** - Serverless by default
- **Cost effective** - Single hosting instance

---

**Timeline**: 14 days total migration
**Risk Level**: Medium (requires careful data migration)
**Benefits**: High (modern stack, better performance, easier maintenance)