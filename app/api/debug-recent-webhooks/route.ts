import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking recent webhook activity and call status updates...');
    
    const { searchParams } = new URL(request.url);
    const minutes = parseInt(searchParams.get('minutes') || '10'); // Default to last 10 minutes
    const callSid = searchParams.get('callSid'); // Optional: filter by specific call SID
    
    const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);
    
    // Get recent call sessions with status updates
    const recentCallSessions = await prisma.callSession.findMany({
      where: {
        AND: [
          {
            OR: [
              { updatedAt: { gte: timeThreshold } },
              { startedAt: { gte: timeThreshold } },
              { connectedAt: { gte: timeThreshold } },
              { endedAt: { gte: timeThreshold } }
            ]
          },
          callSid ? { twilioCallSid: callSid } : {}
        ]
      },
      select: {
        id: true,
        twilioCallSid: true,
        status: true,
        direction: true,
        userId: true,
        agentId: true,
        startedAt: true,
        connectedAt: true,
        endedAt: true,
        durationSeconds: true,
        talkTimeSeconds: true,
        recordingStatus: true,
        recordingUrl: true,
        createdAt: true,
        updatedAt: true,
        agent: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 20
    });

    // Get recent agent session updates (to see if agents were marked as available after calls)
    const recentAgentUpdates = await prisma.agentSession.findMany({
      where: {
        lastActivity: { gte: timeThreshold }
      },
      select: {
        id: true,
        agentId: true,
        status: true,
        currentCallSessionId: true,
        callsCompletedToday: true,
        totalTalkTimeSeconds: true,
        lastActivity: true,
        agent: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        lastActivity: 'desc'
      },
      take: 10
    });

    // Analyze the data
    const analysis = {
      totalRecentSessions: recentCallSessions.length,
      statusBreakdown: recentCallSessions.reduce((acc, session) => {
        acc[session.status] = (acc[session.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      sessionsWithTwilioSid: recentCallSessions.filter(s => s.twilioCallSid).length,
      completedCalls: recentCallSessions.filter(s => s.status === 'completed').length,
      callsWithDuration: recentCallSessions.filter(s => s.durationSeconds && s.durationSeconds > 0).length,
      callsWithRecording: recentCallSessions.filter(s => s.recordingStatus === 'completed').length,
      agentUpdates: recentAgentUpdates.length
    };

    // Check for webhook reception indicators
    const webhookHealthIndicators = {
      recentSessionsWithTwilioSid: analysis.sessionsWithTwilioSid > 0,
      statusUpdatesReceived: analysis.totalRecentSessions > 0,
      completedCallsProperlyEnded: analysis.completedCalls > 0,
      timingDataPresent: analysis.callsWithDuration > 0,
      agentStatusUpdated: analysis.agentUpdates > 0,
      recordingWebhooksWorking: analysis.callsWithRecording > 0
    };

    const overallWebhookHealth = Object.values(webhookHealthIndicators).filter(Boolean).length;
    const healthPercentage = (overallWebhookHealth / Object.keys(webhookHealthIndicators).length) * 100;

    return NextResponse.json({
      success: true,
      message: `Webhook activity analysis for last ${minutes} minutes`,
      timeRange: {
        from: timeThreshold.toISOString(),
        to: new Date().toISOString(),
        minutes
      },
      callSidFilter: callSid || null,
      analysis,
      webhookHealth: {
        indicators: webhookHealthIndicators,
        overallScore: `${healthPercentage.toFixed(1)}%`,
        status: healthPercentage >= 80 ? '✅ Healthy' : 
                healthPercentage >= 50 ? '⚠️ Partial' : 
                '❌ Issues Detected'
      },
      recentCallSessions: recentCallSessions.map(session => ({
        id: session.id,
        twilioCallSid: session.twilioCallSid,
        status: session.status,
        direction: session.direction,
        userId: Number(session.userId),
        agent: session.agent ? `${session.agent.firstName} ${session.agent.lastName}` : null,
        timing: {
          started: session.startedAt,
          connected: session.connectedAt,
          ended: session.endedAt,
          duration: session.durationSeconds,
          talkTime: session.talkTimeSeconds
        },
        recording: {
          status: session.recordingStatus,
          hasUrl: !!session.recordingUrl
        },
        webhookIndicators: {
          hasCallSid: !!session.twilioCallSid,
          hasEndTime: !!session.endedAt,
          hasDuration: !!session.durationSeconds,
          recentlyUpdated: session.updatedAt > timeThreshold
        },
        lastUpdated: session.updatedAt
      })),
      recentAgentUpdates: recentAgentUpdates.map(agent => ({
        agentName: `${agent.agent.firstName} ${agent.agent.lastName}`,
        status: agent.status,
        currentCallSession: agent.currentCallSessionId,
        callsToday: agent.callsCompletedToday,
        totalTalkTime: agent.totalTalkTimeSeconds,
        lastActivity: agent.lastActivity
      })),
      troubleshooting: generateTroubleshootingTips(webhookHealthIndicators, analysis)
    });

  } catch (error: any) {
    console.error('❌ Recent webhooks check failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

function generateTroubleshootingTips(indicators: any, analysis: any) {
  const tips = [];

  if (!indicators.recentSessionsWithTwilioSid) {
    tips.push({
      issue: "No call sessions with Twilio Call SID found",
      suggestion: "Check if voice webhook is properly configured in Twilio Console",
      webhookUrl: "https://rmcdialer.vercel.app/api/webhooks/twilio/voice"
    });
  }

  if (!indicators.statusUpdatesReceived) {
    tips.push({
      issue: "No recent call status updates",
      suggestion: "Verify call status webhook is configured in your TwiML",
      webhookUrl: "https://rmcdialer.vercel.app/api/webhooks/twilio/call-status",
      checkTwiML: "Ensure statusCallback is set in your Dial verb"
    });
  }

  if (!indicators.timingDataPresent && analysis.completedCalls > 0) {
    tips.push({
      issue: "Completed calls missing duration data",
      suggestion: "Status webhook may not be receiving call completion events",
      action: "Check Twilio debugger logs for webhook delivery failures"
    });
  }

  if (!indicators.agentStatusUpdated && analysis.completedCalls > 0) {
    tips.push({
      issue: "Agent status not updating after calls",
      suggestion: "Call status webhook may not be processing call completion properly"
    });
  }

  if (tips.length === 0) {
    tips.push({
      status: "✅ All webhook indicators look healthy!",
      message: "Twilio webhooks appear to be working correctly"
    });
  }

  return tips;
} 