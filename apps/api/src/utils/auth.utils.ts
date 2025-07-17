import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/auth.types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-fallback-refresh-secret-change-in-production';

// Access token expires in 1 hour
const ACCESS_TOKEN_EXPIRY = '1h';
// Refresh token expires in 7 days  
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate an access token
 */
export function generateAccessToken(agentId: number, email: string, role: string): string {
  const payload: JwtPayload = {
    agentId,
    email,
    role,
    type: 'access'
  };
  
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'dialler-api',
    audience: 'dialler-app'
  });
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(agentId: number, email: string, role: string): string {
  const payload: JwtPayload = {
    agentId,
    email,
    role,
    type: 'refresh'
  };
  
  return jwt.sign(payload, JWT_REFRESH_SECRET, { 
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'dialler-api',
    audience: 'dialler-app'
  });
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'dialler-api',
      audience: 'dialler-app'
    }) as JwtPayload;
    
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'dialler-api',
      audience: 'dialler-app'
    }) as JwtPayload;
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(agentId: number, email: string, role: string) {
  return {
    accessToken: generateAccessToken(agentId, email, role),
    refreshToken: generateRefreshToken(agentId, email, role)
  };
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
} 