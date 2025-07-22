import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    console.log('🔍 Debug: Checking agent device registration status...');
    
    // Get all active agent sessions
    const agentSessions = await prisma.agentSession.findMany({
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
        lastActivity: 'desc'
      }
    });

    console.log(`📊 Found ${agentSessions.length} available agent sessions`);

    const deviceStatus = agentSessions.map(session => {
      const expectedClientName = `agent_${session.agentId}`;
      
      return {
        agentSessionId: session.id,
        agentId: session.agentId,
        agentName: `${session.agent.firstName} ${session.agent.lastName}`,
        email: session.agent.email,
        status: session.status,
        expectedTwilioClientIdentity: expectedClientName,
        loginAt: session.loginAt,
        lastActivity: session.lastActivity,
        deviceRegistrationNotes: [
          'Device should be registered with Twilio as Client identity',
          'Device should be online and listening for incoming calls',
          'Check browser console for Twilio Device connection status',
          'Verify ACCESS_TOKEN is correctly generated for this agent'
        ]
      };
    });

    // Also check for any potential agent ID mismatches
    const allAgents = await prisma.agent.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    const agentIdAnalysis = {
      totalActiveAgents: allAgents.length,
      totalAvailableSessions: agentSessions.length,
      agentIdRange: allAgents.length > 0 ? {
        min: Math.min(...allAgents.map(a => a.id)),
        max: Math.max(...allAgents.map(a => a.id)),
        ids: allAgents.map(a => a.id).sort()
      } : null,
      sessionAgentIds: agentSessions.map(s => s.agentId).sort()
    };

    console.log('📊 Agent device status check completed');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      availableAgentDevices: deviceStatus,
      agentIdAnalysis,
      debugNotes: {
        expectedFlow: [
          '1. Agent logs into web interface',
          '2. Agent status set to "available" in database',
          '3. Twilio Device registers with identity "agent_{agentId}"',
          '4. Device stays connected and listening',
          '5. Incoming call dials <Client>agent_{agentId}</Client>',
          '6. If device online → rings, if offline → no-answer/failed'
        ],
        commonIssues: [
          'Device not registered (user never opened softphone)',
          'Device registered but went offline (browser closed/tab inactive)',
          'Wrong agent ID format (underscore vs dash)',
          'Network connectivity issues',
          'Twilio client token expired'
        ],
        verificationSteps: [
          'Check browser console for "Twilio.Device ready" message',
          'Verify agent status is "available" in database',
          'Confirm agent ID matches between session and device registration',
          'Test device registration with simple test call'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Agent device status debug failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check agent device status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 