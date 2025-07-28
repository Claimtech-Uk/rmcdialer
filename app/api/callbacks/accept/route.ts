import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Accept a callback and queue it as the agent's next call
 * This makes the callback their immediate next call with highest priority
 */
export async function POST(request: NextRequest) {
  try {
    const { callbackId, agentId } = await request.json();

    if (!callbackId || !agentId) {
      return NextResponse.json({
        success: false,
        error: 'Callback ID and Agent ID are required'
      }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get the callback details
      const callback = await tx.callback.findUnique({
        where: { id: callbackId },
        include: {
          preferredAgent: true
        }
      });

      if (!callback) {
        throw new Error('Callback not found');
      }

      if (callback.status !== 'pending') {
        throw new Error('Callback is not in pending status');
      }

      // Get user queue type to determine which queue to use
      const userScore = await tx.userCallScore.findUnique({
        where: { userId: callback.userId },
        select: { currentQueueType: true }
      });

      const queueType = userScore?.currentQueueType || 'outstanding_requests';

      // Remove any existing queue entries for this user to avoid duplicates
      await tx.callQueue.deleteMany({
        where: {
          userId: callback.userId,
          status: { in: ['pending', 'assigned'] }
        }
      });

      // Create a high-priority queue entry for this callback
      const queueEntry = await tx.callQueue.create({
        data: {
          userId: callback.userId,
          queueType: queueType,
          priorityScore: -2000, // Even higher priority than regular callbacks
          queueReason: `Accepted Callback: ${callback.callbackReason || 'Agent accepted callback'}`,
          assignedToAgentId: agentId,
          assignedAt: new Date(),
          callbackId: callback.id,
          availableFrom: new Date(), // Available immediately
          status: 'assigned'
        }
      });

      // Update callback status to show it's been accepted
      await tx.callback.update({
        where: { id: callbackId },
        data: {
          status: 'accepted', // New intermediate status
          preferredAgentId: agentId // Ensure it's assigned to the accepting agent
        }
      });

      return {
        callback,
        queueEntry,
        queueType
      };
    });

    console.log(`✅ Callback ${callbackId} accepted by agent ${agentId} and queued with priority -2000`);

    return NextResponse.json({
      success: true,
      message: 'Callback accepted and queued as next call',
      data: {
        callbackId: result.callback.id,
        queueEntryId: result.queueEntry.id,
        queueType: result.queueType,
        userId: result.callback.userId
      }
    });

  } catch (error) {
    console.error('Error accepting callback:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept callback'
    }, { status: 500 });
  }
} 