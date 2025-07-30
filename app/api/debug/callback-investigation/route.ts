import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 INVESTIGATING INBOUND CALL CALLBACK ISSUES');
    
    // Check recent call sessions (last 24 hours)
    const recentSessions = await prisma.callSession.findMany({
      where: {
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        agent: {
          select: { firstName: true, lastName: true }
        },
        callOutcomes: true
      },
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    // Check recent callbacks
    const recentCallbacks = await prisma.callback.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        preferredAgent: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Check for inbound sessions without callbacks
    const inboundSessionsWithCallbacks = await prisma.callSession.findMany({
      where: {
        direction: 'inbound',
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        lastOutcomeType: 'call_back',
        callbackScheduled: true
      },
      include: {
        agent: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    // Check if callbacks exist for these sessions
    let matchingCallbacks: any[] = [];
    if (inboundSessionsWithCallbacks.length > 0) {
      const sessionIds = inboundSessionsWithCallbacks.map(s => s.id);
      matchingCallbacks = await prisma.callback.findMany({
        where: {
          originalCallSessionId: {
            in: sessionIds
          }
        }
      });
    }

    const analysis = {
      summary: {
        totalRecentSessions: recentSessions.length,
        inboundSessions: recentSessions.filter(s => s.direction === 'inbound').length,
        sessionsWithOutcomes: recentSessions.filter(s => s.lastOutcomeType).length,
        sessionsWithCallbacksScheduled: recentSessions.filter(s => s.callbackScheduled).length,
        totalCallbacksCreated: recentCallbacks.length,
        inboundSessionsMarkedForCallback: inboundSessionsWithCallbacks.length,
        matchingCallbackRecords: matchingCallbacks.length,
        missingCallbacks: inboundSessionsWithCallbacks.length - matchingCallbacks.length
      },
      recentSessions: recentSessions.map(session => ({
        id: session.id.slice(0, 8) + '...',
        direction: session.direction,
        status: session.status,
        agent: session.agent ? `${session.agent.firstName} ${session.agent.lastName}` : 'Unknown',
        startedAt: session.startedAt.toISOString(),
        durationSeconds: session.durationSeconds || 0,
        lastOutcomeType: session.lastOutcomeType || 'none',
        callbackScheduled: session.callbackScheduled,
        outcomesCount: session.callOutcomes.length
      })),
      recentCallbacks: recentCallbacks.map(callback => ({
        id: callback.id.slice(0, 8) + '...',
        userId: callback.userId.toString(),
        status: callback.status,
        scheduledFor: callback.scheduledFor.toISOString(),
        reason: callback.callbackReason || 'No reason specified',
        preferredAgent: callback.preferredAgent ? `${callback.preferredAgent.firstName} ${callback.preferredAgent.lastName}` : 'None',
        originalSessionId: callback.originalCallSessionId.slice(0, 8) + '...'
      })),
      inboundSessionsMarkedForCallback: inboundSessionsWithCallbacks.map(session => ({
        id: session.id.slice(0, 8) + '...',
        agent: session.agent ? `${session.agent.firstName} ${session.agent.lastName}` : 'Unknown',
        startedAt: session.startedAt.toISOString(),
        hasMatchingCallback: matchingCallbacks.some(cb => cb.originalCallSessionId === session.id)
      }))
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      analysis
    });

  } catch (error) {
    console.error('❌ Database investigation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 