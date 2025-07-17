import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  sendSMS,
  handleIncomingSMS,
  handleSMSStatus,
  getConversations,
  getConversation,
  assignConversation,
  closeConversation,
  sendMagicLink,
  getSMSStats,
  getConversationsNeedingAttention
} from '../controllers/sms.controller';

const router = Router();

/**
 * SMS Management Routes
 */

// Public webhook endpoints (no authentication required)
// POST /api/sms/webhook/incoming - Handle incoming SMS from Twilio
router.post('/webhook/incoming', handleIncomingSMS);

// POST /api/sms/webhook/status - Handle SMS delivery status updates from Twilio
router.post('/webhook/status', handleSMSStatus);

// All other SMS routes require authentication
router.use(authenticateToken);

// POST /api/sms/send - Send SMS message
router.post('/send', sendSMS);

// POST /api/sms/magic-link - Send magic link via SMS
router.post('/magic-link', sendMagicLink);

// GET /api/sms/conversations - Get SMS conversations with filtering and pagination
router.get('/conversations', getConversations);

// GET /api/sms/conversations/attention - Get conversations requiring agent attention
router.get('/conversations/attention', getConversationsNeedingAttention);

// GET /api/sms/conversations/:conversationId - Get specific SMS conversation with message history
router.get('/conversations/:conversationId', getConversation);

// POST /api/sms/conversations/:conversationId/assign - Assign SMS conversation to agent
router.post('/conversations/:conversationId/assign', assignConversation);

// POST /api/sms/conversations/:conversationId/close - Close SMS conversation
router.post('/conversations/:conversationId/close', closeConversation);

// GET /api/sms/stats - Get SMS statistics
router.get('/stats', getSMSStats);

export default router; 