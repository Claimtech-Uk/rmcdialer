// =============================================================================
// SMS Service - Communications Module
// =============================================================================
// Handles SMS messaging, conversations, auto-responses, and Twilio integration

import { prisma } from '@/lib/db';
import { logger } from '@/modules/core';
import type {
  SendSMSOptions,
  IncomingSMSData,
  SMSConversationOptions,
  AutoResponseRule,
  SMSMessage,
  SMSConversation,
  SMSSendResult,
  SMSProcessResult,
  SMSStats,
  TwilioClient,
  CommunicationsServiceDependencies,
  PaginatedSMSConversations,
  ConversationStatus
} from '../types/communications.types';

export class SMSService {
  private twilioClient: TwilioClient | null = null;
  private fromNumber: string;
  private dependencies: CommunicationsServiceDependencies;
  
  private autoResponseRules: AutoResponseRule[] = [
    {
      keywords: ['help', 'support', 'assistance'],
      response: "Hi! I'm here to help with your claim. An agent will respond shortly. For urgent matters, please call us directly.",
      priority: 1
    },
    {
      keywords: ['documents', 'upload', 'send', 'file'],
      response: "To upload documents, please use the secure link we'll send you shortly. This ensures your personal information stays protected.",
      priority: 2
    },
    {
      keywords: ['status', 'progress', 'update'],
      response: "I'll get an agent to provide you with a status update on your claim. They'll be in touch soon.",
      priority: 2,
      requiresAgent: true
    },
    {
      keywords: ['stop', 'unsubscribe', 'opt out'],
      response: "You've been unsubscribed from SMS updates. You can still receive important notifications by phone or email.",
      priority: 10
    },
    {
      keywords: ['yes', 'ok', 'confirm', 'agreed'],
      response: "Thank you for confirming. An agent will follow up with next steps shortly.",
      priority: 3
    }
  ];

  constructor(dependencies: CommunicationsServiceDependencies) {
    this.dependencies = dependencies;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '+447700000000';
    this.initializeTwilio();
  }

  private async initializeTwilio(): Promise<void> {
    try {
      // In production, this would initialize the real Twilio client
      // const twilio = require('twilio');
      // this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      // For development, we'll use a mock client
      this.twilioClient = {
        messages: {
          create: async (options) => {
            logger.info('Mock SMS sent', {
              to: options.to,
              from: options.from,
              body: options.body
            });
            return {
              sid: `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
              status: 'queued'
            };
          }
        }
      };
      
      logger.info('SMS service initialized', { 
        fromNumber: this.fromNumber,
        mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'
      });
    } catch (error) {
      logger.error('Failed to initialize Twilio client:', error);
      this.twilioClient = null;
    }
  }

  /**
   * Send an SMS message
   */
  async sendSMS(options: SendSMSOptions): Promise<SMSSendResult> {
    if (!this.twilioClient) {
      throw new Error('SMS service not initialized');
    }

    const { phoneNumber, message, agentId, userId, messageType = 'manual' } = options;

    try {
      // Send via Twilio
      const twilioResponse = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber,
        statusCallback: `${process.env.API_BASE_URL}/api/webhooks/sms/status`
      });

      // Find or create conversation
      const conversation = await this.findOrCreateConversation(phoneNumber, userId);

      // Log the message in database
      const smsMessage = await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'outbound',
          body: message,
          twilioMessageSid: twilioResponse.sid,
          isAutoResponse: messageType === 'auto_response',
          sentAt: new Date()
        }
      });

      // Update conversation status
      await prisma.smsConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          status: 'active',
          ...(agentId && { assignedAgentId: agentId })
        }
      });

      logger.info('SMS sent successfully', {
        messageId: smsMessage.id,
        twilioSid: twilioResponse.sid,
        to: phoneNumber,
        type: messageType,
        agentId
      });

      return {
        messageId: smsMessage.id,
        twilioSid: twilioResponse.sid,
        conversation: conversation,
        status: 'sent'
      };

    } catch (error) {
      logger.error('Failed to send SMS:', error);
      
      // Log failed attempt
      if (userId) {
        const conversation = await this.findOrCreateConversation(phoneNumber, userId);
        await prisma.smsMessage.create({
          data: {
            conversationId: conversation.id,
            direction: 'outbound',
            body: message,
            isAutoResponse: messageType === 'auto_response',
            sentAt: new Date()
            // Note: Status and failure tracking removed - not in schema
          }
        });
      }
      
      throw error;
    }
  }

  /**
   * Process incoming SMS message
   */
  async processIncomingSMS(incomingData: IncomingSMSData): Promise<SMSProcessResult> {
    const { from, body, messageSid, timestamp } = incomingData;

    try {
      // Find existing conversation
      const conversation = await this.findOrCreateConversation(from);

      // Log incoming message
      const smsMessage = await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'inbound',
          body: body,
          twilioMessageSid: messageSid,
          isAutoResponse: false,
          receivedAt: timestamp
        }
      });

      // Update conversation
      await prisma.smsConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: timestamp,
          status: 'active'
        }
      });

      // Check for auto-response
      const autoResponse = await this.checkAutoResponse(body, conversation);
      
      let responseMessage = null;
      if (autoResponse) {
        responseMessage = await this.sendSMS({
          phoneNumber: from,
          message: autoResponse.response,
          messageType: 'auto_response',
          userId: conversation.userId ? Number(conversation.userId) : undefined
        });

        // Mark conversation as needing agent attention if required
        if (autoResponse.requiresAgent) {
          await prisma.smsConversation.update({
            where: { id: conversation.id },
            data: { status: 'active' }
          });
        }
      }

      logger.info('Incoming SMS processed', {
        messageId: smsMessage.id,
        conversationId: conversation.id,
        from,
        hasAutoResponse: !!autoResponse
      });

      return {
        message: smsMessage as SMSMessage,
        conversation,
        autoResponse: responseMessage || undefined
      };

    } catch (error) {
      logger.error('Failed to process incoming SMS:', error);
      throw error;
    }
  }

  /**
   * Get SMS conversation history
   */
  async getConversation(
    conversationId: string, 
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    conversation: SMSConversation;
    messages: SMSMessage[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const { page = 1, limit = 50 } = options;

    const [conversation, messages, messageCount] = await Promise.all([
      prisma.smsConversation.findUnique({
        where: { id: conversationId },
        include: {
          assignedAgent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }),
      prisma.smsMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.smsMessage.count({
        where: { conversationId }
      })
    ]);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Enhance conversation with user data and proper type mapping
    const enhancedConversation: SMSConversation = {
      ...this.transformConversation(conversation),
      user: conversation.userId ? await this.getUserData(Number(conversation.userId)) : undefined
    };

    return {
      conversation: enhancedConversation,
      messages: messages.reverse() as SMSMessage[], // Show oldest first in UI
      pagination: {
        page,
        limit,
        total: messageCount,
        totalPages: Math.ceil(messageCount / limit),
        hasMore: messageCount > page * limit
      }
    };
  }

  /**
   * Get all conversations with filtering
   */
  async getConversations(options: SMSConversationOptions = {}): Promise<PaginatedSMSConversations> {
    const { phoneNumber, userId, agentId, status, page = 1, limit = 20 } = options;

    const where: any = {};
    if (phoneNumber) where.phoneNumber = phoneNumber;
    if (userId) where.userId = userId;
    if (agentId) where.assignedAgentId = agentId;
    if (status) where.status = status;

    const [conversations, total] = await Promise.all([
      prisma.smsConversation.findMany({
        where,
        include: {
          assignedAgent: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.smsConversation.count({ where })
    ]);

    // Enhance with user data and latest message
    const enhancedConversations = await Promise.all(
      conversations.map(async (conv: any) => {
        const latestMessage = await prisma.smsMessage.findFirst({
          where: { conversationId: conv.id },
          orderBy: { createdAt: 'desc' },
          select: {
            body: true,
            direction: true,
            createdAt: true,
            isAutoResponse: true
          }
        });

        const enhancedConv: SMSConversation = {
          ...this.transformConversation(conv),
          user: conv.userId ? await this.getUserData(Number(conv.userId)) : undefined,
          latestMessage: latestMessage ? {
            ...latestMessage,
            direction: latestMessage.direction as 'inbound' | 'outbound'
          } : undefined,
          messageCount: conv._count.messages
        };

        return enhancedConv;
      })
    );

    return {
      data: enhancedConversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: total > page * limit
      }
    };
  }

  /**
   * Assign conversation to agent
   */
  async assignConversation(conversationId: string, agentId: number): Promise<SMSConversation> {
    const conversation = await prisma.smsConversation.update({
      where: { id: conversationId },
      data: {
        assignedAgentId: agentId,
        status: 'active'
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    logger.info('SMS conversation assigned', {
      conversationId,
      agentId,
      phoneNumber: conversation.phoneNumber
    });

    return this.transformConversation(conversation);
  }

  /**
   * Close SMS conversation
   */
  async closeConversation(
    conversationId: string, 
    agentId: number, 
    reason?: string
  ): Promise<SMSConversation> {
    const conversation = await prisma.smsConversation.update({
      where: { id: conversationId },
      data: {
        status: 'closed',
        lastMessageAt: new Date()
      }
    });

    logger.info('SMS conversation closed', {
      conversationId,
      agentId,
      reason
    });

    return this.transformConversation(conversation);
  }

  /**
   * Send magic link via SMS (integration with Magic Link Service)
   */
  async sendMagicLink(
    userId: number, 
    phoneNumber: string, 
    linkType: string, 
    agentId?: number, 
    callSessionId?: string
  ): Promise<{
    messageId: string;
    twilioSid: string;
    magicLinkId: string;
    trackingId: string;
    status: 'sent' | 'failed';
  }> {
    // This will be integrated with the Magic Link Service once it's migrated
    const user = await this.getUserData(userId);
    
    try {
      // For now, create a placeholder magic link message
      const magicLinkUrl = `https://claim.resolvemyclaim.co.uk/magic-link/${Buffer.from(userId.toString()).toString('base64')}`;
      const message = `Hi ${user.firstName}, here's your secure link to access your claim: ${magicLinkUrl}`;
      
      const result = await this.sendSMS({
        phoneNumber,
        message,
        messageType: 'magic_link',
        agentId,
        userId,
        callSessionId
      });

      logger.info('Magic link sent via SMS service integration', {
        userId,
        linkType,
        agentId,
        callSessionId
      });

      return {
        messageId: result.messageId,
        twilioSid: result.twilioSid,
        magicLinkId: 'pending-magic-link-service',
        trackingId: 'pending-magic-link-service',
        status: result.status
      };

    } catch (error) {
      logger.error('Failed to send magic link via SMS service integration:', error);
      throw error;
    }
  }

  /**
   * Update SMS message status from Twilio webhook
   */
  async updateMessageStatus(
    twilioMessageSid: string, 
    status: string, 
    errorCode?: string, 
    errorMessage?: string
  ): Promise<{ count: number }> {
    try {
      const updateData: any = {
        status: status.toLowerCase(),
        updatedAt: new Date()
      };

      if (errorCode) {
        updateData.failureReason = `${errorCode}: ${errorMessage || 'Unknown error'}`;
      }

      const updatedMessage = await prisma.smsMessage.updateMany({
        where: { twilioMessageSid },
        data: updateData
      });

      logger.info('SMS message status updated', {
        twilioMessageSid,
        status,
        errorCode,
        updatedCount: updatedMessage.count
      });

      return updatedMessage;

    } catch (error) {
      logger.error('Failed to update SMS message status:', error);
      throw error;
    }
  }

  /**
   * Get SMS statistics
   */
  async getSMSStats(
    agentId?: number, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<SMSStats> {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const where: any = {};
    if (agentId) where.sentByAgentId = agentId;
    if (startDate || endDate) where.sentAt = dateFilter;

    const [messageStats, conversationStats] = await Promise.all([
      prisma.smsMessage.groupBy({
        by: ['direction', 'isAutoResponse'],
        where,
        _count: { id: true }
      }),
      prisma.smsConversation.aggregate({
        where: {
          ...(agentId && { assignedAgentId: agentId }),
          ...(startDate || endDate ? { createdAt: dateFilter } : {})
        },
        _count: { id: true }
      })
    ]);

    // Process stats
    const stats: SMSStats = {
      messages: {
        total: 0,
        sent: 0,
        received: 0,
        failed: 0,
        autoResponses: 0,
        magicLinks: 0
      },
      conversations: {
        total: conversationStats._count.id,
        active: 0,
        closed: 0
      }
    };

    messageStats.forEach((stat: any) => {
      stats.messages.total += stat._count.id;
      
      if (stat.direction === 'outbound') {
        stats.messages.sent += stat._count.id;
      } else {
        stats.messages.received += stat._count.id;
      }
      
      if (stat.isAutoResponse) {
        stats.messages.autoResponses += stat._count.id;
      }
    });

    return stats;
  }

  // -----------------------------------------------------------------------------
  // Private Helper Methods
  // -----------------------------------------------------------------------------

  private transformConversation(conversation: any): SMSConversation {
    return {
      ...conversation,
      userId: conversation.userId ? Number(conversation.userId) : undefined,
      assignedAgentId: conversation.assignedAgentId || undefined,
      updatedAt: conversation.createdAt
    } as SMSConversation;
  }

  private async findOrCreateConversation(
    phoneNumber: string, 
    userId?: number
  ): Promise<SMSConversation> {
    // Try to find existing conversation
    let conversation = await prisma.smsConversation.findFirst({
      where: { phoneNumber }
    });

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.smsConversation.create({
        data: {
          phoneNumber,
          userId,
          status: 'active',
          lastMessageAt: new Date()
        }
      });

      logger.info('New SMS conversation created', {
        conversationId: conversation.id,
        phoneNumber,
        userId
      });
    } else if (userId && !conversation.userId) {
      // Update conversation with user ID if we have it
      conversation = await prisma.smsConversation.update({
        where: { id: conversation.id },
        data: { userId }
      });
    }

    return this.transformConversation(conversation);
  }

  private async checkAutoResponse(
    messageBody: string, 
    conversation: any
  ): Promise<AutoResponseRule | null> {
    const body = messageBody.toLowerCase().trim();
    
    // Skip auto-response if conversation was recently active
    const recentMessages = await prisma.smsMessage.count({
      where: {
        conversationId: conversation.id,
        createdAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
        }
      }
    });

    if (recentMessages > 3) {
      return null; // Don't auto-respond if conversation is very active
    }

    // Find matching auto-response rule
    const matchedRule = this.autoResponseRules
      .filter(rule => rule.keywords.some(keyword => body.includes(keyword)))
      .sort((a, b) => a.priority - b.priority)[0];

    return matchedRule || null;
  }

  private async getUserData(userId: number) {
    // If userService is available, use it, otherwise use mock data
    if (this.dependencies.userService) {
      try {
        return await this.dependencies.userService.getUserData(userId);
      } catch (error) {
        logger.warn('Failed to get user data from service, using mock data', { userId, error });
      }
    }

    // Mock user data for development
    const mockUsers: Record<number, any> = {
      12345: {
        id: 12345,
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@email.com',
        phoneNumber: '+447700123456'
      },
      23456: {
        id: 23456,
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.j@email.com',
        phoneNumber: '+447700234567'
      },
      34567: {
        id: 34567,
        firstName: 'Michael',
        lastName: 'Brown',
        email: 'mike.brown@email.com',
        phoneNumber: '+447700345678'
      }
    };

    return mockUsers[userId] || {
      id: userId,
      firstName: 'Unknown',
      lastName: 'User',
      email: `user${userId}@email.com`,
      phoneNumber: '+447700000000'
    };
  }
} 