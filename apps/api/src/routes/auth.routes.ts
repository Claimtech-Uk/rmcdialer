import { Router, Response } from 'express';
import { z } from 'zod';
import { verifyPassword, generateTokenPair, verifyRefreshToken } from '../utils/auth.utils';
import { authenticateToken } from '../middleware/auth.middleware';
import { AuthenticatedRequest, LoginRequest, RefreshTokenRequest } from '../types/auth.types';
import { prisma } from '../app';
import { logger } from '../app';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

/**
 * POST /api/auth/login
 * Authenticate agent with email and password
 */
router.post('/login', async (req, res: Response) => {
  try {
    // Validate request body
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validation.error.errors
        }
      });
    }

    const { email, password }: LoginRequest = validation.data;

    // Find agent by email
    const agent = await prisma.agent.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    if (!agent) {
      logger.warn('Login attempt with non-existent email', { email });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    if (!agent.isActive) {
      logger.warn('Login attempt with inactive account', { 
        email, 
        agentId: agent.id 
      });
      return res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Your account is inactive. Please contact an administrator.'
        }
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, agent.passwordHash);
    if (!isValidPassword) {
      logger.warn('Login attempt with invalid password', { 
        email, 
        agentId: agent.id 
      });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Generate tokens
    const tokens = generateTokenPair(agent.id, agent.email, agent.role);

    logger.info('Agent logged in successfully', {
      agentId: agent.id,
      email: agent.email,
      role: agent.role
    });

    res.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          email: agent.email,
          firstName: agent.firstName,
          lastName: agent.lastName,
          role: agent.role,
          isActive: agent.isActive
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login'
      }
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res: Response) => {
  try {
    const validation = refreshTokenSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validation.error.errors
        }
      });
    }

    const { refreshToken }: RefreshTokenRequest = validation.data;

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get agent to ensure they still exist and are active
    const agent = await prisma.agent.findUnique({
      where: { id: decoded.agentId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    if (!agent || !agent.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token'
        }
      });
    }

    // Generate new tokens
    const tokens = generateTokenPair(agent.id, agent.email, agent.role);

    logger.info('Tokens refreshed successfully', {
      agentId: agent.id,
      email: agent.email
    });

    res.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          email: agent.email,
          firstName: agent.firstName,
          lastName: agent.lastName,
          role: agent.role,
          isActive: agent.isActive
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

  } catch (error) {
    logger.warn('Token refresh failed:', {
      error: error instanceof Error ? error.message : error
    });
    
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token'
      }
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated agent profile
 */
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.agent) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    // Get full agent profile
    const agent = await prisma.agent.findUnique({
      where: { id: req.agent.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isAiAgent: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: 'Agent not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        agent
      }
    });

  } catch (error) {
    logger.error('Error fetching agent profile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching profile'
      }
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (currently just a placeholder - tokens are stateless)
 */
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.agent) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    logger.info('Agent logged out', {
      agentId: req.agent.id,
      email: req.agent.email
    });

    res.json({
      success: true,
      data: {
        message: 'Logged out successfully'
      }
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during logout'
      }
    });
  }
});

export default router; 