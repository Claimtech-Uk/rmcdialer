import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { callService } from '../services/call.service';
import { logger } from '../utils/logger';

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
const InitiateCallSchema = z.object({
  userId: z.number().int().positive('User ID must be a positive integer'),
  queueId: z.string().uuid().optional(),
  phoneNumber: z.string().optional(),
  direction: z.enum(['outbound', 'inbound']).optional().default('outbound')
});

const UpdateCallStatusSchema = z.object({
  status: z.enum(['initiated', 'ringing', 'connected', 'completed', 'failed', 'no_answer']),
  twilioCallSid: z.string().optional(),
  connectedAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endedAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  failureReason: z.string().optional()
});

const CallOutcomeSchema = z.object({
  outcomeType: z.enum(['contacted', 'no_answer', 'busy', 'wrong_number', 'not_interested', 'callback_requested', 'left_voicemail', 'failed']),
  outcomeNotes: z.string().optional(),
  nextCallDelayHours: z.number().min(0).max(168).optional(), // Max 1 week delay
  magicLinkSent: z.boolean().optional(),
  documentsRequested: z.array(z.string()).optional(),
  callbackDateTime: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  callbackReason: z.string().optional(),
  scoreAdjustment: z.number().int().min(-100).max(100).optional()
});

const GetCallHistorySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  agentId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  userId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  outcome: z.string().optional(),
  status: z.string().optional()
});

/**
 * Initiate a new call session
 * POST /api/calls
 */
export const initiateCall = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agentId = req.agent!.id;
    const callData = InitiateCallSchema.parse(req.body);

    logger.info('Call initiation requested', {
      agentId,
      userId: callData.userId,
      queueId: callData.queueId,
      direction: callData.direction
    });

    const callSession = await callService.initiateCall({
      ...callData,
      agentId
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'Call session initiated successfully',
        callSession,
        userContext: callSession.userContext
      }
    });

  } catch (error) {
    logger.error('Failed to initiate call:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Agent is not available for calls') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'AGENT_NOT_AVAILABLE',
            message: 'Agent must be available to initiate calls'
          }
        });
      }
    }
    
    next(error);
  }
};

/**
 * Update call session status
 * PUT /api/calls/:sessionId/status
 */
export const updateCallStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const agentId = req.agent!.id;
    const updateData = UpdateCallStatusSchema.parse(req.body);

    logger.info('Call status update requested', {
      sessionId,
      agentId,
      status: updateData.status
    });

    const updatedSession = await callService.updateCallStatus(sessionId, updateData);

    res.json({
      success: true,
      data: {
        message: 'Call status updated successfully',
        callSession: updatedSession
      }
    });

  } catch (error) {
    logger.error('Failed to update call status:', error);
    next(error);
  }
};

/**
 * Record call outcome and disposition
 * POST /api/calls/:sessionId/outcome
 */
export const recordCallOutcome = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const agentId = req.agent!.id;
    const outcomeData = CallOutcomeSchema.parse(req.body);

    logger.info('Call outcome recording requested', {
      sessionId,
      agentId,
      outcomeType: outcomeData.outcomeType
    });

    const result = await callService.recordCallOutcome(sessionId, agentId, outcomeData);

    res.json({
      success: true,
      data: {
        message: 'Call outcome recorded successfully',
        outcome: result.callOutcome,
        nextCallAfter: result.nextCallAfter
      }
    });

  } catch (error) {
    logger.error('Failed to record call outcome:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Call session not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CALL_SESSION_NOT_FOUND',
            message: 'Call session not found'
          }
        });
      }
      
      if (error.message === 'Agent not authorized for this call session') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED_CALL_ACCESS',
            message: 'Agent not authorized for this call session'
          }
        });
      }
    }
    
    next(error);
  }
};

/**
 * End a call session without specific outcome
 * POST /api/calls/:sessionId/end
 */
export const endCall = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const agentId = req.agent!.id;

    logger.info('Call end requested', {
      sessionId,
      agentId
    });

    const endedSession = await callService.endCall(sessionId, agentId);

    res.json({
      success: true,
      data: {
        message: 'Call ended successfully',
        callSession: endedSession
      }
    });

  } catch (error) {
    logger.error('Failed to end call:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Call session not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CALL_SESSION_NOT_FOUND',
            message: 'Call session not found'
          }
        });
      }
      
      if (error.message === 'Agent not authorized for this call session') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED_CALL_ACCESS',
            message: 'Agent not authorized for this call session'
          }
        });
      }
    }
    
    next(error);
  }
};

/**
 * Get call history with filtering and pagination
 * GET /api/calls/history
 */
export const getCallHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = GetCallHistorySchema.parse(req.query);
    
    // For regular agents, only show their own calls
    if (req.agent?.role === 'agent') {
      query.agentId = req.agent.id;
    }

    logger.info('Call history requested', {
      agentId: req.agent?.id,
      filters: query
    });

    const result = await callService.getCallHistory(query);

    res.json({
      success: true,
      data: result.callHistory,
      meta: result.meta
    });

  } catch (error) {
    logger.error('Failed to get call history:', error);
    next(error);
  }
};

/**
 * Get agent's active calls
 * GET /api/calls/active
 */
export const getActiveCalls = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agentId = req.agent!.id;

    logger.info('Active calls requested', { agentId });

    const activeCalls = await callService.getAgentActiveCalls(agentId);

    res.json({
      success: true,
      data: {
        activeCalls,
        count: activeCalls.length
      }
    });

  } catch (error) {
    logger.error('Failed to get active calls:', error);
    next(error);
  }
};

/**
 * Get call statistics
 * GET /api/calls/stats
 */
export const getCallStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agentId = req.agent?.role === 'agent' ? req.agent.id : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    logger.info('Call stats requested', {
      agentId: req.agent?.id,
      statsFor: agentId || 'all',
      dateRange: { startDate, endDate }
    });

    const stats = await callService.getCallStats(agentId, startDate, endDate);

    res.json({
      success: true,
      data: {
        period: {
          startDate,
          endDate: endDate || new Date(),
          agentId: agentId || null
        },
        metrics: stats
      }
    });

  } catch (error) {
    logger.error('Failed to get call stats:', error);
    next(error);
  }
};

/**
 * Get specific call session details
 * GET /api/calls/:sessionId
 */
export const getCallSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const agentId = req.agent!.id;

    logger.info('Call session details requested', {
      sessionId,
      agentId
    });

    // Get call session with related data
    const callSession = await callService.getCallHistory({
      limit: 1
    });

    // Filter to only the requested session
    const session = callSession.callHistory.find((call: any) => 
      call.id === sessionId && 
      (req.agent?.role !== 'agent' || call.agentId === agentId)
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CALL_SESSION_NOT_FOUND',
          message: 'Call session not found or access denied'
        }
      });
    }

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    logger.error('Failed to get call session:', error);
    next(error);
  }
}; 