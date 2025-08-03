// =============================================================================
// Queue Status API - Queue Management
// =============================================================================
// Provides real-time queue status and management capabilities

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createInboundCallQueueService } from '@/modules/call-queue/services/inbound-call-queue.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

export async function GET(request: NextRequest) {
  try {
    // Check if queue feature is enabled
    if (!INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE) {
      return NextResponse.json({
        success: false,
        error: 'Queue system is not enabled'
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    const queueService = createInboundCallQueueService(prisma);

    // Get queue statistics
    const stats = await queueService.getQueueStats();

    let response: any = {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        totalInQueue: stats.totalInQueue,
        averageWaitTime: stats.averageWaitTime,
        longestWaitTime: stats.longestWaitTime,
        queuedCalls: stats.queuedCalls,
        connectedCalls: stats.connectedCalls,
        abandonedCalls: stats.abandonedCalls
      },
      features: {
        queueEnabled: INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE,
        positionUpdates: INBOUND_CALL_FLAGS.QUEUE_POSITION_UPDATES,
        holdMusic: INBOUND_CALL_FLAGS.QUEUE_HOLD_MUSIC
      }
    };

    if (detailed) {
      // Get detailed queue information
      const queuedCalls = await prisma.inboundCallQueue.findMany({
        where: {
          status: { in: ['waiting', 'assigned', 'connecting'] }
        },
        select: {
          id: true,
          twilioCallSid: true,
          callerPhone: true,
          callerName: true,
          queuePosition: true,
          estimatedWaitSeconds: true,
          enteredQueueAt: true,
          status: true,
          assignedToAgentId: true,
          attemptsCount: true
        },
        orderBy: { queuePosition: 'asc' }
      });

      const agentAvailability = await prisma.agentSession.count({
        where: {
          status: 'available',
          logoutAt: null,
          agent: { isActive: true }
        }
      });

      response.detailed = {
        queuedCalls: queuedCalls.map(call => ({
          ...call,
          waitTimeSeconds: Math.floor((Date.now() - call.enteredQueueAt.getTime()) / 1000)
        })),
        availableAgents: agentAvailability
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Queue status API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get queue status'
    }, { status: 500 });
  }
}

// Queue management actions
export async function POST(request: NextRequest) {
  try {
    // Check if queue feature is enabled
    if (!INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE) {
      return NextResponse.json({
        success: false,
        error: 'Queue system is not enabled'
      }, { status: 400 });
    }

    const body = await request.json();
    const action = body.action;

    const queueService = createInboundCallQueueService(prisma);

    switch (action) {
      case 'cleanup':
        // Clean up old queue entries
        const hours = body.hours || 24;
        const result = await queueService.cleanupOldEntries(hours);
        
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${result.cleanedCount} old queue entries`,
          cleanedCount: result.cleanedCount
        });

      case 'reorder':
        // Reorder queue positions (handled internally by service)
        const stats = await queueService.getQueueStats();
        
        return NextResponse.json({
          success: true,
          message: 'Queue reordered successfully',
          stats
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Queue management API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to perform queue action'
    }, { status: 500 });
  }
}