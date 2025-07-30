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
    
    // Direct database query - try original Call SID first
    let session = await prisma.callSession.findFirst({
      where: { 
        twilioCallSid: callSid 
      },
      select: {
        id: true,
        userId: true,
        userClaimsContext: true,
        status: true,
        direction: true,
        startedAt: true,
        connectedAt: true,
        endedAt: true,
        durationSeconds: true,
        twilioCallSid: true
      }
    });
    
    // If not found, this might be an agent call leg SID - try mapping logic
    if (!session) {
      console.log('🔍 Session not found for CallSid:', callSid, '- trying agent call leg mapping...');
      
      // Look for recent inbound sessions (last 5 minutes) that might match this agent call leg
      const recentInboundSessions = await prisma.callSession.findMany({
        where: {
          direction: 'inbound',
          status: { in: ['ringing', 'initiated', 'connecting', 'connected'] },
          startedAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        },
        select: {
          id: true,
          userId: true,
          userClaimsContext: true,
          status: true,
          direction: true,
          startedAt: true,
          connectedAt: true,
          endedAt: true,
          durationSeconds: true,
          twilioCallSid: true
        },
        orderBy: { startedAt: 'desc' }
      });

      if (recentInboundSessions.length > 0) {
        console.log(`✅ Found ${recentInboundSessions.length} recent inbound sessions, using most recent for agent SID: ${callSid}`);
        session = recentInboundSessions[0];
        console.log(`🔗 Mapped agent CallSid ${callSid} to original session ${session.id} (original SID: ${session.twilioCallSid})`);
      }
    }
    
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