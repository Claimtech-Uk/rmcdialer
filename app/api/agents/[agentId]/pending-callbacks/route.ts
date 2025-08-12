import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { UserService } from '@/modules/users';

/**
 * Get pending callbacks assigned to a specific agent
 * Returns callbacks that are due or will be due soon
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const userService = new UserService();
  
  try {
    const agentId = parseInt(params.agentId);
    if (isNaN(agentId)) {
      return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 });
    }

    // Find callbacks that are:
    // 1. Assigned to this agent (or need to be assigned to this agent)
    // 2. Status is 'pending'
    // 3. Scheduled for within the next 10 minutes or are overdue
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
    
    const callbacks = await prisma.callback.findMany({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: tenMinutesFromNow
        },
        OR: [
          // Callbacks explicitly assigned to this agent
          { preferredAgentId: agentId },
          // Callbacks in the queue assigned to this agent
          {
            callQueue: {
              some: {
                assignedToAgentId: agentId,
                status: 'assigned'
              }
            }
          },
          // ADDED: Unassigned callbacks that any agent can handle
          { preferredAgentId: null }
        ]
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });

    // Get user context for each callback
    const callbacksWithContext = await Promise.all(
      callbacks.map(async (callback) => {
        const userServiceContext = await userService.getUserCallContext(Number(callback.userId));
        
        return {
          id: callback.id,
          userId: callback.userId,
          scheduledFor: callback.scheduledFor,
          callbackReason: callback.callbackReason,
          userName: userServiceContext ? `${userServiceContext.user.firstName || 'Unknown'} ${userServiceContext.user.lastName || 'User'}`.trim() : `User ID ${callback.userId} (not found)`,
          userPhone: userServiceContext?.user.phoneNumber || 'Unknown',
          isAssigned: true
        };
      })
    );

    return NextResponse.json({
      success: true,
      callbacks: callbacksWithContext
    });

  } catch (error) {
    console.error('Error fetching pending callbacks:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch pending callbacks'
    }, { status: 500 });
  }
}

 