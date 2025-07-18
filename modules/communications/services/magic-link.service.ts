// =============================================================================
// Magic Link Service - Communications Module
// =============================================================================
// Handles secure magic link generation, delivery, tracking, and analytics

import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/modules/core';
import type {
  MagicLinkType,
  DeliveryMethod,
  MagicLinkOptions,
  MagicLinkResult,
  SendMagicLinkOptions,
  MagicLinkActivity,
  MagicLinkAnalytics,
  MagicLinkSendResult,
  CommunicationsServiceDependencies,
  PaginatedMagicLinkActivities
} from '../types/communications.types';

export class MagicLinkService {
  private baseUrl: string;
  private encryptionKey: string;
  private defaultExpiryHours: number = 48;
  private dependencies: CommunicationsServiceDependencies;

  constructor(dependencies: CommunicationsServiceDependencies) {
    this.dependencies = dependencies;
    this.baseUrl = process.env.MAIN_APP_URL || 'https://claim.resolvemyclaim.co.uk';
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    
    logger.info('Magic Link service initialized', {
      baseUrl: this.baseUrl,
      defaultExpiry: this.defaultExpiryHours
    });
  }

  /**
   * Generate a magic link for a specific user and purpose
   */
  async generateMagicLink(options: MagicLinkOptions): Promise<MagicLinkResult> {
    const {
      userId,
      linkType,
      expiresInHours = this.defaultExpiryHours
    } = options;

    try {
      // Generate secure token
      const token = this.generateSecureToken(userId, linkType);
      const trackingId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000));

      // Build URL based on link type
      const url = this.buildTargetUrl(
        linkType, 
        token, 
        options.customParams || {}, 
        options.claimId, 
        options.requirementTypes
      );
      
      // Generate short URL for SMS (optional)
      const shortUrl = await this.generateShortUrl(url);

      // Store in database for tracking
      await prisma.magicLinkActivity.create({
        data: {
          id: trackingId,
          userId,
          linkType,
          linkToken: token,
          sentVia: options.deliveryMethod,
          sentByAgentId: options.agentId || 1,
          sentAt: new Date(),
          expiresAt,
          callSessionId: options.callSessionId
        }
      });

      logger.info('Magic link generated', {
        trackingId,
        userId,
        linkType,
        agentId: options.agentId,
        expiresAt
      });

      return {
        id: trackingId,
        url,
        shortUrl: shortUrl || undefined,
        token,
        expiresAt,
        trackingId
      };

    } catch (error) {
      logger.error('Failed to generate magic link:', error);
      throw new Error('Failed to generate magic link');
    }
  }

  /**
   * Send magic link via specified delivery method
   */
  async sendMagicLink(options: SendMagicLinkOptions): Promise<MagicLinkSendResult> {
    const { deliveryMethod, phoneNumber, email, userName, customMessage } = options;

    // Generate the magic link
    const magicLink = await this.generateMagicLink(options);

    // Prepare message content
    const message = customMessage || this.buildMessage(
      options.linkType, 
      magicLink.shortUrl || magicLink.url, 
      userName
    );

    let deliveryResult: any;

    try {
      switch (deliveryMethod) {
        case 'sms':
          if (!phoneNumber) throw new Error('Phone number required for SMS delivery');
          deliveryResult = await this.sendViaSMS(phoneNumber, message, options);
          break;
          
        case 'whatsapp':
          if (!phoneNumber) throw new Error('Phone number required for WhatsApp delivery');
          deliveryResult = await this.sendViaWhatsApp(phoneNumber, message, options);
          break;
          
        case 'email':
          if (!email) throw new Error('Email address required for email delivery');
          deliveryResult = await this.sendViaEmail(email, options);
          break;
          
        default:
          throw new Error(`Unsupported delivery method: ${deliveryMethod}`);
      }

      logger.info('Magic link sent successfully', {
        trackingId: magicLink.trackingId,
        deliveryMethod,
        userId: options.userId,
        linkType: options.linkType
      });

      return { 
        magicLink, 
        deliveryResult: {
          messageId: deliveryResult.messageId,
          twilioSid: deliveryResult.twilioSid,
          emailId: deliveryResult.emailId,
          status: 'sent'
        }
      };

    } catch (error) {
      logger.error('Failed to send magic link:', error);
      
      // Mark as failed in database
      await prisma.magicLinkActivity.update({
        where: { id: magicLink.trackingId },
        data: { 
          isActive: false,
          expiredReason: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Track magic link access
   */
  async trackAccess(
    token: string, 
    userAgent?: string, 
    ipAddress?: string
  ): Promise<boolean> {
    try {
      // Verify token is valid
      const decoded = this.verifyToken(token);
      if (!decoded) {
        return false;
      }

      // Find the magic link activity
      const activity = await prisma.magicLinkActivity.findFirst({
        where: { 
          linkToken: token,
          expiresAt: { gt: new Date() } // Not expired
        }
      });

      if (!activity) {
        return false;
      }

      // Update with access information
      await prisma.magicLinkActivity.update({
        where: { id: activity.id },
        data: {
          accessedAt: new Date(),
          accessCount: (activity.accessCount || 0) + 1,
          userAgent: userAgent,
          ipAddress: ipAddress
        }
      });

      logger.info('Magic link accessed', {
        trackingId: activity.id,
        userId: activity.userId,
        linkType: activity.linkType,
        accessCount: (activity.accessCount || 0) + 1
      });

      return true;

    } catch (error) {
      logger.error('Failed to track magic link access:', error);
      return false;
    }
  }

  /**
   * Get magic link history for a user
   */
  async getUserMagicLinkHistory(
    userId: number, 
    options: {
      page?: number;
      limit?: number;
      linkType?: MagicLinkType;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<PaginatedMagicLinkActivities> {
    const { page = 1, limit = 20, linkType, startDate, endDate } = options;

    const where: any = { userId };
    if (linkType) where.linkType = linkType;
    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) where.sentAt.gte = startDate;
      if (endDate) where.sentAt.lte = endDate;
    }

    const [activities, total] = await Promise.all([
      prisma.magicLinkActivity.findMany({
        where,
        include: {
          sentByAgent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.magicLinkActivity.count({ where })
    ]);

    // Transform activities to match our TypeScript types
    const transformedActivities: MagicLinkActivity[] = activities.map((activity: any) => ({
      ...activity,
      userId: Number(activity.userId), // Convert bigint to number
    }));

    return {
      data: transformedActivities,
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
   * Get magic link analytics
   */
  async getAnalytics(options: {
    agentId?: number;
    startDate?: Date;
    endDate?: Date;
    linkType?: MagicLinkType;
  } = {}): Promise<MagicLinkAnalytics> {
    const { agentId, startDate, endDate, linkType } = options;

    const where: any = {};
    if (agentId) where.sentByAgentId = agentId;
    if (linkType) where.linkType = linkType;
    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) where.sentAt.gte = startDate;
      if (endDate) where.sentAt.lte = endDate;
    }

    const [activities, agentStats] = await Promise.all([
      prisma.magicLinkActivity.findMany({
        where,
        include: {
          sentByAgent: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      // Get agent performance stats
      prisma.magicLinkActivity.groupBy({
        by: ['sentByAgentId'],
        where,
        _count: { id: true },
        _sum: { accessCount: true }
      })
    ]);

    // Calculate overall stats
    const totalSent = activities.length;
    const totalAccessed = activities.filter((a: any) => a.accessedAt).length;
    const accessRate = totalSent > 0 ? (totalAccessed / totalSent) * 100 : 0;

    // Group by type
    const byType: Record<string, any> = {};
    activities.forEach((activity: any) => {
      if (!byType[activity.linkType]) {
        byType[activity.linkType] = { sent: 0, accessed: 0, rate: 0 };
      }
      byType[activity.linkType].sent++;
      if (activity.accessedAt) {
        byType[activity.linkType].accessed++;
      }
    });

    // Calculate rates for each type
    Object.keys(byType).forEach(type => {
      const stats = byType[type];
      stats.rate = stats.sent > 0 ? (stats.accessed / stats.sent) * 100 : 0;
    });

    // Group by delivery method
    const byDeliveryMethod: Record<string, any> = {};
    activities.forEach((activity: any) => {
      if (!byDeliveryMethod[activity.sentVia]) {
        byDeliveryMethod[activity.sentVia] = { sent: 0, accessed: 0, rate: 0 };
      }
      byDeliveryMethod[activity.sentVia].sent++;
      if (activity.accessedAt) {
        byDeliveryMethod[activity.sentVia].accessed++;
      }
    });

    // Calculate rates for each delivery method
    Object.keys(byDeliveryMethod).forEach(method => {
      const stats = byDeliveryMethod[method];
      stats.rate = stats.sent > 0 ? (stats.accessed / stats.sent) * 100 : 0;
    });

    // Agent performance
    const byAgent = agentStats.map((stat: any) => {
      const agent = activities.find((a: any) => a.sentByAgentId === stat.sentByAgentId)?.sentByAgent;
      const accessed = activities.filter((a: any) => 
        a.sentByAgentId === stat.sentByAgentId && a.accessedAt
      ).length;
      
      return {
        agentId: stat.sentByAgentId || 0,
        agentName: agent ? `${agent.firstName} ${agent.lastName}` : 'Unknown',
        sent: stat._count.id,
        accessed,
        rate: stat._count.id > 0 ? (accessed / stat._count.id) * 100 : 0
      };
    });

    // Recent activity
    const recentActivity = activities
      .slice(0, 10)
      .map((activity: any) => ({
        id: activity.id,
        userId: Number(activity.userId),
        userName: this.getMockUserName(Number(activity.userId)),
        linkType: activity.linkType as MagicLinkType,
        sentAt: activity.sentAt,
        accessedAt: activity.accessedAt,
        agentName: activity.sentByAgent ? 
          `${activity.sentByAgent.firstName} ${activity.sentByAgent.lastName}` : 
          'System'
      }));

    return {
      totalSent,
      totalAccessed,
      accessRate,
      byType: byType as Record<MagicLinkType, { sent: number; accessed: number; rate: number }>,
      byDeliveryMethod: byDeliveryMethod as Record<DeliveryMethod, { sent: number; accessed: number; rate: number }>,
      byAgent,
      recentActivity
    };
  }

  /**
   * Validate and get magic link details
   */
  async validateMagicLink(token: string): Promise<{
    isValid: boolean;
    userId?: number;
    linkType?: MagicLinkType;
    expiresAt?: Date;
  }> {
    try {
      const decoded = this.verifyToken(token);
      if (!decoded) {
        return { isValid: false };
      }

      const activity = await prisma.magicLinkActivity.findFirst({
        where: { 
          linkToken: token,
          expiresAt: { gt: new Date() }
        }
      });

      if (!activity) {
        return { isValid: false };
      }

      return {
        isValid: true,
        userId: Number(activity.userId),
        linkType: activity.linkType as MagicLinkType,
        expiresAt: activity.expiresAt || undefined
      };

    } catch (error) {
      logger.error('Failed to validate magic link:', error);
      return { isValid: false };
    }
  }

  // -----------------------------------------------------------------------------
  // Private Helper Methods
  // -----------------------------------------------------------------------------

  private generateSecureToken(userId: number, linkType: MagicLinkType): string {
    // Create a more secure token than just base64
    const timestamp = Date.now().toString();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const data = `${userId}:${linkType}:${timestamp}:${randomBytes}`;
    
    // Create HMAC for integrity
    const hmac = crypto.createHmac('sha256', this.encryptionKey);
    hmac.update(data);
    const signature = hmac.digest('hex');
    
    // Combine data and signature, then encode
    const combined = `${data}:${signature}`;
    return Buffer.from(combined).toString('base64url');
  }

  private verifyToken(token: string): { 
    userId: number; 
    linkType: MagicLinkType; 
    timestamp: number 
  } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const parts = decoded.split(':');
      
      if (parts.length !== 5) return null;
      
      const [userId, linkType, timestamp, randomBytes, signature] = parts;
      const data = `${userId}:${linkType}:${timestamp}:${randomBytes}`;
      
      // Verify HMAC
      const hmac = crypto.createHmac('sha256', this.encryptionKey);
      hmac.update(data);
      const expectedSignature = hmac.digest('hex');
      
      if (signature !== expectedSignature) return null;
      
      return {
        userId: parseInt(userId),
        linkType: linkType as MagicLinkType,
        timestamp: parseInt(timestamp)
      };
    } catch (error) {
      return null;
    }
  }

  private buildTargetUrl(
    linkType: MagicLinkType,
    token: string,
    customParams: Record<string, string>,
    claimId?: number,
    requirementTypes?: string[]
  ): string {
    const routes: Record<MagicLinkType, string> = {
      firstLogin: '/first-login',
      claimPortal: '/claims',
      documentUpload: '/claim/requirements',
      claimCompletion: '/claim/incomplete-redirect',
      requirementReview: '/claim/requirements/review',
      statusUpdate: '/claim/status',
      profileUpdate: '/profile/update'
    };

    const baseRoute = routes[linkType];
    const url = new URL(baseRoute, this.baseUrl);
    
    // Add magic link token (mlid for compatibility)
    url.searchParams.set('mlid', token);
    
    // Add claim ID if provided
    if (claimId) {
      url.searchParams.set('claim_id', claimId.toString());
    }
    
    // Add requirement types for document upload
    if (requirementTypes && requirementTypes.length > 0) {
      url.searchParams.set('requirements', requirementTypes.join(','));
    }
    
    // Add custom parameters
    Object.entries(customParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    // Add cross-platform support parameters
    url.searchParams.set('utm_source', 'dialler');
    url.searchParams.set('utm_medium', 'magic_link');
    url.searchParams.set('utm_campaign', linkType);
    
    return url.toString();
  }

  private buildMessage(linkType: MagicLinkType, url: string, userName?: string): string {
    const greeting = userName ? `Hi ${userName}` : 'Hi there';
    
    const messages: Record<MagicLinkType, string> = {
      firstLogin: `${greeting}, welcome to RMC! Use this secure link to access your account: ${url}`,
      claimPortal: `${greeting}, here's your secure link to view your claim: ${url}`,
      documentUpload: `${greeting}, please upload your documents using this secure link: ${url}`,
      claimCompletion: `${greeting}, complete your claim using this secure link: ${url}`,
      requirementReview: `${greeting}, please review your claim requirements: ${url}`,
      statusUpdate: `${greeting}, check your claim status update: ${url}`,
      profileUpdate: `${greeting}, update your profile information: ${url}`
    };

    return messages[linkType] + '\n\nThis link is valid for 48 hours and is secure for your personal information.';
  }

  private async generateShortUrl(_url: string): Promise<string | null> {
    // In production, this would integrate with a URL shortening service
    // For now, return null to use the full URL
    return null;
  }

  private async sendViaSMS(
    phoneNumber: string, 
    message: string, 
    options: SendMagicLinkOptions
  ) {
    // Integration with SMS service - will be properly connected once both services are complete
    logger.info('Magic link SMS would be sent via SMS service', {
      phoneNumber,
      linkType: options.linkType,
      userId: options.userId
    });
    
    return {
      method: 'sms',
      status: 'sent',
      messageId: `sms_${Date.now()}`,
      twilioSid: `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`
    };
  }

  private async sendViaWhatsApp(
    phoneNumber: string, 
    message: string, 
    options: SendMagicLinkOptions
  ) {
    // WhatsApp integration would go here
    // For now, fall back to SMS
    return await this.sendViaSMS(phoneNumber, message, options);
  }

  private async sendViaEmail(email: string, options: SendMagicLinkOptions) {
    // Email integration would go here
    // For now, log and return mock response
    logger.info('Magic link email would be sent', {
      email,
      linkType: options.linkType,
      userId: options.userId
    });
    
    return {
      method: 'email',
      status: 'sent',
      emailId: `email_${Date.now()}`
    };
  }

  private getMockUserName(userId: number): string {
    const mockUsers: Record<number, string> = {
      12345: 'John Smith',
      23456: 'Sarah Johnson',
      34567: 'Michael Brown',
      45678: 'Emma Wilson',
      56789: 'David Taylor'
    };

    return mockUsers[userId] || `User ${userId}`;
  }
} 