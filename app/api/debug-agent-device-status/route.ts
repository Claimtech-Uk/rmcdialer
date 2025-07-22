import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug: Agent Device Status Check...');

    const results = {
      timestamp: new Date().toISOString(),
      system: {
        globalTwilioEnabled: process.env.NEXT_PUBLIC_ENABLE_GLOBAL_TWILIO !== 'false',
        twilioCredentials: {
          accountSid: !!process.env.TWILIO_ACCOUNT_SID,
          apiKey: !!process.env.TWILIO_API_KEY,
          apiSecret: !!process.env.TWILIO_API_SECRET,
          twimlAppSid: !!process.env.TWILIO_TWIML_APP_SID,
        },
        isDevelopment: process.env.NODE_ENV === 'development'
      },
      agents: [] as any[],
      agentSessions: [] as any[],
      recommendations: [] as string[]
    };

    // Check Twilio credentials first
    const missingCredentials = [];
    if (!process.env.TWILIO_ACCOUNT_SID) missingCredentials.push('TWILIO_ACCOUNT_SID');
    if (!process.env.TWILIO_API_KEY) missingCredentials.push('TWILIO_API_KEY');
    if (!process.env.TWILIO_API_SECRET) missingCredentials.push('TWILIO_API_SECRET');
    if (!process.env.TWILIO_TWIML_APP_SID) missingCredentials.push('TWILIO_TWIML_APP_SID');

    if (missingCredentials.length > 0) {
      results.recommendations.push(`❌ CRITICAL: Missing Twilio credentials: ${missingCredentials.join(', ')}`);
      results.recommendations.push('Agents will not be able to register devices without proper Twilio configuration');
    }
    
    // Get all active agents
    const agents = await prisma.agent.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        role: true,
        createdAt: true
      },
      orderBy: { id: 'asc' }
    });

    results.agents = agents.map(agent => ({
      ...agent,
      expectedTwilioIdentity: `agent_${agent.id}`,
      createdAt: agent.createdAt.toISOString()
    }));

    // Get all current agent sessions
    const agentSessions = await prisma.agentSession.findMany({
      where: {
        logoutAt: null, // Only active sessions
        agent: { isActive: true }
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
      orderBy: { lastActivity: 'desc' }
    });

    results.agentSessions = agentSessions.map(session => ({
      sessionId: session.id,
        agentId: session.agentId,
        status: session.status,
      loginAt: session.loginAt?.toISOString(),
      lastActivity: session.lastActivity?.toISOString(),
      currentCallSessionId: session.currentCallSessionId,
      agent: session.agent,
      expectedTwilioIdentity: `agent_${session.agentId}`,
      isAvailableForCalls: session.status === 'available' && !session.logoutAt
    }));

    // Analysis and recommendations
    if (agents.length === 0) {
      results.recommendations.push('❌ No active agents found in database');
    } else {
      results.recommendations.push(`✅ Found ${agents.length} active agent(s)`);
    }

    const availableAgents = agentSessions.filter(s => s.status === 'available');
    if (availableAgents.length === 0) {
      results.recommendations.push('⚠️ CRITICAL: No agents with status "available" - this is why inbound calls fail');
      results.recommendations.push('Solution: Agents need to log into the system and ensure their status is set to "available"');
    } else {
      results.recommendations.push(`✅ Found ${availableAgents.length} available agent(s) ready for calls`);
    }

    if (agentSessions.length === 0) {
      results.recommendations.push('❌ No active agent sessions found - agents are not logged into the system');
      results.recommendations.push('Solution: Agents need to log into the web interface');
    } else {
      results.recommendations.push(`ℹ️ Found ${agentSessions.length} active agent session(s)`);
    }

    // Check for common issues
    if (!results.system.globalTwilioEnabled) {
      results.recommendations.push('❌ CRITICAL: Global Twilio feature is DISABLED');
      results.recommendations.push('Solution: Set NEXT_PUBLIC_ENABLE_GLOBAL_TWILIO=true or remove the environment variable');
    }

    if (missingCredentials.length === 0 && results.system.isDevelopment) {
      results.recommendations.push('⚠️ Running in development mode - device registration should work normally');
    }

    // Provide next steps
    results.recommendations.push('');
    results.recommendations.push('🔧 NEXT DEBUGGING STEPS:');
    results.recommendations.push('1. Have an agent log into the web interface');
    results.recommendations.push('2. Agent should navigate to any page (like /queue/unsigned)');
    results.recommendations.push('3. Check browser console for Twilio device messages:');
    results.recommendations.push('   - Look for: "🎧 Initializing Global Twilio for agent: [email]"');
    results.recommendations.push('   - Look for: "📱 Twilio Device ready for calls"');
    results.recommendations.push('   - Look for any error messages');
    results.recommendations.push('4. Test access token generation with: POST /api/twilio/access-token');
    results.recommendations.push('5. Verify microphone permissions are granted in browser');

    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    console.error('❌ Agent device status debug error:', error);
    return NextResponse.json({
      error: 'Failed to check agent device status',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 