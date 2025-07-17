import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { smsService } from '../services/sms.service';
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
const SendSMSSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format'),
  message: z.string().min(1).max(1600, 'Message too long'),
  userId: z.number().int().positive().optional(),
  callSessionId: z.string().uuid().optional(),
  messageType: z.enum(['manual', 'auto_response', 'magic_link', 'callback_confirmation']).optional().default('manual'),
  templateId: z.string().optional()
});

const GetConversationsSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  phoneNumber: z.string().optional(),
  userId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  agentId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  status: z.enum(['active', 'closed']).optional()
});

const GetConversationSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50)
});

const AssignConversationSchema = z.object({
  agentId: z.number().int().positive('Agent ID must be a positive integer')
});

const CloseConversationSchema = z.object({
  reason: z.string().optional()
});

const SendMagicLinkSchema = z.object({
  userId: z.number().int().positive('User ID must be a positive integer'),
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format'),
  linkType: z.string().min(1, 'Link type is required'),
  callSessionId: z.string().uuid().optional()
});

const IncomingSMSSchema = z.object({
  From: z.string(),
  To: z.string(),
  Body: z.string(),
  MessageSid: z.string(),
  AccountSid: z.string()
});

/**
 * Send SMS message
 * POST /api/sms/send
 */
export const sendSMS = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agentId = req.agent!.id;
    const smsData = SendSMSSchema.parse(req.body);

    logger.info('SMS send requested', {
      agentId,
      phoneNumber: smsData.phoneNumber,
      messageType: smsData.messageType,
      userId: smsData.userId
    });

    const result = await smsService.sendSMS({
      ...smsData,
      agentId
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'SMS sent successfully',
        messageId: result.messageId,
        conversationId: result.conversation.id,
        twilioSid: result.twilioSid
      }
    });

  } catch (error) {
    logger.error('Failed to send SMS:', error);
    
    if (error instanceof Error) {
      if (error.message === 'SMS service not initialized') {
        return res.status(503).json({
          success: false,
          error: {
            code: 'SMS_SERVICE_UNAVAILABLE',
            message: 'SMS service is currently unavailable'
          }
        });
      }
    }
    
    next(error);
  }
};

/**
 * Handle incoming SMS webhook from Twilio
 * POST /api/sms/webhook/incoming
 */
export const handleIncomingSMS = async (req: Request, res: Response) => {
  try {
    const twilioData = IncomingSMSSchema.parse(req.body);

    logger.info('Incoming SMS received', {
      from: twilioData.From,
      to: twilioData.To,
      messageSid: twilioData.MessageSid
    });

    const result = await smsService.processIncomingSMS({
      from: twilioData.From,
      to: twilioData.To,
      body: twilioData.Body,
      messageSid: twilioData.MessageSid,
      accountSid: twilioData.AccountSid,
      timestamp: new Date()
    });

    // Respond to Twilio with TwiML (empty response means no immediate reply)
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

    logger.info('Incoming SMS processed', {
      messageId: result.message.id,
      conversationId: result.conversation.id,
      hasAutoResponse: !!result.autoResponse
    });

  } catch (error) {
    logger.error('Failed to process incoming SMS:', error);
    
    // Still respond to Twilio to prevent retries
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
};

/**
 * Handle SMS delivery status webhook from Twilio
 * POST /api/sms/webhook/status
 */
export const handleSMSStatus = async (req: Request, res: Response) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

    logger.info('SMS status update received', {
      messageSid: MessageSid,
      status: MessageStatus,
      errorCode: ErrorCode
    });

    // Update message status in database
    await smsService.updateMessageStatus(MessageSid, MessageStatus, ErrorCode, ErrorMessage);

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Failed to process SMS status update:', error);
    res.status(200).send('OK'); // Always respond OK to Twilio
  }
};

/**
 * Get SMS conversations with filtering and pagination
 * GET /api/sms/conversations
 */
export const getConversations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = GetConversationsSchema.parse(req.query);
    
    // For regular agents, only show their assigned conversations
    if (req.agent?.role === 'agent') {
      query.agentId = req.agent.id;
    }

    logger.info('SMS conversations requested', {
      agentId: req.agent?.id,
      filters: query
    });

    const result = await smsService.getConversations(query);

    res.json({
      success: true,
      data: result.conversations,
      meta: result.pagination
    });

  } catch (error) {
    logger.error('Failed to get SMS conversations:', error);
    next(error);
  }
};

/**
 * Get specific SMS conversation with message history
 * GET /api/sms/conversations/:conversationId
 */
export const getConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId } = req.params;
    const query = GetConversationSchema.parse(req.query);

    logger.info('SMS conversation details requested', {
      conversationId,
      agentId: req.agent?.id
    });

    const result = await smsService.getConversation(conversationId, query);

    // Check if agent has access to this conversation
    if (req.agent?.role === 'agent' && 
        result.conversation.assignedAgentId && 
        result.conversation.assignedAgentId !== req.agent.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CONVERSATION_ACCESS_DENIED',
          message: 'You do not have access to this conversation'
        }
      });
    }

    res.json({
      success: true,
      data: {
        conversation: result.conversation,
        messages: result.messages
      },
      meta: result.pagination
    });

  } catch (error) {
    logger.error('Failed to get SMS conversation:', error);
    
    if (error instanceof Error && error.message === 'Conversation not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'SMS conversation not found'
        }
      });
    }
    
    next(error);
  }
};

/**
 * Assign SMS conversation to agent
 * POST /api/sms/conversations/:conversationId/assign
 */
export const assignConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId } = req.params;
    const { agentId } = AssignConversationSchema.parse(req.body);

    // Only supervisors and admins can assign conversations
    if (req.agent?.role === 'agent') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only supervisors can assign conversations'
        }
      });
    }

    logger.info('SMS conversation assignment requested', {
      conversationId,
      agentId,
      assignedBy: req.agent?.id
    });

    const conversation = await smsService.assignConversation(conversationId, agentId);

    res.json({
      success: true,
      data: {
        message: 'Conversation assigned successfully',
        conversation
      }
    });

  } catch (error) {
    logger.error('Failed to assign SMS conversation:', error);
    next(error);
  }
};

/**
 * Close SMS conversation
 * POST /api/sms/conversations/:conversationId/close
 */
export const closeConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId } = req.params;
    const agentId = req.agent!.id;
    const { reason } = CloseConversationSchema.parse(req.body);

    logger.info('SMS conversation close requested', {
      conversationId,
      agentId,
      reason
    });

    const conversation = await smsService.closeConversation(conversationId, agentId, reason);

    res.json({
      success: true,
      data: {
        message: 'Conversation closed successfully',
        conversation
      }
    });

  } catch (error) {
    logger.error('Failed to close SMS conversation:', error);
    next(error);
  }
};

/**
 * Send magic link via SMS
 * POST /api/sms/magic-link
 */
export const sendMagicLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agentId = req.agent!.id;
    const linkData = SendMagicLinkSchema.parse(req.body);

    logger.info('Magic link SMS requested', {
      agentId,
      userId: linkData.userId,
      phoneNumber: linkData.phoneNumber,
      linkType: linkData.linkType
    });

    const result = await smsService.sendMagicLink(
      linkData.userId,
      linkData.phoneNumber,
      linkData.linkType,
      agentId,
      linkData.callSessionId
    );

    res.status(201).json({
      success: true,
      data: {
        message: 'Magic link sent successfully',
        messageId: result.messageId,
        magicLinkId: result.magicLinkId,
        trackingId: result.trackingId,
        status: result.status
      }
    });

  } catch (error) {
    logger.error('Failed to send magic link:', error);
    next(error);
  }
};

/**
 * Get SMS statistics
 * GET /api/sms/stats
 */
export const getSMSStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agentId = req.agent?.role === 'agent' ? req.agent.id : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    logger.info('SMS stats requested', {
      agentId: req.agent?.id,
      statsFor: agentId || 'all',
      dateRange: { startDate, endDate }
    });

    const stats = await smsService.getSMSStats(agentId, startDate, endDate);

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
    logger.error('Failed to get SMS stats:', error);
    next(error);
  }
};

/**
 * Get conversations requiring agent attention
 * GET /api/sms/conversations/attention
 */
export const getConversationsNeedingAttention = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('Conversations needing attention requested', {
      agentId: req.agent?.id
    });

    const result = await smsService.getConversations({
      status: 'active',
      page: 1,
      limit: 50
    });

    // Filter for conversations needing attention
    const needingAttention = result.conversations.filter((conv: any) => 
      conv.requiresAgentAttention || 
      (!conv.assignedAgentId && conv.messageCount > 0)
    );

    res.json({
      success: true,
      data: {
        conversations: needingAttention,
        count: needingAttention.length
      }
    });

  } catch (error) {
    logger.error('Failed to get conversations needing attention:', error);
    next(error);
  }
}; 