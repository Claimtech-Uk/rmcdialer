// =============================================================================
// Communications tRPC Router
// =============================================================================
// Routes for SMS conversations, Magic Links, and messaging functionality

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server';
import { AuthService } from '@/modules/auth';
import { SMSService, MagicLinkService } from '@/modules/communications';
import { UserService } from '@/modules/users';
import { prisma } from '@/lib/db';
import { logger } from '@/modules/core';
import type { 
  MagicLinkType, 
  DeliveryMethod,
  ConversationStatus 
} from '@/modules/communications';

// Create service instances with dependency injection
const authService = new AuthService({ prisma, logger });
const userService = new UserService();

// Create simplified auth interface for communications services
const authForComms = {
  getCurrentAgent: async () => {
    // In a real implementation, this would get the agent from tRPC context
    // For now, return a default agent for development
    return { id: 1, role: 'agent' };
  }
};

// Create user service adapter to match SMS service interface
const userServiceAdapter = {
  async getUserData(userId: number) {
    const context = await userService.getUserCallContext(userId);
    if (!context) {
      throw new Error(`User ${userId} not found`);
    }
    return {
      id: context.user.id,
      firstName: context.user.firstName || 'Unknown',
      lastName: context.user.lastName || 'User',
      email: context.user.email || '',
      phoneNumber: context.user.phoneNumber || ''
    };
  }
};

const smsService = new SMSService({ 
  authService: authForComms,
  userService: userServiceAdapter
});
const magicLinkService = new MagicLinkService({ 
  authService: authForComms,
  userService: userServiceAdapter
});

// -----------------------------------------------------------------------------
// Input Validation Schemas
// -----------------------------------------------------------------------------

const SendSMSSchema = z.object({
  phoneNumber: z.string().min(10, 'Valid phone number required'),
  message: z.string().min(1, 'Message cannot be empty'),
  userId: z.number().optional(),
  callSessionId: z.string().optional(),
  messageType: z.enum(['manual', 'auto_response', 'magic_link', 'callback_confirmation']).default('manual')
});

const IncomingSMSSchema = z.object({
  from: z.string(),
  to: z.string(),
  body: z.string(),
  messageSid: z.string(),
  accountSid: z.string(),
  timestamp: z.date().default(() => new Date())
});

const ConversationFiltersSchema = z.object({
  phoneNumber: z.string().optional(),
  userId: z.number().optional(),
  agentId: z.number().optional(),
  status: z.enum(['active', 'closed']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

const AssignConversationSchema = z.object({
  conversationId: z.string().uuid(),
  agentId: z.number()
});

const CloseConversationSchema = z.object({
  conversationId: z.string().uuid(),
  reason: z.string().optional()
});

const SendMagicLinkSchema = z.object({
  userId: z.number(),
  linkType: z.enum(['firstLogin', 'claimPortal', 'documentUpload', 'claimCompletion', 'requirementReview', 'statusUpdate', 'profileUpdate']),
  deliveryMethod: z.enum(['sms', 'whatsapp', 'email']),
  phoneNumber: z.string().optional(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  customMessage: z.string().optional(),
  callSessionId: z.string().optional(),
  claimId: z.number().optional(),
  expiresInHours: z.number().min(1).max(168).default(48),
  customParams: z.record(z.string()).optional(),
  requirementTypes: z.array(z.string()).optional()
});

const TrackMagicLinkSchema = z.object({
  token: z.string(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional()
});

const MagicLinkHistorySchema = z.object({
  userId: z.number(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  linkType: z.enum(['firstLogin', 'claimPortal', 'documentUpload', 'claimCompletion', 'requirementReview', 'statusUpdate', 'profileUpdate']).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional()
});

const MagicLinkAnalyticsSchema = z.object({
  agentId: z.number().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  linkType: z.enum(['firstLogin', 'claimPortal', 'documentUpload', 'claimCompletion', 'requirementReview', 'statusUpdate', 'profileUpdate']).optional()
});

const MessageStatusUpdateSchema = z.object({
  twilioMessageSid: z.string(),
  status: z.string(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional()
});

const SMSStatsSchema = z.object({
  agentId: z.number().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional()
});

// -----------------------------------------------------------------------------
// Communications Router
// -----------------------------------------------------------------------------

export const communicationsRouter = createTRPCRouter({
  
  // ==========================================================================
  // SMS Operations
  // ==========================================================================
  
  sms: createTRPCRouter({
    /**
     * Send an SMS message
     */
    send: protectedProcedure
      .input(SendSMSSchema)
      .mutation(async ({ input, ctx }) => {
        return await smsService.sendSMS({
          ...input,
          agentId: ctx.agent.id
        });
      }),

    /**
     * Process incoming SMS (webhook handler)
     */
    processIncoming: protectedProcedure
      .input(IncomingSMSSchema)
      .mutation(async ({ input, ctx }) => {
        return await smsService.processIncomingSMS(input);
      }),

    /**
     * ⚡ Get SMS conversations - DEFAULT OPTIMIZED METHOD
     * Fast loading with lightweight data for better UX
     */
    getConversationsList: protectedProcedure
      .input(ConversationFiltersSchema)
      .query(async ({ input, ctx }) => {
        return await smsService.getConversationsList(input);
      }),

    /**
     * Get SMS conversations with comprehensive data
     * Use when you need complete conversation data with full message details
     */
    getConversations: protectedProcedure
      .input(ConversationFiltersSchema)
      .query(async ({ input, ctx }) => {
        return await smsService.getConversations(input);
      }),

    /**
     * Get specific conversation with messages
     */
    getConversation: protectedProcedure
      .input(z.object({
        conversationId: z.string().uuid(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50)
      }))
      .query(async ({ input, ctx }) => {
        return await smsService.getConversation(input.conversationId, {
          page: input.page,
          limit: input.limit
        });
      }),

    /**
     * Assign conversation to agent
     */
    assignConversation: protectedProcedure
      .input(AssignConversationSchema)
      .mutation(async ({ input, ctx }) => {
        // Only supervisors and admins can assign to other agents
        const targetAgentId = (ctx.agent.role === 'agent' && input.agentId !== ctx.agent.id)
          ? ctx.agent.id
          : input.agentId;

        return await smsService.assignConversation(input.conversationId, targetAgentId);
      }),

    /**
     * Close SMS conversation
     */
    closeConversation: protectedProcedure
      .input(CloseConversationSchema)
      .mutation(async ({ input, ctx }) => {
        return await smsService.closeConversation(
          input.conversationId,
          ctx.agent.id,
          input.reason
        );
      }),

    /**
     * Update message status (Twilio webhook)
     */
    updateMessageStatus: protectedProcedure
      .input(MessageStatusUpdateSchema)
      .mutation(async ({ input, ctx }) => {
        return await smsService.updateMessageStatus(
          input.twilioMessageSid,
          input.status,
          input.errorCode,
          input.errorMessage
        );
      }),

    /**
     * Get SMS statistics
     */
    getStats: protectedProcedure
      .input(SMSStatsSchema)
      .query(async ({ input, ctx }) => {
        // Allow all agents to see full SMS stats for better insights
        const agentId = input.agentId;
        
        return await smsService.getSMSStats(agentId, input.startDate, input.endDate);
      })
  }),

  // ==========================================================================
  // Magic Link Operations
  // ==========================================================================
  
  magicLinks: createTRPCRouter({
    /**
     * Send magic link to user
     */
    send: protectedProcedure
      .input(SendMagicLinkSchema)
      .mutation(async ({ input, ctx }) => {
        // Validate delivery method has required contact info
        if (input.deliveryMethod === 'sms' && !input.phoneNumber) {
          throw new Error('Phone number required for SMS delivery');
        }
        if (input.deliveryMethod === 'email' && !input.email) {
          throw new Error('Email address required for email delivery');
        }

        return await magicLinkService.sendMagicLink({
          ...input,
          agentId: ctx.agent.id
        });
      }),

    /**
     * Track magic link access
     */
    trackAccess: protectedProcedure
      .input(TrackMagicLinkSchema)
      .mutation(async ({ input, ctx }) => {
        return await magicLinkService.trackAccess(
          input.token,
          input.userAgent,
          input.ipAddress
        );
      }),

    /**
     * Validate magic link token
     */
    validate: protectedProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input, ctx }) => {
        return await magicLinkService.validateMagicLink(input.token);
      }),

    /**
     * Get user's magic link history
     */
    getUserHistory: protectedProcedure
      .input(MagicLinkHistorySchema)
      .query(async ({ input, ctx }) => {
        return await magicLinkService.getUserMagicLinkHistory(input.userId, {
          page: input.page,
          limit: input.limit,
          linkType: input.linkType,
          startDate: input.startDate,
          endDate: input.endDate
        });
      }),

    /**
     * Get magic link analytics
     */
    getAnalytics: protectedProcedure
      .input(MagicLinkAnalyticsSchema)
      .query(async ({ input, ctx }) => {
        // Allow all agents to see full magic link analytics for better insights
        const agentId = input.agentId;
        
        return await magicLinkService.getAnalytics({
          agentId,
          startDate: input.startDate,
          endDate: input.endDate,
          linkType: input.linkType
        });
      })
  }),

  // ==========================================================================
  // Combined Operations
  // ==========================================================================

  /**
   * Send magic link via SMS (convenience method)
   */
  sendMagicLinkSMS: protectedProcedure
    .input(z.object({
      userId: z.number(),
      phoneNumber: z.string(),
      linkType: z.enum(['firstLogin', 'claimPortal', 'documentUpload', 'claimCompletion', 'requirementReview', 'statusUpdate', 'profileUpdate']),
      callSessionId: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // Use the proper magic link service instead of SMS service placeholder
      return await magicLinkService.sendMagicLink({
        userId: input.userId,
        linkType: input.linkType,
        deliveryMethod: 'sms',
        phoneNumber: input.phoneNumber,
        agentId: ctx.agent.id,
        callSessionId: input.callSessionId
      });
    }),

  /**
   * Send review request SMS (convenience method)
   */
  sendReviewSMS: protectedProcedure
    .input(z.object({
      userId: z.number(),
      phoneNumber: z.string(),
      callSessionId: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const reviewMessage = `Let us know how we did! 

trustpilot.com/evaluate/resolvemyclaim.co.uk`;

      return await smsService.sendSMS({
        phoneNumber: input.phoneNumber,
        message: reviewMessage,
        messageType: 'review_request',
        agentId: ctx.agent.id,
        userId: input.userId,
        callSessionId: input.callSessionId
      });
    }),

  /**
   * Get combined dashboard stats
   */
  getDashboardStats: protectedProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional()
    }))
    .query(async ({ input, ctx }) => {
      const agentId = ctx.agent.role === 'agent' ? ctx.agent.id : undefined;
      
      const [smsStats, magicLinkAnalytics] = await Promise.all([
        smsService.getSMSStats(agentId, input.startDate, input.endDate),
        magicLinkService.getAnalytics({
          agentId,
          startDate: input.startDate,
          endDate: input.endDate
        })
      ]);

      return {
        sms: smsStats,
        magicLinks: magicLinkAnalytics,
        summary: {
          totalSMSSent: smsStats.messages.sent,
          totalSMSReceived: smsStats.messages.received,
          activeConversations: smsStats.conversations.active,
          magicLinksSent: magicLinkAnalytics.totalSent,
          magicLinksAccessed: magicLinkAnalytics.totalAccessed,
          magicLinkAccessRate: magicLinkAnalytics.accessRate
        }
      };
    })
}); 