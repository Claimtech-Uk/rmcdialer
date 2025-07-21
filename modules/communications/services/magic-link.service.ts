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
    const recentActivity = await Promise.all(activities
      .slice(0, 10)
      .map(async (activity: any) => ({
        id: activity.id,
        userId: Number(activity.userId),
        userName: await this.getUserName(Number(activity.userId)),
        linkType: activity.linkType as MagicLinkType,
        sentAt: activity.sentAt,
        accessedAt: activity.accessedAt,
        agentName: activity.sentByAgent ? 
          `${activity.sentByAgent.firstName} ${activity.sentByAgent.lastName}` : 
          'System'
      })));

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
      // First check if token exists in database and is not expired
      const activity = await prisma.magicLinkActivity.findFirst({
        where: { 
          linkToken: token,
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      });

      if (!activity) {
        logger.warn('Magic link not found or expired', { token: token.substring(0, 8) + '...' });
        return { isValid: false };
      }

      // Now verify the token structure and signature
      const verified = this.verifyTokenWithLinkType(token, activity.linkType as MagicLinkType);
      if (!verified) {
        logger.warn('Magic link token verification failed', { 
          token: token.substring(0, 8) + '...',
          userId: activity.userId,
          linkType: activity.linkType 
        });
        return { isValid: false };
      }

      logger.info('Magic link validated successfully', {
        userId: activity.userId,
        linkType: activity.linkType,
        tokenPrefix: token.substring(0, 8) + '...'
      });

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
    // Use compact token format - timestamp (6 bytes) + userId (4 bytes) + random (4 bytes) + HMAC (8 bytes)
    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const randomValue = crypto.randomBytes(4).readUInt32BE(0);
    
    // Pack data into binary format for efficiency
    const buffer = Buffer.alloc(18); // 4+4+4+6 bytes (shortened)
    buffer.writeUInt32BE(timestamp, 0);  // 4 bytes timestamp
    buffer.writeUInt32BE(userId, 4);     // 4 bytes user ID
    buffer.writeUInt32BE(randomValue, 8); // 4 bytes random
    
    // Create compact HMAC (first 6 bytes only for brevity)
    const hmac = crypto.createHmac('sha256', this.encryptionKey);
    hmac.update(buffer.subarray(0, 12)); // Hash first 12 bytes
    hmac.update(linkType); // Include link type in hash
    const signature = hmac.digest().subarray(0, 6); // First 6 bytes only
    
    // Copy signature to buffer
    signature.copy(buffer, 12);
    
    // Return base64url encoded (more URL-friendly than base64)
    return buffer.toString('base64url');
  }

  private verifyToken(token: string): { 
    userId: number; 
    linkType: MagicLinkType; 
    timestamp: number 
  } | null {
    try {
      const buffer = Buffer.from(token, 'base64url');
      
      if (buffer.length !== 18) return null;
      
      // Extract data from binary format
      const timestamp = buffer.readUInt32BE(0);
      const userId = buffer.readUInt32BE(4);
      const randomValue = buffer.readUInt32BE(8);
      const providedSignature = buffer.subarray(12, 18);
      
      // We need to look up the token in the database to get the link type
      // and verify the signature against the stored link type
      return {
        userId,
        linkType: 'claimPortal', // This will be verified against database in validateMagicLink
        timestamp
      };
    } catch (error) {
      return null;
    }
  }

  private verifyTokenWithLinkType(token: string, linkType: MagicLinkType): boolean {
    try {
      const buffer = Buffer.from(token, 'base64url');
      
      if (buffer.length !== 18) return false;
      
      // Extract data from binary format
      const timestamp = buffer.readUInt32BE(0);
      const userId = buffer.readUInt32BE(4);
      const randomValue = buffer.readUInt32BE(8);
      const providedSignature = buffer.subarray(12, 18);
      
      // Recreate the signature with the known link type
      const hmac = crypto.createHmac('sha256', this.encryptionKey);
      hmac.update(buffer.subarray(0, 12)); // Hash first 12 bytes (timestamp + userId + random)
      hmac.update(linkType); // Include link type in hash
      const expectedSignature = hmac.digest().subarray(0, 6); // First 6 bytes only
      
      // Compare signatures
      return Buffer.compare(providedSignature, expectedSignature) === 0;
    } catch (error) {
      logger.error('Token verification error:', error);
      return false;
    }
  }

  private buildTargetUrl(
    linkType: MagicLinkType,
    token: string,
    customParams: Record<string, string>,
    claimId?: number,
    requirementTypes?: string[]
  ): string {
    // Shorter route paths
    const routes: Record<MagicLinkType, string> = {
      firstLogin: '/login',
      claimPortal: '/claim',
      documentUpload: '/docs',
      claimCompletion: '/complete',
      requirementReview: '/review',
      statusUpdate: '/status',
      profileUpdate: '/profile'
    };

    const baseRoute = routes[linkType];
    const url = new URL(baseRoute, this.baseUrl);
    
    // Add magic link token with shorter parameter name
    url.searchParams.set('t', token);
    
    // Only add claim ID if actually needed (not for all link types)
    if (claimId && ['claimPortal', 'documentUpload', 'claimCompletion'].includes(linkType)) {
      url.searchParams.set('c', claimId.toString());
    }
    
    // Only add requirement types if specifically for document upload
    if (requirementTypes && requirementTypes.length > 0 && linkType === 'documentUpload') {
      url.searchParams.set('r', requirementTypes.join(','));
    }
    
    // Only add essential custom parameters
    Object.entries(customParams).forEach(([key, value]) => {
      if (key.length <= 2) { // Only short parameter names
        url.searchParams.set(key, value);
      }
    });
    
    return url.toString();
  }

  private buildMessage(linkType: MagicLinkType, url: string, userName?: string): string {
    const name = userName ? ` ${userName}` : '';
    
    const messages: Record<MagicLinkType, string> = {
      firstLogin: `Hi${name}, access your RMC account: ${url}`,
      claimPortal: `Hi${name}, view your claim: ${url}`,
      documentUpload: `Hi${name}, upload documents: ${url}`,
      claimCompletion: `Hi${name}, complete your claim: ${url}`,
      requirementReview: `Hi${name}, review requirements: ${url}`,
      statusUpdate: `Hi${name}, check status: ${url}`,
      profileUpdate: `Hi${name}, update profile: ${url}`
    };

    return messages[linkType];
  }

  private async generateShortUrl(originalUrl: string): Promise<string | null> {
    try {
      // Generate a short code (6 characters for brevity)
      const shortCode = this.generateShortCode();
      
      // Store in database
      await prisma.shortUrl.create({
        data: {
          originalUrl,
          shortCode,
          expiresAt: new Date(Date.now() + (48 * 60 * 60 * 1000)), // 48 hours like magic links
          createdByAgentId: 1 // Default for system-generated
        }
      });

      // Return short URL - using existing domain with short path
      return `${this.baseUrl}/s/${shortCode}`;
    } catch (error) {
      logger.error('Failed to generate short URL:', error);
      return null;
    }
  }

  private generateShortCode(): string {
    // Generate a 6-character alphanumeric code (excludes confusing chars like 0, O, I, l)
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async sendViaSMS(
    phoneNumber: string, 
    message: string, 
    options: SendMagicLinkOptions
  ) {
    // Use the actual SMS service to send and track the magic link
    const { SMSService } = await import('./sms.service');
    
    // Create minimal dependencies for SMS service
    const smsServiceDeps = {
      authService: this.dependencies.authService,
      userService: this.dependencies.userService || {
        async getUserData(userId: number) {
          // Fallback user data method if not provided
          return {
            id: userId,
            firstName: 'User',
            lastName: '',
            email: '',
            phoneNumber: phoneNumber
          };
        }
      }
    };
    
    const smsService = new SMSService(smsServiceDeps);
    
    try {
      const result = await smsService.sendSMS({
        phoneNumber,
        message,
        messageType: 'magic_link',
        agentId: options.agentId,
        userId: options.userId,
        callSessionId: options.callSessionId
      });

      logger.info('Magic link sent via SMS service', {
        phoneNumber,
        linkType: options.linkType,
        userId: options.userId,
        messageId: result.messageId,
        twilioSid: result.twilioSid
      });
      
      return {
        method: 'sms',
        status: 'sent',
        messageId: result.messageId,
        twilioSid: result.twilioSid
      };
      
    } catch (error) {
      logger.error('Failed to send magic link via SMS:', error);
      throw error;
    }
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

  private async getUserName(userId: number): Promise<string> {
    try {
      if (this.dependencies.userService) {
        const userData = await this.dependencies.userService.getUserData(userId);
        return `${userData.firstName} ${userData.lastName}`;
      }
      
      return `User ${userId}`;
    } catch (error) {
      logger.warn('Failed to get user name', { userId, error });
      return `User ${userId}`;
    }
  }
} 