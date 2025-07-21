import { NextRequest, NextResponse } from 'next/server';
import { enhanceMessage, MessageEnhancementOptions } from '@/lib/utils/openai';
import { z } from 'zod';

// Request validation schema
const enhanceMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(500, 'Message too long'),
  context: z.object({
    userName: z.string().optional(),
    userStatus: z.string().optional(), 
    claimType: z.string().optional(),
    isFollowUp: z.boolean().optional(),
    tone: z.enum(['professional', 'friendly', 'urgent', 'empathetic']).optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = enhanceMessageSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { message, context } = validation.data;

    // Enhance the message using OpenAI
    const result = await enhanceMessage({
      message,
      context
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Message enhancement error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to enhance message',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  const isConfigured = !!process.env.OPENAI_API_KEY;
  
  return NextResponse.json({
    status: 'ok',
    openaiConfigured: isConfigured,
    timestamp: new Date().toISOString()
  });
} 