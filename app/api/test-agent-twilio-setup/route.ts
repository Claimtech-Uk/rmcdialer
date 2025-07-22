import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { agentId } = await request.json();
    
    if (!agentId) {
      return NextResponse.json({ 
        error: 'agentId required' 
      }, { status: 400 });
    }

    console.log(`🔧 Testing Twilio setup for agent ID: ${agentId}`);

    // 1. Verify agent exists and is active
    const agent = await prisma.agent.findUnique({
      where: { id: parseInt(agentId), isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true
      }
    });

    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent not found or inactive',
        agentId
      }, { status: 404 });
    }

    // 2. Check agent session status
    const agentSession = await prisma.agentSession.findFirst({
      where: {
        agentId: agent.id,
        status: 'available',
        logoutAt: null
      }
    });

    // 3. Test access token generation
    let accessTokenTest = null;
    try {
      const tokenResponse = await fetch('/api/twilio/access-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: agent.id.toString(),
          agentEmail: agent.email,
        }),
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        accessTokenTest = {
          success: true,
          development: tokenData.development,
          tokenGenerated: !!tokenData.accessToken,
          expiresIn: tokenData.expiresIn,
          missingCredentials: tokenData.missingCredentials
        };
      } else {
        const errorText = await tokenResponse.text();
        accessTokenTest = {
          success: false,
          error: `HTTP ${tokenResponse.status}: ${errorText}`
        };
      }
    } catch (tokenError) {
      accessTokenTest = {
        success: false,
        error: `Token request failed: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`
      };
    }

    // 4. Generate expected Twilio client identity
    const expectedTwilioIdentity = `agent_${agent.id}`;

    // 5. Check if agent would be selected for inbound calls
    const wouldReceiveInboundCalls = agentSession && 
      agentSession.status === 'available' && 
      !agentSession.logoutAt;

    const testResults = {
      timestamp: new Date().toISOString(),
      agentInfo: {
        id: agent.id,
        name: `${agent.firstName} ${agent.lastName}`,
        email: agent.email,
        isActive: agent.isActive
      },
      
      sessionStatus: {
        hasActiveSession: !!agentSession,
        sessionId: agentSession?.id,
        status: agentSession?.status,
        isLoggedIn: agentSession && !agentSession.logoutAt,
        lastActivity: agentSession?.lastActivity,
        wouldReceiveInboundCalls
      },

      twilioSetup: {
        expectedClientIdentity: expectedTwilioIdentity,
        accessTokenGeneration: accessTokenTest,
        requiredSteps: [
          '1. Agent must be logged into the system',
          '2. Agent session status must be "available"',
          '3. Agent must open browser and initialize Twilio device',
          `4. Twilio device must register with identity: "${expectedTwilioIdentity}"`,
          '5. Device must stay connected and listening for calls'
        ]
      },

      troubleshooting: {
        canReceiveInboundCalls: wouldReceiveInboundCalls,
        issues: [
          !agent.isActive && 'Agent is not active',
          !agentSession && 'No agent session found',
          agentSession && agentSession.status !== 'available' && `Agent status is "${agentSession.status}" (should be "available")`,
          agentSession && agentSession.logoutAt && 'Agent is logged out',
          !accessTokenTest?.success && `Access token generation failed: ${accessTokenTest?.error}`
        ].filter(Boolean),
        
        recommendations: wouldReceiveInboundCalls ? [
          'Agent setup looks correct for receiving inbound calls',
          'Next: Have agent open the dialler app to register Twilio device',
          'Check browser console for "Twilio Device ready" message',
          'Test with a call to verify device registration'
        ] : [
          'Agent cannot receive inbound calls in current state',
          agentSession?.status !== 'available' && 'Set agent status to "available"',
          !agentSession && 'Agent needs to log into the system',
          agentSession?.logoutAt && 'Agent needs to log back in'
        ].filter(Boolean)
      }
    };

    return NextResponse.json({
      success: true,
      results: testResults
    });

  } catch (error) {
    console.error('❌ Agent Twilio setup test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test agent Twilio setup',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 