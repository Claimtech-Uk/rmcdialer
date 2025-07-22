import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      inboundCallSystemHealth: 'unknown' as 'healthy' | 'degraded' | 'critical' | 'unknown',
      summary: '',
      checks: {
        agentAvailability: { status: 'unknown' as 'pass' | 'fail' | 'unknown', details: '' },
        agentDatabase: { status: 'unknown' as 'pass' | 'fail' | 'unknown', details: '' },
        recentCalls: { status: 'unknown' as 'pass' | 'fail' | 'unknown', details: '' }
      },
      recommendations: [] as string[]
    };

    // Check 1: Agent database connectivity and agent existence
    try {
      const agentCount = await prisma.agent.count({
        where: { isActive: true }
      });
      
      if (agentCount === 0) {
        results.checks.agentDatabase = {
          status: 'fail',
          details: 'No active agents found in database'
        };
        results.recommendations.push('Create agent accounts and ensure they are marked as active');
      } else {
        results.checks.agentDatabase = {
          status: 'pass',
          details: `${agentCount} active agents in database`
        };
      }
    } catch (dbError) {
      results.checks.agentDatabase = {
        status: 'fail',
        details: 'Database connection failed'
      };
      results.recommendations.push('Check database connectivity');
    }

    // Check 2: Agent availability for inbound calls
    try {
      const availableAgents = await prisma.agentSession.count({
        where: {
          status: 'available',
          logoutAt: null,
          agent: {
            isActive: true
          }
        }
      });

      if (availableAgents === 0) {
        results.checks.agentAvailability = {
          status: 'fail',
          details: 'No agents currently available to receive inbound calls'
        };
        results.recommendations.push('Have agents log in and ensure their status is set to "available"');
      } else {
        results.checks.agentAvailability = {
          status: 'pass',
          details: `${availableAgents} agents available for inbound calls`
        };
      }
    } catch (sessionError) {
      results.checks.agentAvailability = {
        status: 'fail',
        details: 'Could not check agent session status'
      };
      results.recommendations.push('Check agent session table');
    }

    // Check 3: Recent inbound call patterns
    try {
      const recentCalls = await prisma.callSession.findMany({
        where: {
          direction: 'inbound',
          startedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: {
          status: true,
          connectedAt: true,
          endedAt: true
        },
        take: 100
      });

      const callStats = {
        total: recentCalls.length,
        connected: recentCalls.filter(c => c.status === 'connected' || c.connectedAt).length,
        missed: recentCalls.filter(c => c.status === 'missed_call').length,
        failed: recentCalls.filter(c => c.status === 'failed').length
      };

      const successRate = callStats.total > 0 ? 
        (callStats.connected / callStats.total * 100).toFixed(1) : '0';

      if (callStats.total === 0) {
        results.checks.recentCalls = {
          status: 'unknown',
          details: 'No inbound calls in last 24 hours'
        };
      } else if (parseFloat(successRate) < 10) {
        results.checks.recentCalls = {
          status: 'fail',
          details: `${callStats.total} calls, ${successRate}% success rate (${callStats.connected} connected, ${callStats.missed} missed)`
        };
        results.recommendations.push('Low call success rate - check agent device registration and availability');
      } else {
        results.checks.recentCalls = {
          status: 'pass',
          details: `${callStats.total} calls, ${successRate}% success rate in last 24h`
        };
      }
    } catch (callError) {
      results.checks.recentCalls = {
        status: 'fail',
        details: 'Could not analyze recent call patterns'
      };
    }

    // Determine overall health
    const checks = Object.values(results.checks);
    const failures = checks.filter(c => c.status === 'fail').length;
    const unknowns = checks.filter(c => c.status === 'unknown').length;

    if (failures === 0 && unknowns === 0) {
      results.inboundCallSystemHealth = 'healthy';
      results.summary = 'All inbound call system checks passed';
    } else if (failures === 0) {
      results.inboundCallSystemHealth = 'degraded';
      results.summary = 'Some checks could not be completed';
    } else {
      results.inboundCallSystemHealth = 'critical';
      results.summary = `${failures} critical issues found with inbound call system`;
    }

    // Add general recommendations
    if (results.checks.agentAvailability.status === 'fail') {
      results.recommendations.push('Immediate action: Ensure agents log in and are set to "available" status');
      results.recommendations.push('Check: Agent should see "Twilio Device ready" in browser console');
    }

    return NextResponse.json({
      success: true,
      ...results,
      troubleshooting: {
        commonIssues: [
          'Agents logged in but status not "available"',
          'Agents available but Twilio devices not registered in browser',
          'Access token generation issues',
          'Network connectivity preventing device registration'
        ],
        quickChecks: [
          'Verify at least one agent has status "available" in database',
          'Have agents refresh browser and check console for "Twilio Device ready"',
          'Test inbound call while monitoring Vercel function logs',
          'Confirm agents are actively using the dialler application'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Health check error:', error);
    return NextResponse.json({
      success: false,
      inboundCallSystemHealth: 'critical',
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 