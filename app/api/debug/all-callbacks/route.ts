import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Debug endpoint to show ALL callbacks regardless of status
 * Helps debug why callbacks might not appear in regular endpoints
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const agentId = searchParams.get('agentId');
    
    // Show all callbacks if userId provided, or all callbacks for an agent
    let whereClause: any = {};
    
    if (userId) {
      whereClause.userId = BigInt(parseInt(userId));
    } else if (agentId) {
      whereClause.preferredAgentId = parseInt(agentId);
    }
    
    const allCallbacks = await prisma.callback.findMany({
      where: whereClause,
      include: {
        preferredAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        scheduledFor: 'desc' // Most recent first
      },
      take: 20 // Limit to prevent overload
    });

    // Get user context for each callback
    const callbacksWithContext = await Promise.all(
      allCallbacks.map(async (callback: any) => {
        const userContext = await getUserCallContext(Number(callback.userId));
        const now = new Date();
        const scheduledTime = new Date(callback.scheduledFor);
        const timeDiff = now.getTime() - scheduledTime.getTime();
        const minutesDiff = Math.floor(timeDiff / (1000 * 60));
        
        return {
          id: callback.id,
          userId: callback.userId,
          status: callback.status,
          scheduledFor: callback.scheduledFor,
          callbackReason: callback.callbackReason,
          userName: userContext ? 
            `${userContext.firstName || 'Unknown'} ${userContext.lastName || 'User'}`.trim() : 
            'Unknown User',
          userPhone: userContext?.phoneNumber || 'Unknown',
          preferredAgentId: callback.preferredAgent?.id,
          preferredAgentName: callback.preferredAgent ? 
            `${callback.preferredAgent.firstName} ${callback.preferredAgent.lastName}` : 
            undefined,
          minutesDiff: minutesDiff, // Positive = overdue, Negative = future
          isOverdue: timeDiff > 0,
          createdAt: callback.createdAt
        };
      })
    );

    return NextResponse.json({
      success: true,
      callbacks: callbacksWithContext,
      total: callbacksWithContext.length,
      debug: {
        userId,
        agentId,
        currentTime: new Date().toISOString(),
        filters: whereClause
      }
    });

  } catch (error) {
    console.error('Error in debug callbacks endpoint:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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
        u.last_name,
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
      lastName: user.last_name,
      phoneNumber: user.phone_number
    };
  } catch (error) {
    console.error(`Error fetching user context for ${userId}:`, error);
    return null;
  }
} 