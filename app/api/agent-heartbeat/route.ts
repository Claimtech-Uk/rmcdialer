// =============================================================================
// Agent Heartbeat API Endpoint
// =============================================================================
// Allows agents to send heartbeat signals to maintain availability status

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createAgentHeartbeatService } from '@/modules/agents/services/agent-heartbeat.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

// Heartbeat request schema
const HeartbeatSchema = z.object({
  agentId: z.number(),
  deviceConnected: z.boolean().default(true),
  currentStatus: z.string().optional(),
  metadata: z.object({
    userAgent: z.string().optional(),
    timestamp: z.string().optional(),
    sessionInfo: z.any().optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    // Check if heartbeat feature is enabled
    if (!INBOUND_CALL_FLAGS.ENHANCED_AGENT_HEARTBEAT) {
      return NextResponse.json({
        success: false,
        error: 'Agent heartbeat feature is not enabled'
      }, { status: 400 });
    }

    const body = await request.json();
    const { agentId, deviceConnected, currentStatus, metadata } = HeartbeatSchema.parse(body);

    // Initialize heartbeat service
    const heartbeatService = createAgentHeartbeatService(prisma);

    // Update heartbeat
    await heartbeatService.updateHeartbeat(agentId);

    // If status update is provided, update agent session status
    if (currentStatus) {
      await prisma.agentSession.updateMany({
        where: {
          agentId,
          logoutAt: null,
        },
        data: {
          status: currentStatus,
          lastActivity: new Date()
        }
      });
    }

    console.log(`💓 Heartbeat received from agent ${agentId}`, {
      deviceConnected,
      currentStatus,
      timestamp: new Date().toISOString(),
      userAgent: metadata?.userAgent
    });

    return NextResponse.json({
      success: true,
      message: 'Heartbeat updated successfully',
      timestamp: new Date().toISOString(),
      agentId,
      deviceConnected
    });

  } catch (error) {
    console.error('❌ Agent heartbeat endpoint error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid heartbeat data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to process heartbeat'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if heartbeat feature is enabled
    if (!INBOUND_CALL_FLAGS.ENHANCED_AGENT_HEARTBEAT) {
      return NextResponse.json({
        success: false,
        error: 'Agent heartbeat feature is not enabled'
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    const heartbeatService = createAgentHeartbeatService(prisma);

    if (agentId) {
      // Get specific agent validation (simplified)
      const validation = await heartbeatService.validateAgentHeartbeat(parseInt(agentId));
      return NextResponse.json({
        success: true,
        agentReadiness: {
          agentId: validation.agentId,
          isReady: validation.isValid,
          reason: validation.reason,
          lastActivity: validation.lastActivity
        }
      });
    } else {
      // Get all active agents (simplified)
      const activeAgents = await heartbeatService.getActiveAgents();
      const stats = { active: activeAgents.length, total: activeAgents.length };
      
      return NextResponse.json({
        success: true,
        activeAgents,
        stats
      });
    }

  } catch (error) {
    console.error('❌ Agent heartbeat GET endpoint error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get heartbeat information'
    }, { status: 500 });
  }
}