import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  initiateCall,
  updateCallStatus,
  recordCallOutcome,
  endCall,
  getCallHistory,
  getActiveCalls,
  getCallStats,
  getCallSession
} from '../controllers/call.controller';

const router = Router();

// All call routes require authentication
router.use(authenticateToken);

/**
 * Call Session Management Routes
 */

// POST /api/calls - Initiate a new call session
router.post('/', initiateCall);

// PUT /api/calls/:sessionId/status - Update call session status
router.put('/:sessionId/status', updateCallStatus);

// POST /api/calls/:sessionId/outcome - Record call outcome and disposition
router.post('/:sessionId/outcome', recordCallOutcome);

// POST /api/calls/:sessionId/end - End call session without specific outcome
router.post('/:sessionId/end', endCall);

// GET /api/calls/history - Get call history with filtering and pagination
router.get('/history', getCallHistory);

// GET /api/calls/active - Get agent's active calls
router.get('/active', getActiveCalls);

// GET /api/calls/stats - Get call statistics
router.get('/stats', getCallStats);

// GET /api/calls/:sessionId - Get specific call session details
router.get('/:sessionId', getCallSession);

export default router; 