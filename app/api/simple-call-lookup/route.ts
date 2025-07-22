import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { callSid } = await request.json();
    
    console.log('🔍 Simple lookup for Call SID:', callSid);
    
    // Basic validation
    if (!callSid || typeof callSid !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Call SID required' },
        { status: 400 }
      );
    }
    
    // Direct database query - no complex validation
    const session = await prisma.callSession.findFirst({
      where: { 
        twilioCallSid: callSid 
      },
      select: {
        id: true,
        userId: true,
        userClaimsContext: true,
        status: true,
        direction: true,
        startedAt: true
      }
    });
    
    if (!session) {
      console.log('❓ No session found for Call SID:', callSid);
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }
    
    console.log('✅ Found session:', session.id);
    
    // Return simple response
    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        userId: session.userId ? Number(session.userId) : null,
        userClaimsContext: session.userClaimsContext,
        status: session.status,
        direction: session.direction,
        startedAt: session.startedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Simple lookup error:', error);
    return NextResponse.json(
      { success: false, error: 'Database error' },
      { status: 500 }
    );
  }
} 