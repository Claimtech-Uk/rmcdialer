import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/modules/core';

export async function GET(
  request: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  const { shortCode } = params;

  try {
    // Find the short URL in database
    const shortUrl = await prisma.shortUrl.findFirst({
      where: {
        shortCode,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    if (!shortUrl) {
      logger.warn('Short URL not found or expired', { shortCode });
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Update access count and last accessed
    await prisma.shortUrl.update({
      where: { id: shortUrl.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date()
      }
    });

    logger.info('Short URL accessed', {
      shortCode,
      originalUrl: shortUrl.originalUrl,
      accessCount: shortUrl.accessCount + 1
    });

    // Redirect to original URL
    return NextResponse.redirect(shortUrl.originalUrl);

  } catch (error) {
    logger.error('Error handling short URL redirect:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
} 