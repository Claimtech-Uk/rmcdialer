import { Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/auth.utils';
import { AuthenticatedRequest } from '../types/auth.types';
import { prisma } from '../app';
import { logger } from '../app';

/**
 * Middleware to authenticate requests using JWT tokens
 */
export async function authenticateToken(
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        }
      });
      return;
    }
    
    // Verify the token
    const decoded = verifyAccessToken(token);
    
    // Get the agent from database to ensure they still exist and are active
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
    
    if (!agent) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: 'Agent not found'
        }
      });
      return;
    }
    
    if (!agent.isActive) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AGENT_INACTIVE',
          message: 'Agent account is inactive'
        }
      });
      return;
    }
    
    // Attach agent info to request
    req.agent = agent;
    
    logger.info('Authentication successful', {
      agentId: agent.id,
      email: agent.email,
      route: req.path || req.url
    });
    
    next();
    
  } catch (error) {
    logger.warn('Authentication failed:', {
      error: error instanceof Error ? error.message : error,
      route: req.path || req.url,
      ip: req.ip || req.socket.remoteAddress
    });
    
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired access token'
      }
    });
  }
}

/**
 * Middleware to require specific roles
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.agent) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }
    
    if (!allowedRoles.includes(req.agent.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this action'
        }
      });
      return;
    }
    
    next();
  };
}

/**
 * Middleware for optional authentication (doesn't fail if no token)
 */
export async function optionalAuth(
  req: AuthenticatedRequest, 
  _res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      next();
      return;
    }
    
    // Verify the token
    const decoded = verifyAccessToken(token);
    
    // Get the agent from database
    const agent = await prisma.agent.findUnique({
      where: { id: decoded.agentId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });
    
    if (agent) {
      req.agent = agent;
    }
    
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    logger.debug('Optional auth failed:', error);
  }
  
  next();
} 