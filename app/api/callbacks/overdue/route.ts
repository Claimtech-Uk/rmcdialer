import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Get overdue callbacks that need manual attention
 * Returns callbacks past their scheduled time that haven't been completed
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    
    // Find callbacks that are overdue (past scheduled time and not completed)
    const overdueCallbacks = await prisma.callback.findMany({
      where: {
        status: { in: ['pending', 'accepted'] },
        scheduledFor: { lt: now }
      },
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
        scheduledFor: 'asc' // Oldest overdue first
      }
    });

    // Get user context for each callback
    const callbacksWithContext = await Promise.all(
      overdueCallbacks.map(async (callback: any) => {
        const userContext = await getUserCallContext(Number(callback.userId));
        const minutesOverdue = Math.floor(
          (now.getTime() - new Date(callback.scheduledFor).getTime()) / (1000 * 60)
        );
        
        return {
          id: callback.id,
          userId: callback.userId,
          scheduledFor: callback.scheduledFor,
          callbackReason: callback.callbackReason,
          userName: userContext ? 
            `${userContext.firstName || 'Unknown'} ${userContext.lastName || 'User'}`.trim() : 
            'Unknown User',
          userPhone: userContext?.phoneNumber || 'Unknown',
          minutesOverdue,
          preferredAgentId: callback.preferredAgent?.id,
          preferredAgentName: callback.preferredAgent ? 
            `${callback.preferredAgent.firstName} ${callback.preferredAgent.lastName}` : 
            undefined
        };
      })
    );

    console.log(`📋 Found ${callbacksWithContext.length} overdue callbacks for manual handling`);

    return NextResponse.json({
      success: true,
      callbacks: callbacksWithContext,
      total: callbacksWithContext.length
    });

  } catch (error) {
    console.error('Error fetching overdue callbacks:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch overdue callbacks'
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