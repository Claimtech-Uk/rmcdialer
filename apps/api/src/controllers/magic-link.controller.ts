import { Response } from 'express';
import { z } from 'zod';
import { magicLinkService } from '../services/magic-link.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types/auth.types';

// Validation schemas
const generateMagicLinkSchema = z.object({
  userId: z.number().positive(),
  linkType: z.enum(['firstLogin', 'claimPortal', 'documentUpload', 'claimCompletion', 'requirementReview', 'statusUpdate', 'profileUpdate']),
  deliveryMethod: z.enum(['sms', 'whatsapp', 'email']),
  claimId: z.number().positive().optional(),
  expiresInHours: z.number().min(1).max(168).optional(), // 1 hour to 1 week
  customParams: z.record(z.string(), z.string()).optional(),
  requirementTypes: z.array(z.string()).optional()
});

const sendMagicLinkSchema = generateMagicLinkSchema.extend({
  phoneNumber: z.string().optional(),
  email: z.string().email().optional(),
  userName: z.string().optional(),
  customMessage: z.string().optional()
}).refine(data => {
  // Require contact method based on delivery method
  if (data.deliveryMethod === 'email') {
    return !!data.email;
  }
  return !!data.phoneNumber;
}, {
  message: "Phone number required for SMS/WhatsApp delivery, email required for email delivery"
});

const trackAccessSchema = z.object({
  token: z.string().min(1),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional()
});

const analyticsQuerySchema = z.object({
  agentId: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  linkType: z.enum(['firstLogin', 'claimPortal', 'documentUpload', 'claimCompletion', 'requirementReview', 'statusUpdate', 'profileUpdate']).optional()
});

const historyQuerySchema = z.object({
  userId: z.number().positive(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  linkType: z.enum(['firstLogin', 'claimPortal', 'documentUpload', 'claimCompletion', 'requirementReview', 'statusUpdate', 'profileUpdate']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export class MagicLinkController {
  /**
   * POST /api/magic-links/generate
   * Generate a magic link without sending it
   */
  async generateMagicLink(req: AuthenticatedRequest, res: Response) {
    try {
      const validatedData = generateMagicLinkSchema.parse(req.body);
      
      const magicLink = await magicLinkService.generateMagicLink({
        ...validatedData,
        agentId: req.agent?.id,
        callSessionId: req.body?.callSessionId
      });

      logger.info('Magic link generated via API', {
        agentId: req.agent?.id,
        userId: validatedData.userId,
        linkType: validatedData.linkType,
        trackingId: magicLink.trackingId
      });

      res.json({
        success: true,
        data: {
          magicLink: {
            id: magicLink.id,
            url: magicLink.url,
            shortUrl: magicLink.shortUrl,
            token: magicLink.token,
            expiresAt: magicLink.expiresAt,
            trackingId: magicLink.trackingId
          }
        }
      });

    } catch (error) {
      logger.error('Failed to generate magic link via API:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to generate magic link'
        }
      });
    }
  }

  /**
   * POST /api/magic-links/send
   * Generate and send a magic link
   */
  async sendMagicLink(req: AuthenticatedRequest, res: Response) {
    try {
      const validatedData = sendMagicLinkSchema.parse(req.body);
      
      const result = await magicLinkService.sendMagicLink({
        ...validatedData,
        agentId: req.agent?.id,
        callSessionId: req.body?.callSessionId
      });

      logger.info('Magic link sent via API', {
        agentId: req.agent?.id,
        userId: validatedData.userId,
        linkType: validatedData.linkType,
        deliveryMethod: validatedData.deliveryMethod,
        trackingId: result.magicLink.trackingId
      });

      res.json({
        success: true,
        data: {
          magicLink: {
            id: result.magicLink.id,
            url: result.magicLink.url,
            shortUrl: result.magicLink.shortUrl,
            expiresAt: result.magicLink.expiresAt,
            trackingId: result.magicLink.trackingId
          },
          delivery: {
            method: validatedData.deliveryMethod,
            status: 'sent',
            details: result.deliveryResult
          }
        }
      });

    } catch (error) {
      logger.error('Failed to send magic link via API:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SEND_FAILED',
          message: 'Failed to send magic link'
        }
      });
    }
  }

  /**
   * POST /api/magic-links/track-access
   * Track when a magic link is accessed
   */
  async trackAccess(req: AuthenticatedRequest, res: Response) {
    try {
      const validatedData = trackAccessSchema.parse(req.body);
      
      const success = await magicLinkService.trackAccess(
        validatedData.token,
        validatedData.userAgent || req.get?.('User-Agent'),
        validatedData.ipAddress || req.ip
      );

      res.json({
        success: true,
        data: {
          tracked: success,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to track magic link access:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'TRACKING_FAILED',
          message: 'Failed to track magic link access'
        }
      });
    }
  }

  /**
   * POST /api/magic-links/validate
   * Validate a magic link token
   */
  async validateMagicLink(req: AuthenticatedRequest, res: Response) {
    try {
      const { token } = req.body || {};
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Token is required'
          }
        });
      }

      const validation = await magicLinkService.validateMagicLink(token);

      res.json({
        success: true,
        data: validation
      });

    } catch (error) {
      logger.error('Failed to validate magic link:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Failed to validate magic link'
        }
      });
    }
  }

  /**
   * GET /api/magic-links/history/:userId
   * Get magic link history for a specific user
   */
  async getUserHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = parseInt(req.params?.userId || '');
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID provided'
          }
        });
      }

      const query = historyQuerySchema.parse({
        userId,
        ...req.query,
        page: req.query?.page ? parseInt(req.query.page as string) : 1,
        limit: req.query?.limit ? parseInt(req.query.limit as string) : 20
      });

      const history = await magicLinkService.getUserMagicLinkHistory(userId, {
        page: query.page,
        limit: query.limit,
        linkType: query.linkType,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined
      });

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      logger.error('Failed to get user magic link history:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'HISTORY_FAILED',
          message: 'Failed to get magic link history'
        }
      });
    }
  }

  /**
   * GET /api/magic-links/analytics
   * Get magic link analytics and performance data
   */
  async getAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const query = analyticsQuerySchema.parse({
        ...req.query,
        agentId: req.query?.agentId ? parseInt(req.query.agentId as string) : undefined
      });

      const analytics = await magicLinkService.getAnalytics({
        agentId: query.agentId,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        linkType: query.linkType
      });

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Failed to get magic link analytics:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYTICS_FAILED',
          message: 'Failed to get magic link analytics'
        }
      });
    }
  }

  /**
   * GET /api/magic-links/recent
   * Get recent magic link activity
   */
  async getRecentActivity(req: AuthenticatedRequest, res: Response) {
    try {
      const limit = req.query?.limit ? Math.min(parseInt(req.query.limit as string), 50) : 20;
      const agentId = req.query?.agentId ? parseInt(req.query.agentId as string) : undefined;

      // Get recent activity from analytics
      const analytics = await magicLinkService.getAnalytics({
        agentId,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      });

      const recentActivity = analytics.recentActivity.slice(0, limit);

      res.json({
        success: true,
        data: {
          activities: recentActivity,
          total: analytics.totalSent,
          accessed: analytics.totalAccessed,
          accessRate: analytics.accessRate
        }
      });

    } catch (error) {
      logger.error('Failed to get recent magic link activity:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'RECENT_ACTIVITY_FAILED',
          message: 'Failed to get recent magic link activity'
        }
      });
    }
  }

  /**
   * POST /api/magic-links/bulk-send
   * Send magic links to multiple users
   */
  async bulkSendMagicLinks(req: AuthenticatedRequest, res: Response) {
    try {
      const { users, linkType, deliveryMethod, customMessage } = req.body || {};

      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USERS',
            message: 'Users array is required and must not be empty'
          }
        });
      }

      if (users.length > 100) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_USERS',
            message: 'Maximum 100 users allowed per bulk operation'
          }
        });
      }

      const results = [];
      const errors = [];

      for (const user of users) {
        try {
          const result = await magicLinkService.sendMagicLink({
            userId: user.userId,
            linkType,
            deliveryMethod,
            phoneNumber: user.phoneNumber,
            email: user.email,
            userName: user.userName,
            customMessage,
            agentId: req.agent?.id,
            claimId: user.claimId
          });

          results.push({
            userId: user.userId,
            success: true,
            trackingId: result.magicLink.trackingId
          });

        } catch (error) {
          errors.push({
            userId: user.userId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Bulk magic link send completed', {
        agentId: req.agent?.id,
        totalUsers: users.length,
        successful: results.length,
        failed: errors.length,
        linkType,
        deliveryMethod
      });

      res.json({
        success: true,
        data: {
          summary: {
            total: users.length,
            successful: results.length,
            failed: errors.length
          },
          results,
          errors
        }
      });

    } catch (error) {
      logger.error('Failed to bulk send magic links:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'BULK_SEND_FAILED',
          message: 'Failed to send magic links in bulk'
        }
      });
    }
  }
}

export const magicLinkController = new MagicLinkController(); 