// AI-specific magic link generator that follows the same logic as the main magic link service
// This ensures consistency and proper tracking for AI-generated portal links

import crypto from 'crypto';
import { logger } from '@/modules/core';

export interface AIGeneratedMagicLink {
  url: string;
  token: string;
  userId: number;
  linkType: 'claimPortal';
  expiresAt: Date;
  trackingId: string;
}

/**
 * Generate a magic link specifically for AI agent responses
 * Follows the exact same logic as the main MagicLinkService
 */
export function generateAIMagicLink(userId: number): AIGeneratedMagicLink {
  try {
    // Use same token generation logic as MagicLinkService
    const token = Buffer.from(userId.toString()).toString('base64');
    
    // Generate tracking ID for logging/analytics
    const trackingId = crypto.randomUUID();
    
    // Use same expiry logic (48 hours default)
    const expiresAt = new Date(Date.now() + (48 * 60 * 60 * 1000));
    
    // Use same URL building logic as MagicLinkService
    const baseUrl = process.env.MAIN_APP_URL || 'https://claim.resolvemyclaim.co.uk';
    const url = new URL('/claims', baseUrl);
    url.searchParams.set('mlid', token);
    
    const result: AIGeneratedMagicLink = {
      url: url.toString(),
      token,
      userId,
      linkType: 'claimPortal',
      expiresAt,
      trackingId
    };

    logger.info('AI Magic link generated', {
      trackingId,
      userId,
      linkType: 'claimPortal',
      expiresAt,
      urlPreview: url.toString().substring(0, 50) + '...'
    });

    return result;

  } catch (error) {
    logger.error('Failed to generate AI magic link:', error);
    throw new Error('Failed to generate AI magic link');
  }
}

/**
 * Format the magic link URL for SMS display (removes https:// prefix)
 * Follows the same formatting logic as MagicLinkService.buildMessage()
 */
export function formatMagicLinkForSMS(url: string): string {
  // Remove https:// prefix for cleaner SMS messages (same as MagicLinkService)
  return url.replace(/^https?:\/\//, '');
}

/**
 * Validate that a magic link token follows the expected format
 */
export function validateMagicLinkToken(token: string): { isValid: boolean; userId?: number } {
  try {
    // Same validation logic as MagicLinkService.verifyToken()
    const userIdString = Buffer.from(token, 'base64').toString();
    const userId = parseInt(userIdString);
    
    if (isNaN(userId) || userId <= 0) {
      return { isValid: false };
    }
    
    return { isValid: true, userId };
  } catch (error) {
    return { isValid: false };
  }
}

/**
 * Extract user ID from a magic link URL
 */
export function extractUserIdFromMagicLink(url: string): number | null {
  try {
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('mlid');
    
    if (!token) return null;
    
    const validation = validateMagicLinkToken(token);
    return validation.isValid ? validation.userId! : null;
  } catch (error) {
    return null;
  }
}
