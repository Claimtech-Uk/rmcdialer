import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Get pending callbacks assigned to a specific agent
 * Returns callbacks that are due or will be due soon
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
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
          }
        ]
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });

    // Get user context for each callback
    const callbacksWithContext = await Promise.all(
      callbacks.map(async (callback) => {
        const userContext = await getUserCallContext(Number(callback.userId));
        
        return {
          id: callback.id,
          userId: callback.userId,
          scheduledFor: callback.scheduledFor,
          callbackReason: callback.callbackReason,
          userName: userContext ? `${userContext.firstName || 'Unknown'} ${userContext.lastName || 'User'}`.trim() : 'Unknown User',
          userPhone: userContext?.phoneNumber || 'Unknown',
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

/**
 * Get user call context
 */
async function getUserCallContext(userId: number) {
  try {
    const userQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.phone_number
      FROM users u 
      WHERE u.id = ?
    `;
    
    const result = await prisma.$queryRawUnsafe(userQuery, userId);
    const users = result as any[];
    
    if (users.length === 0) return null;
    
    const user = users[0];
    return {
      firstName: user.first_name,
      lastName: user.last_name || '',
      phoneNumber: user.phone_number
    };
  } catch (error) {
    console.error(`Error fetching user context for ${userId}:`, error);
    return null;
  }
} 