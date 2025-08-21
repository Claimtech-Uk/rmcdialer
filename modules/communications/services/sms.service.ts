// =============================================================================
// SMS Service - Communications Module
// =============================================================================
// Handles SMS messaging, conversations, auto-responses, and Twilio integration

import { prisma } from '@/lib/db';
// Note: Removed legacy plan mapping imports - no longer needed with AI-controlled system
import { replicaDb } from '@/lib/mysql';
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
      // Check if we have Twilio credentials
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || 
          process.env.TWILIO_ACCOUNT_SID?.startsWith('your-') || 
          process.env.TWILIO_AUTH_TOKEN?.startsWith('your-')) {
        
        logger.warn('Twilio credentials not configured, SMS functionality will be limited');
        this.twilioClient = null;
        return;
      }

      // Initialize real Twilio client
      const twilio = require('twilio');
      this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      logger.info('AI SMS | SMS service initialized with real Twilio client', { 
        fromNumber: this.fromNumber,
        mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'
      });
    } catch (error) {
      logger.error('Failed to initialize Twilio client:', error);
      this.twilioClient = null;
    }
  }

  /**
   * Get the appropriate sender number based on action type
   * CRITICAL SEPARATION: Manual vs AI actions use different numbers
   */
  private getAiSmsFromNumber(messageType?: string, fromNumberOverride?: string): string {
    // AI-ONLY experimental actions: Use test number to prevent production spam
    if (messageType === 'auto_response' || messageType === 'magic_link') {
      const testNumber = process.env.AI_SMS_TEST_NUMBER || '+447723495560';
      console.log('AI SMS | 🧪 Using AI test number for message type:', messageType, 'Number:', testNumber);
      return testNumber;
    }
    
    // ALL OTHER message types: Use main number (manual, follow-ups, confirmations, reviews)
    // This includes: 'manual', 'no_answer_checkin', 'callback_confirmation', 'review_request', etc.
    console.log('AI SMS | 👥 Using main number for message type:', messageType || 'default', 'Number:', fromNumberOverride || this.fromNumber);
    return fromNumberOverride || this.fromNumber;
  }

  /**
   * Send an SMS message
   */
  async sendSMS(options: SendSMSOptions): Promise<SMSSendResult> {
    if (!this.twilioClient) {
      throw new Error('SMS service not initialized');
    }

    const { phoneNumber, message, agentId, userId, messageType = 'manual', fromNumberOverride } = options;
    
    // Determine the appropriate sender number
    const senderNumber = this.getAiSmsFromNumber(messageType, fromNumberOverride);

    try {
      console.log('AI SMS | 📨 Twilio send attempt', {
        to: phoneNumber,
        from: senderNumber,
        length: message.length,
        type: messageType,
        isAiSms: messageType === 'auto_response' || messageType === 'magic_link',
        isManual: messageType === 'manual'
      })
      // Send via Twilio
      // Determine status callback base URL from environment with fallbacks
      const apiBase = process.env.API_BASE_URL || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` || process.env.MAIN_APP_URL || ''
      const statusCallbackUrl = apiBase ? `${apiBase}/api/webhooks/twilio/sms/status` : undefined

      const twilioResponse = await this.twilioClient.messages.create({
        body: message,
        from: senderNumber,
        to: phoneNumber,
        ...(statusCallbackUrl ? { statusCallback: statusCallbackUrl } : {})
      });
      console.log('AI SMS | 📨 Twilio responded', { sid: twilioResponse.sid, status: twilioResponse.status })

      // Find or create conversation with 'closed' status for outbound messages
      const conversation = await this.findOrCreateConversation(phoneNumber, userId, 'closed');

      // Log the message in database
      const smsMessage = await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'outbound',
          body: message,
          twilioMessageSid: twilioResponse.sid,
          isAutoResponse: messageType === 'auto_response',
          messageType: messageType,
          sentAt: new Date()
        }
      });

      // Note: Plan binding system removed - replaced by AI-controlled followup scheduling

      // Update conversation timestamp but keep it closed for outbound messages
      await prisma.smsConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          // Don't change status for outbound messages - keep conversations closed
          ...(agentId && { assignedAgentId: agentId })
        }
      });

      logger.info('AI SMS | SMS sent successfully', {
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
      logger.error('AI SMS | Failed to send SMS:', error);
      console.error('AI SMS | ❌ Twilio send failed', { to: phoneNumber, from: fromNumberOverride || this.fromNumber, error })
      
      // Log failed attempt
      if (userId) {
        const conversation = await this.findOrCreateConversation(phoneNumber, userId, 'closed');
        await prisma.smsMessage.create({
          data: {
            conversationId: conversation.id,
            direction: 'outbound',
            body: message,
            isAutoResponse: messageType === 'auto_response',
            messageType: messageType,
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
        message: {
          ...smsMessage,
          updatedAt: smsMessage.createdAt
        } as SMSMessage,
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

    // Transform messages to include updatedAt field
    const transformedMessages = messages.reverse().map(msg => ({
      ...msg,
      updatedAt: msg.createdAt
    })) as SMSMessage[];

    return {
      conversation: enhancedConversation,
      messages: transformedMessages, // Show oldest first in UI
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
   * ⚡ Get lightweight conversation list - DEFAULT METHOD
   * Returns minimal data: basic info + latest message only
   * Optimized for fast page loads - typically ~50ms
   */
  async getConversationsList(options: SMSConversationOptions = {}): Promise<PaginatedSMSConversations> {
    const startTime = Date.now();
    const { phoneNumber, userId, agentId, status, page = 1, limit = 10 } = options;

    logger.info('SMS conversations list query started', { 
      filters: { phoneNumber: !!phoneNumber, userId, agentId, status }, 
      pagination: { page, limit } 
    });

    // Build where clause
    const where: any = {};
    if (phoneNumber) where.phoneNumber = phoneNumber;
    if (userId) where.userId = userId;
    if (agentId) where.assignedAgentId = agentId;
    if (status) where.status = status;

    try {
      // 🚀 SINGLE OPTIMIZED QUERY: Get conversations with latest message in one go
      const [conversations, total] = await Promise.all([
        prisma.smsConversation.findMany({
          where,
          select: {
            id: true,
            phoneNumber: true,
            userId: true,
            status: true,
            lastMessageAt: true,
            createdAt: true,
            // Get latest message via sub-query (much faster than separate queries)
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: {
                body: true,
                direction: true,
                createdAt: true,
                isAutoResponse: true
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

      // Extract unique user IDs for batch user lookup
      const userIds = Array.from(new Set(
        conversations
          .filter(c => c.userId)
          .map(c => Number(c.userId))
      ));

      // ⚡ ULTRA-FAST BATCH USER LOOKUP: Direct replica queries for speed
      let userDataMap = new Map();
      if (userIds.length > 0) {
        try {
          // 🚀 SINGLE BATCH QUERY: Get all users in one fast query
          const users = await replicaDb.user.findMany({
            where: { 
              id: { 
                in: userIds 
              } 
            },
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email_address: true,
              phone_number: true
            }
          });

          // Map results for fast lookup
          users.forEach(user => {
            userDataMap.set(Number(user.id), {
              id: Number(user.id),
              firstName: user.first_name || 'Unknown',
              lastName: user.last_name || 'User',
              email: user.email_address || '',
              phoneNumber: user.phone_number || ''
            });
          });

          // Add fallback data for any missing users
          userIds.forEach(userId => {
            if (!userDataMap.has(userId)) {
              userDataMap.set(userId, {
                id: userId,
                firstName: 'Unknown',
                lastName: 'User',
                email: '',
                phoneNumber: ''
              });
            }
          });

          logger.info('Fast batch user lookup completed', {
            requestedCount: userIds.length,
            foundCount: users.length,
            queryTime: 'sub-100ms'
          });

        } catch (error) {
          logger.warn('Fast batch user lookup failed', { error });
          // Provide fallback data for all users
          userIds.forEach(userId => {
            userDataMap.set(userId, {
              id: userId,
              firstName: 'Unknown',
              lastName: 'User',
              email: '',
              phoneNumber: ''
            });
          });
        }
      }

      // 🚀 TRANSFORM: Super lightweight transformation
      const summaryConversations = conversations.map((conv: any) => {
        const latestMessage = conv.messages[0]; // First (most recent) message
        const userData = conv.userId ? userDataMap.get(Number(conv.userId)) : undefined;

        return {
          id: conv.id,
          phoneNumber: conv.phoneNumber,
          userId: conv.userId ? Number(conv.userId) : undefined,
          status: conv.status,
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv.createdAt,
          updatedAt: conv.createdAt, // Use createdAt as fallback
          user: userData,
          latestMessage: latestMessage ? {
            body: latestMessage.body,
            direction: latestMessage.direction as 'inbound' | 'outbound',
            createdAt: latestMessage.createdAt,
            isAutoResponse: latestMessage.isAutoResponse
          } : undefined,
          messageCount: conv._count.messages
        };
      });

      const queryTime = Date.now() - startTime;
      logger.info('SMS conversations list completed', {
        conversationCount: summaryConversations.length,
        userCount: userIds.length,
        queryTime: `${queryTime}ms`,
        queriesExecuted: 2,
        performanceNote: 'Ultra-fast with direct user batch query'
      });

      return {
        data: summaryConversations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: total > page * limit
        }
      };

    } catch (error) {
      const queryTime = Date.now() - startTime;
      logger.error('SMS conversations list query failed', {
        error: error instanceof Error ? error.message : String(error),
        queryTime: `${queryTime}ms`,
        filters: where
      });
      throw error;
    }
  }

  /**
   * Get conversations with full data - OPTIMIZED IMPLEMENTATION
   * Uses efficient batched queries to eliminate N+1 problems
   */
  async getConversations(options: SMSConversationOptions = {}): Promise<PaginatedSMSConversations> {
    const startTime = Date.now();
    const { phoneNumber, userId, agentId, status, page = 1, limit = 20 } = options;

    logger.info('SMS conversations query started', { 
      filters: { phoneNumber: !!phoneNumber, userId, agentId, status }, 
      pagination: { page, limit } 
    });

    // Build where clause
    const where: any = {};
    if (phoneNumber) where.phoneNumber = phoneNumber;
    if (userId) where.userId = userId;
    if (agentId) where.assignedAgentId = agentId;
    if (status) where.status = status;

    try {
      // 🚀 QUERY 1: Get conversations with agents and message counts
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

      // Early return if no conversations
      if (conversations.length === 0) {
        logger.info('No SMS conversations found', { 
          queryTime: `${Date.now() - startTime}ms`,
          filters: where 
        });
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasMore: false
          }
        };
      }

      // Extract IDs for batch queries
      const conversationIds = conversations.map(c => c.id);
      const userIds = Array.from(new Set(
        conversations
          .filter(c => c.userId)
          .map(c => Number(c.userId))
      ));

      // 🚀 QUERY 2: Batch fetch latest messages
      const latestMessagesPromise = prisma.smsMessage.findMany({
        where: {
          conversationId: { in: conversationIds }
        },
        select: {
          conversationId: true,
          body: true,
          direction: true,
          createdAt: true,
          isAutoResponse: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // ⚡ ULTRA-FAST BATCH USER QUERY: Single query for all users
      const userDataPromise = userIds.length > 0 
        ? replicaDb.user.findMany({
            where: { 
              id: { 
                in: userIds 
              } 
            },
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email_address: true,
              phone_number: true
            }
          }).catch(error => {
            logger.warn('Fast batch user lookup failed in full conversations', { error });
            return []; // Return empty array on error
          })
        : Promise.resolve([]);

      // Execute batch queries in parallel
      const [latestMessages, userResults] = await Promise.all([
        latestMessagesPromise,
        userDataPromise
      ]);

      // Create efficient lookup maps
      const latestMessageMap = new Map();
      latestMessages.forEach(msg => {
        if (!latestMessageMap.has(msg.conversationId)) {
          latestMessageMap.set(msg.conversationId, msg);
        }
      });

      // ⚡ FAST USER MAP: Transform user results to lookup map
      const userDataMap = new Map();
      userResults.forEach(user => {
        userDataMap.set(Number(user.id), {
          id: Number(user.id),
          firstName: user.first_name || 'Unknown',
          lastName: user.last_name || 'User',
          email: user.email_address || '',
          phoneNumber: user.phone_number || ''
        });
      });

      // Add fallback data for any missing users
      userIds.forEach(userId => {
        if (!userDataMap.has(userId)) {
          userDataMap.set(userId, {
            id: userId,
            firstName: 'Unknown',
            lastName: 'User',
            email: '',
            phoneNumber: ''
          });
        }
      });

      // 🚀 ASSEMBLY: Combine all data efficiently
      const enhancedConversations = conversations.map((conv: any) => {
        const latestMessage = latestMessageMap.get(conv.id);
        const userData = conv.userId ? userDataMap.get(Number(conv.userId)) : undefined;

        return {
          ...this.transformConversation(conv),
          user: userData,
          latestMessage: latestMessage ? {
            ...latestMessage,
            direction: latestMessage.direction as 'inbound' | 'outbound'
          } : undefined,
          messageCount: conv._count.messages
        };
      });

      const queryTime = Date.now() - startTime;
      logger.info('SMS conversations query completed', {
        conversationCount: enhancedConversations.length,
        userCount: userIds.length,
        queryTime: `${queryTime}ms`,
        queriesExecuted: 3,
        performanceNote: 'Fast direct user queries'
      });

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

    } catch (error) {
      const queryTime = Date.now() - startTime;
      logger.error('SMS conversations query failed', {
        error: error instanceof Error ? error.message : String(error),
        queryTime: `${queryTime}ms`,
        filters: where
      });
      throw error;
    }
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
      const magicLinkUrl = `claim.resolvemyclaim.co.uk/magic-link/${Buffer.from(userId.toString()).toString('base64')}`;
      const message = `Hi ${user.firstName},\n\nAccess your secure claim portal here:\n\n${magicLinkUrl}`;
      
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
      // Our schema does not track status/failureReason columns for SMS messages.
      // We only set sentAt when the provider reports a successful send/delivery.
      const normalized = String(status).toLowerCase()
      const shouldMarkSent = normalized === 'sent' || normalized === 'delivered'

      if (!shouldMarkSent) {
        logger.info('AI SMS | No DB fields to update for SMS status', {
          twilioMessageSid,
          status,
          errorCode
        })
        return { count: 0 }
      }

      const updatedMessage = await prisma.smsMessage.updateMany({
        where: { twilioMessageSid },
        data: { sentAt: new Date() }
      })

      logger.info('AI SMS | SMS message marked as sent', {
        twilioMessageSid,
        status,
        updatedCount: updatedMessage.count
      })

      return updatedMessage

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

  private async searchUserByPhoneNumber(phoneNumber: string): Promise<{ id: number; firstName: string; lastName: string } | null> {
    try {
      // Clean phone number for matching (remove spaces, dashes, etc.)
      const cleanPhoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
      
      logger.info('Searching for user by phone number', { 
        originalPhone: phoneNumber, 
        cleanPhone: cleanPhoneNumber 
      });
      
      // Try multiple search strategies
      let user = null;
      
      // Strategy 1: Exact match
      user = await replicaDb.user.findFirst({
        where: {
          phone_number: phoneNumber
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true
        }
      });
      
      if (user) {
        logger.info('User found with exact match', { userId: user.id, phone: user.phone_number });
        return {
          id: Number(user.id),
          firstName: user.first_name || 'Unknown',
          lastName: user.last_name || 'User'
        };
      }
      
      // Strategy 2: Clean number match
      user = await replicaDb.user.findFirst({
        where: {
          phone_number: cleanPhoneNumber
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true
        }
      });
      
      if (user) {
        logger.info('User found with clean number match', { userId: user.id, phone: user.phone_number });
        return {
          id: Number(user.id),
          firstName: user.first_name || 'Unknown',
          lastName: user.last_name || 'User'
        };
      }
      
      // Strategy 3: Contains last 10 digits (most flexible)
      const last10Digits = cleanPhoneNumber.slice(-10);
      user = await replicaDb.user.findFirst({
        where: {
          phone_number: {
            contains: last10Digits
          }
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true
        }
      });
      
      if (user) {
        logger.info('User found with last 10 digits match', { 
          userId: user.id, 
          phone: user.phone_number,
          searchDigits: last10Digits 
        });
        return {
          id: Number(user.id),
          firstName: user.first_name || 'Unknown',
          lastName: user.last_name || 'User'
        };
      }
      
      // Strategy 4: Try without country code
      const withoutCountryCode = cleanPhoneNumber.replace(/^(\+44|44|0)/, '');
      if (withoutCountryCode !== cleanPhoneNumber) {
        user = await replicaDb.user.findFirst({
          where: {
            phone_number: {
              contains: withoutCountryCode
            }
          },
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phone_number: true
          }
        });
        
        if (user) {
          logger.info('User found without country code', { 
            userId: user.id, 
            phone: user.phone_number,
            searchWithout: withoutCountryCode 
          });
          return {
            id: Number(user.id),
            firstName: user.first_name || 'Unknown',
            lastName: user.last_name || 'User'
          };
        }
      }

      logger.warn('No user found for phone number', { 
        originalPhone: phoneNumber, 
        cleanPhone: cleanPhoneNumber,
        last10: last10Digits,
        withoutCountry: withoutCountryCode
      });
      return null;

    } catch (error) {
      logger.error('Failed to search user by phone number:', { phoneNumber, error });
      return null;
    }
  }

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
    userId?: number,
    initialStatus: string = 'active'
  ): Promise<SMSConversation> {
    const normalize = (n: string) => n.replace(/^\+/, '')
    const normalized = normalize(phoneNumber)
    // Try to find existing conversation
    let conversation = await prisma.smsConversation.findFirst({
      where: {
        OR: [
          { phoneNumber: normalized },
          { phoneNumber: `+${normalized}` }
        ]
      }
    });

    // If no existing conversation, try to find user by phone number
    let matchedUserId = userId;
    if (!matchedUserId && !conversation) {
      await this.searchUserByPhoneNumber(phoneNumber).then((user: { id: number; firstName: string; lastName: string } | null) => {
        if (user) {
          matchedUserId = user.id;
          logger.info('Matched SMS to existing user', {
            phoneNumber,
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`
          });
        }
      }).catch((error: any) => {
        logger.warn('Failed to search for user by phone number', { phoneNumber, error });
      });
    }

    if (!conversation) {
      // Create new conversation with matched user ID and specified status
      conversation = await prisma.smsConversation.create({
        data: {
          phoneNumber: normalized,
          userId: matchedUserId,
          status: initialStatus,
          lastMessageAt: new Date()
        }
      });

      logger.info('New SMS conversation created', {
        conversationId: conversation.id,
        phoneNumber,
        userId: matchedUserId,
        userMatched: !!matchedUserId,
        status: initialStatus
      });
    } else if (matchedUserId && !conversation.userId) {
      // Update conversation with user ID if we found a match
      conversation = await prisma.smsConversation.update({
        where: { id: conversation.id },
        data: { userId: matchedUserId }
      });

      logger.info('SMS conversation linked to user', {
        conversationId: conversation.id,
        phoneNumber,
        userId: matchedUserId
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

  /**
   * ⚡ ULTRA-FAST: Get basic user data for SMS conversations
   * Bypasses complex UserService to prevent timeouts
   * Only gets essential info: name, email, phone
   */
  private async getUserDataFast(userId: number) {
    try {
      // Direct lightweight query to replica database
      const user = await replicaDb.user.findFirst({
        where: { id: userId },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email_address: true,
          phone_number: true
        }
      });

      if (!user) {
        logger.warn('User not found in fast lookup', { userId });
        return {
          id: userId,
          firstName: 'Unknown',
          lastName: 'User',
          email: '',
          phoneNumber: ''
        };
      }

      return {
        id: Number(user.id),
        firstName: user.first_name || 'Unknown',
        lastName: user.last_name || 'User',
        email: user.email_address || '',
        phoneNumber: user.phone_number || ''
      };
      
    } catch (error) {
      logger.warn('Fast user lookup failed', { userId, error });
      // Return fallback data instead of throwing
      return {
        id: userId,
        firstName: 'Unknown',
        lastName: 'User',
        email: '',
        phoneNumber: ''
      };
    }
  }

  private async getUserData(userId: number) {
    try {
      // Always try to use UserService for real data
      if (this.dependencies.userService) {
        // Use the existing getUserData method if available
        return await this.dependencies.userService.getUserData(userId);
      }
      
      // If UserService is not available, throw error
      throw new Error(`UserService not available for user ${userId}`);
      
    } catch (error) {
      logger.error('Failed to get user data', { userId, error });
      throw error;
    }
  }
} 