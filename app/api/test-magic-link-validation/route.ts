import { NextRequest, NextResponse } from 'next/server';
import { MagicLinkService } from '@/modules/communications/services/magic-link.service';
import { logger } from '@/modules/core';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token parameter required' }, { status: 400 });
  }

  try {
    // Create magic link service
    const magicLinkService = new MagicLinkService({
      authService: null as any,
      userService: null as any
    });

    // Test validation
    const result = await magicLinkService.validateMagicLink(token);
    
    logger.info('Magic link validation test', {
      token: token.substring(0, 8) + '...',
      result
    });

    return NextResponse.json({
      success: true,
      token: token.substring(0, 8) + '...',
      validation: result,
      message: result.isValid ? 'Token is valid' : 'Token is invalid'
    });

  } catch (error) {
    logger.error('Magic link validation test failed:', error);
    return NextResponse.json({ 
      error: 'Validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 