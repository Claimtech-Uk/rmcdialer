import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    
    console.log(`🔍 Debugging call session: ${sessionId}`);
    
    // Check if session exists in PostgreSQL
    const callSession = await prisma.callSession.findUnique({
      where: { id: sessionId },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        callOutcomes: true
      }
    });
    
    if (!callSession) {
      return NextResponse.json({
        success: false,
        error: 'Call session not found',
        sessionId,
        details: {
          searchedIn: 'PostgreSQL CallSession table',
          found: false
        }
      });
    }
    
    // Get user context from MySQL replica
    let userContext = null;
    try {
      const user = await replicaDb.user.findUnique({
        where: { id: callSession.userId },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          email_address: true
        }
      });
      
      if (user) {
        userContext = {
          id: Number(user.id),
          firstName: user.first_name,
          lastName: user.last_name,
          phoneNumber: user.phone_number,
          email: user.email_address
        };
      }
    } catch (error) {
      console.error('Failed to get user context:', error);
    }
    
    return NextResponse.json({
      success: true,
      sessionId,
      callSession: {
        id: callSession.id,
        userId: Number(callSession.userId),
        agentId: callSession.agentId,
        status: callSession.status,
        direction: callSession.direction,
        startedAt: callSession.startedAt,
        connectedAt: callSession.connectedAt,
        endedAt: callSession.endedAt,
        twilioCallSid: callSession.twilioCallSid,
        agent: callSession.agent
      },
      userContext,
      outcomeCount: callSession.callOutcomes.length,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('❌ Debug call session failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Debug failed',
      details: error.message,
      timestamp: new Date()
    }, { status: 500 });
  }
} 