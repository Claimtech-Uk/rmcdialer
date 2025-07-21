import { NextRequest, NextResponse } from 'next/server';
import { MagicLinkService } from '@/modules/communications/services/magic-link.service';
import { z } from 'zod';

// Request validation schema
const validateMagicLinkSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, userAgent } = validateMagicLinkSchema.parse(body);
    
    // Get IP address from request
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Create minimal service dependencies for magic link validation
    const dependencies = {
      authService: {
        async getCurrentAgent() {
          // Return a default agent for magic link validation
          // This isn't used in validation, only for logging
          return { id: 0, role: 'system' };
        }
      },
      userService: {
        async getUserData(userId: number) {
          // This would typically fetch user data
          // For magic link validation, we mainly need the basic structure
          return {
            id: userId,
            firstName: 'User',
            lastName: '',
            email: '',
            phoneNumber: ''
          };
        }
      }
    };

    const magicLinkService = new MagicLinkService(dependencies);

    // Validate the magic link
    const validation = await magicLinkService.validateMagicLink(token);
    
    if (validation.isValid) {
      // Track the access
      try {
        await magicLinkService.trackAccess(
          token,
          userAgent || 'unknown',
          ipAddress
        );
      } catch (trackingError) {
        // Log tracking error but don't fail the validation
        console.error('Failed to track magic link access:', trackingError);
      }
    }

    return NextResponse.json({
      success: true,
      data: validation
    });

  } catch (error) {
    console.error('Magic link validation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to validate magic link' },
      { status: 500 }
    );
  }
} 