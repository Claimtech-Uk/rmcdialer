import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server';
import { QueueService, type QueueFilters } from '@/modules/queue';
import { PriorityScoringService } from '@/modules/scoring';
import { prisma } from '@/lib/db';

// Create logger instance (in production this would come from a shared logger service)
const logger = {
  info: (message: string, meta?: any) => console.log(`[Queue] ${message}`, meta),
  error: (message: string, error?: any) => console.error(`[Queue ERROR] ${message}`, error),
  warn: (message: string, meta?: any) => console.warn(`[Queue WARN] ${message}`, meta)
};

// Initialize scoring service first
const scoringService = new PriorityScoringService({ logger });

// Initialize queue service with dependencies including scoring service
const queueService = new QueueService({ prisma, scoringService, logger });

// Input validation schemas
const QueueFiltersSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  status: z.enum(['pending', 'assigned', 'completed']).default('pending'),
  agentId: z.number().optional(),
  queueType: z.enum(['unsigned_users', 'outstanding_requests', 'callback']).optional()
});

const AssignCallSchema = z.object({
  queueId: z.string().uuid('Invalid queue ID format')
});

export const queueRouter = createTRPCRouter({
  // Get the current queue with filtering and pagination
  getQueue: protectedProcedure
    .input(QueueFiltersSchema)
    .query(async ({ input, ctx }) => {
      // Thin layer - delegate to module service
      return await queueService.getQueue(input);
    }),

  // Refresh the entire queue by recalculating priorities
  refreshQueue: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Delegate to module service
      return await queueService.refreshQueue();
    }),

  // Assign a queue entry to the current agent
  assignCall: protectedProcedure
    .input(AssignCallSchema)
    .mutation(async ({ input, ctx }) => {
      // Delegate to module service with agent context
      return await queueService.assignCall(input.queueId, ctx.agent.id);
    }),

  // Get queue statistics (to be implemented)
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      // For now, return basic stats
      // In the future, this could be delegated to a queue analytics service
      const pending = await prisma.callQueue.count({ where: { status: 'pending' } });
      const assigned = await prisma.callQueue.count({ where: { status: 'assigned' } });
      const completedToday = await prisma.callQueue.count({
        where: {
          status: 'completed',
          updatedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });

      return {
        queue: {
          pending,
          assigned,
          completedToday
        },
        lastRefresh: new Date().toISOString(),
        totalAgents: 5,
        activeAgents: 3,
        averageWaitTime: 0, // Mock data - would calculate from queue analytics
        topPriorityScore: 0 // Mock data - would get from first queue entry
      };
    })
}); 