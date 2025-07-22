import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug: Analyzing inbound call flow...');

    // 1. Check agent records and sessions
    const agents = await prisma.agent.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        createdAt: true
      }
    });

    const agentSessions = await prisma.agentSession.findMany({
      where: {
        agent: { isActive: true },
        loginAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true
          }
        }
      },
      orderBy: { loginAt: 'desc' }
    });

    // 2. Find available agents (using same logic as inbound call handler)
    const availableAgents = await prisma.agentSession.findMany({
      where: {
        status: 'available',
        logoutAt: null,
        agent: {
          isActive: true
        }
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true
          }
        }
      },
      orderBy: {
        lastActivity: 'asc'
      }
    });

    // 3. Check recent call sessions for patterns
    const recentCallSessions = await prisma.callSession.findMany({
      where: {
        direction: 'inbound',
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    // 4. Analyze agent session states
    const sessionAnalysis = agentSessions.map(session => {
      const isCurrentlyAvailable = session.status === 'available' && !session.logoutAt;
      const expectedTwilioIdentity = `agent_${session.agentId}`;
      
      return {
        sessionId: session.id,
        agentId: session.agentId,
        agentName: `${session.agent.firstName} ${session.agent.lastName}`,
        email: session.agent.email,
        status: session.status,
        isCurrentlyAvailable,
        expectedTwilioIdentity,
        loginAt: session.loginAt,
        logoutAt: session.logoutAt,
        lastActivity: session.lastActivity,
        currentCallSessionId: session.currentCallSessionId,
        callsCompletedToday: session.callsCompletedToday
      };
    });

    // 5. Call session outcome analysis
    const callOutcomes = recentCallSessions.reduce((acc, call) => {
      const outcome = call.status || 'unknown';
      acc[outcome] = (acc[outcome] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 6. Generate diagnostic summary
    const diagnostic = {
      timestamp: new Date().toISOString(),
      
      // Agent availability summary
      agentAvailability: {
        totalActiveAgents: agents.length,
        totalSessionsLast24h: agentSessions.length,
        currentlyAvailableAgents: availableAgents.length,
        availableAgentsList: availableAgents.map(a => ({
          id: a.agentId,
          name: `${a.agent.firstName} ${a.agent.lastName}`,
          email: a.agent.email,
          expectedTwilioClient: `agent_${a.agentId}`,
          lastActivity: a.lastActivity
        }))
      },

      // Call flow analysis
      inboundCallAnalysis: {
        totalInboundCallsLast24h: recentCallSessions.length,
        callOutcomes,
        missedCallRate: recentCallSessions.length > 0 ? 
          ((callOutcomes['missed_call'] || 0) / recentCallSessions.length * 100).toFixed(1) + '%' : 'N/A',
        connectedCallRate: recentCallSessions.length > 0 ? 
          ((callOutcomes['connected'] || 0) / recentCallSessions.length * 100).toFixed(1) + '%' : 'N/A'
      },

      // Detailed session breakdown
      agentSessionBreakdown: sessionAnalysis,

      // Recent call attempts
      recentInboundCalls: recentCallSessions.map(call => ({
        id: call.id,
        twilioCallSid: call.twilioCallSid,
        status: call.status,
        direction: call.direction,
        startedAt: call.startedAt,
        connectedAt: call.connectedAt,
        endedAt: call.endedAt,
        assignedAgent: call.agent ? {
          id: call.agent.id,
          name: `${call.agent.firstName} ${call.agent.lastName}`,
          expectedTwilioClient: `agent_${call.agent.id}`
        } : null,
        userClaimsContext: call.userClaimsContext
      })),

      // System health checks
      systemHealth: {
        databaseConnection: 'OK',
        agentTableIntegrity: agents.length > 0 ? 'OK' : 'NO_AGENTS',
        sessionTableIntegrity: agentSessions.length > 0 ? 'OK' : 'NO_SESSIONS'
      },

      // Troubleshooting steps
      troubleshootingSteps: {
        noAvailableAgents: availableAgents.length === 0 ? [
          '1. Check if agents are logged into the system',
          '2. Verify agent status is set to "available"',
          '3. Ensure agents haven\'t been automatically logged out',
          '4. Check if agent records are marked as isActive: true'
        ] : null,
        
        agentsAvailableButCallsFailing: availableAgents.length > 0 && callOutcomes['missed_call'] > 0 ? [
          '1. Check if agents have registered their Twilio devices',
          '2. Verify Twilio client identity format matches agent_{agentId}',
          '3. Ensure agent browsers are open and devices are online',
          '4. Check for Twilio connectivity issues',
          '5. Verify access tokens are being generated correctly'
        ] : null,

        nextSteps: [
          '1. Have agents check browser console for Twilio device status',
          '2. Test with a direct call to verify Twilio client registration',
          '3. Check Twilio dashboard for failed dial attempts',
          '4. Monitor webhook logs for detailed error messages'
        ]
      }
    };

    console.log('📊 Inbound call flow diagnostic completed');

    return NextResponse.json({
      success: true,
      diagnostic,
      recommendations: {
        immediate: availableAgents.length === 0 ? 
          'No agents available - have agents log in and ensure status is "available"' :
          'Agents available but calls may be failing at Twilio device level - check device registration',
        
        monitoring: [
          'Set up alerts when no agents are available',
          'Monitor inbound call success rates',
          'Track agent session timeouts',
          'Monitor Twilio device registration status'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze inbound call flow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 