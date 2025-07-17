import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { queueService } from '../services/queue.service';
import { logger } from '../utils/logger';
import { prisma } from '../app';

// Extend Request interface to include agent from auth middleware
export interface AuthRequest extends Request {
  agent?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

// Validation schemas
const GetQueueSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  status: z.enum(['pending', 'assigned', 'completed']).optional().default('pending'),
  agentId: z.string().optional().transform(val => val ? parseInt(val) : undefined)
});

const AssignCallSchema = z.object({
  queueId: z.string().uuid('Invalid queue ID format')
});

/**
 * Get current call queue with pagination and filtering
 * GET /api/queue
 */
export const getQueue = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = GetQueueSchema.parse(req.query);
    
    logger.info('Getting queue', {
      agentId: req.agent?.id,
      filters: query
    });

    const result = await queueService.getQueue({
      limit: query.limit,
      status: query.status,
      agentId: query.agentId
    });

    res.json({
      success: true,
      data: result.queue,
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        hasMore: result.hasMore,
        totalPages: Math.ceil(result.total / query.limit)
      }
    });

  } catch (error) {
    logger.error('Failed to get queue:', error);
    next(error);
  }
};

/**
 * Refresh the queue by recalculating priorities
 * POST /api/queue/refresh
 */
export const refreshQueue = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Only supervisors and admins can refresh the queue
    if (req.agent?.role !== 'supervisor' && req.agent?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only supervisors and admins can refresh the queue'
        }
      });
    }

    logger.info('Queue refresh requested', {
      agentId: req.agent?.id,
      agentRole: req.agent?.role
    });

    const result = await queueService.refreshQueue();

    res.json({
      success: true,
      data: {
        message: 'Queue refreshed successfully',
        usersAdded: result.usersAdded,
        queueSize: result.queueSize
      }
    });

  } catch (error) {
    logger.error('Failed to refresh queue:', error);
    next(error);
  }
};

/**
 * Assign a call from the queue to the requesting agent
 * POST /api/queue/:queueId/assign
 */
export const assignCall = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { queueId } = AssignCallSchema.parse(req.params);
    const agentId = req.agent!.id;

    logger.info('Call assignment requested', {
      queueId,
      agentId,
      agentEmail: req.agent?.email
    });

    const assignedCall = await queueService.assignCall(queueId, agentId);

    res.json({
      success: true,
      data: {
        message: 'Call assigned successfully',
        assignment: assignedCall
      }
    });

  } catch (error) {
    logger.error('Failed to assign call:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Agent is not available') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'AGENT_NOT_AVAILABLE',
            message: 'Agent must be available to take calls'
          }
        });
      }
    }
    
    next(error);
  }
};

/**
 * Get queue statistics
 * GET /api/queue/stats
 */
export const getQueueStats = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get aggregated queue metrics in a single query
    const queueStats = await prisma.callQueue.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    // Convert to object for easier access
    const stats = {
      queue: {
        pending: 0,
        assigned: 0,
        completed: 0
      },
      lastRefresh: new Date(), // In production, this would be tracked
      averageWaitTime: '2.5 minutes', // Mock data for now
      topPriorityUser: null as string | null
    };

    // Populate stats from query results
    queueStats.forEach((stat: { status: string; _count: { id: number } }) => {
      if (stat.status === 'pending') stats.queue.pending = stat._count.id;
      else if (stat.status === 'assigned') stats.queue.assigned = stat._count.id;
      else if (stat.status === 'completed') stats.queue.completed = stat._count.id;
    });

    // Get top priority user if queue has pending items
    if (stats.queue.pending > 0) {
      const topPriorityEntry = await prisma.callQueue.findFirst({
        where: { status: 'pending' },
        orderBy: { priorityScore: 'asc' },
        select: { queueReason: true }
      });
      
      if (topPriorityEntry) {
        stats.topPriorityUser = `User with ${topPriorityEntry.queueReason}`;
      }
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    next(error);
  }
};

/**
 * Release a call back to the queue (if agent can't complete it)
 * POST /api/queue/:queueId/release
 */
export const releaseCall = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { queueId } = AssignCallSchema.parse(req.params);
    const agentId = req.agent!.id;

    logger.info('Call release requested', {
      queueId,
      agentId
    });

    const releasedCall = await queueService.releaseCall(queueId, agentId);

    res.json({
      success: true,
      data: {
        message: 'Call released back to queue',
        queueEntry: releasedCall
      }
    });

  } catch (error) {
    logger.error('Failed to release call:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Queue entry not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'QUEUE_ENTRY_NOT_FOUND',
            message: 'Queue entry not found or not assigned to this agent'
          }
        });
      }
    }
    
    next(error);
  }
};

/**
 * Get agent's assigned calls
 * GET /api/queue/my-calls
 */
export const getMyAssignedCalls = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agentId = req.agent!.id;

    const result = await queueService.getQueue({
      status: 'assigned',
      agentId: agentId
    });

    res.json({
      success: true,
      data: result.queue,
      meta: {
        total: result.total
      }
    });

  } catch (error) {
    logger.error('Failed to get assigned calls:', error);
    next(error);
  }
}; 