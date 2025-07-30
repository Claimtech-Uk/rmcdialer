import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    console.log(`📊 CALLBACK MONITORING - Last ${hours} hours`);
    
    // Get recent inbound call stats
    const inboundStats = await prisma.callSession.findMany({
      where: {
        direction: 'inbound',
        startedAt: { gte: since }
      },
      select: {
        id: true,
        startedAt: true,
        status: true,
        lastOutcomeType: true,
        callbackScheduled: true,
        twilioCallSid: true,
        durationSeconds: true,
        agent: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { startedAt: 'desc' }
    });
    
    // Get callback creation stats
    const callbackStats = await prisma.callback.findMany({
      where: {
        createdAt: { gte: since }
      },
      select: {
        id: true,
        createdAt: true,
        status: true,
        scheduledFor: true,
        callbackReason: true,
        originalCallSessionId: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Calculate health metrics
    const totalInbound = inboundStats.length;
    const inboundWithOutcomes = inboundStats.filter(s => s.lastOutcomeType && s.lastOutcomeType !== 'none').length;
    const inboundWithCallbacks = inboundStats.filter(s => s.callbackScheduled).length;
    const totalCallbacks = callbackStats.length;
    
    // Identify problematic sessions (completed but no outcome)
    const problematicSessions = inboundStats.filter(s => 
      s.status === 'completed' && 
      (!s.lastOutcomeType || s.lastOutcomeType === 'none') &&
      s.durationSeconds && s.durationSeconds > 5 // Had some duration
    );
    
    // Session/callback matching analysis
    const sessionIds = inboundStats.map(s => s.id);
    const matchedCallbacks = callbackStats.filter(c => 
      sessionIds.includes(c.originalCallSessionId)
    );
    
    const healthScore = totalInbound > 0 ? 
      Math.round(((inboundWithOutcomes / totalInbound) * 100)) : 100;
    
    const callbackConversionRate = inboundWithCallbacks > 0 ? 
      Math.round(((totalCallbacks / inboundWithCallbacks) * 100)) : 0;
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      period: `Last ${hours} hours`,
      healthMetrics: {
        healthScore: `${healthScore}%`,
        callbackConversionRate: `${callbackConversionRate}%`,
        totalInboundCalls: totalInbound,
        inboundWithOutcomes: inboundWithOutcomes,
        inboundWithCallbacksScheduled: inboundWithCallbacks,
        totalCallbacksCreated: totalCallbacks,
        matchedCallbacks: matchedCallbacks.length,
        problematicSessions: problematicSessions.length
      },
      recentInboundCalls: inboundStats.slice(0, 10).map(s => ({
        id: s.id.slice(0, 8) + '...',
        timestamp: s.startedAt.toISOString(),
        status: s.status,
        outcome: s.lastOutcomeType || 'none',
        callbackScheduled: s.callbackScheduled,
        duration: s.durationSeconds || 0,
        callSid: s.twilioCallSid?.slice(0, 8) + '...' || 'none',
        agent: s.agent ? `${s.agent.firstName} ${s.agent.lastName}` : 'Unknown',
        isProblematic: s.status === 'completed' && 
                      (!s.lastOutcomeType || s.lastOutcomeType === 'none') &&
                      s.durationSeconds && s.durationSeconds > 5
      })),
      recentCallbacks: callbackStats.slice(0, 10).map(c => ({
        id: c.id.slice(0, 8) + '...',
        created: c.createdAt.toISOString(),
        scheduledFor: c.scheduledFor.toISOString(),
        status: c.status,
        reason: c.callbackReason || 'No reason',
        sessionId: c.originalCallSessionId.slice(0, 8) + '...'
      })),
      alerts: [
        ...(healthScore < 80 ? [{
          level: 'warning',
          message: `Health score is low (${healthScore}%) - many inbound calls have no outcomes set`
        }] : []),
        ...(problematicSessions.length > 0 ? [{
          level: 'error', 
          message: `${problematicSessions.length} completed calls have no outcomes - agents may not be setting dispositions`
        }] : []),
        ...(callbackConversionRate < 50 && inboundWithCallbacks > 0 ? [{
          level: 'warning',
          message: `Low callback conversion rate (${callbackConversionRate}%) - callbacks scheduled but not created in database`
        }] : [])
      ]
    });
    
  } catch (error) {
    console.error('❌ Callback monitoring failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 