import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getQueue,
  refreshQueue,
  assignCall,
  getQueueStats,
  releaseCall,
  getMyAssignedCalls
} from '../controllers/queue.controller';

const router = Router();

// All queue routes require authentication
router.use(authenticateToken);

/**
 * Queue Management Routes
 */

// GET /api/queue - Get current call queue with pagination and filtering
router.get('/', getQueue);

// GET /api/queue/stats - Get queue statistics and metrics
router.get('/stats', getQueueStats);

// GET /api/queue/my-calls - Get calls assigned to the current agent
router.get('/my-calls', getMyAssignedCalls);

// POST /api/queue/refresh - Refresh queue priorities (supervisors/admins only)
router.post('/refresh', refreshQueue);

// POST /api/queue/:queueId/assign - Assign a call to the current agent
router.post('/:queueId/assign', assignCall);

// POST /api/queue/:queueId/release - Release a call back to the queue
router.post('/:queueId/release', releaseCall);

export default router; 