import { Router } from 'express';
import { magicLinkController } from '../controllers/magic-link.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all magic link routes
router.use(authenticateToken);

/**
 * POST /api/magic-links/generate
 * Generate a magic link without sending it
 * Body: { userId, linkType, deliveryMethod, claimId?, expiresInHours?, customParams?, requirementTypes? }
 */
router.post('/generate', magicLinkController.generateMagicLink.bind(magicLinkController));

/**
 * POST /api/magic-links/send
 * Generate and send a magic link via SMS/WhatsApp/Email
 * Body: { userId, linkType, deliveryMethod, phoneNumber?, email?, userName?, customMessage?, claimId?, expiresInHours?, customParams?, requirementTypes? }
 */
router.post('/send', magicLinkController.sendMagicLink.bind(magicLinkController));

/**
 * POST /api/magic-links/track-access
 * Track when a magic link is accessed (called by main claims app)
 * Body: { token, userAgent?, ipAddress? }
 */
router.post('/track-access', magicLinkController.trackAccess.bind(magicLinkController));

/**
 * POST /api/magic-links/validate
 * Validate a magic link token and get its details
 * Body: { token }
 */
router.post('/validate', magicLinkController.validateMagicLink.bind(magicLinkController));

/**
 * GET /api/magic-links/history/:userId
 * Get magic link history for a specific user
 * Query params: page?, limit?, linkType?, startDate?, endDate?
 */
router.get('/history/:userId', magicLinkController.getUserHistory.bind(magicLinkController));

/**
 * GET /api/magic-links/analytics
 * Get magic link analytics and performance data
 * Query params: agentId?, startDate?, endDate?, linkType?
 */
router.get('/analytics', magicLinkController.getAnalytics.bind(magicLinkController));

/**
 * GET /api/magic-links/recent
 * Get recent magic link activity
 * Query params: limit?, agentId?
 */
router.get('/recent', magicLinkController.getRecentActivity.bind(magicLinkController));

/**
 * POST /api/magic-links/bulk-send
 * Send magic links to multiple users at once
 * Body: { users: [{ userId, phoneNumber?, email?, userName?, claimId? }], linkType, deliveryMethod, customMessage? }
 */
router.post('/bulk-send', magicLinkController.bulkSendMagicLinks.bind(magicLinkController));

export default router; 