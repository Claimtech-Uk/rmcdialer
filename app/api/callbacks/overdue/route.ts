import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { UserService } from '@/modules/users';

/**
 * Get overdue callbacks that need manual attention
 * Returns callbacks past their scheduled time that haven't been completed
 */
export async function GET(request: NextRequest) {
  const userService = new UserService();
  
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
        const userServiceContext = await userService.getUserCallContext(Number(callback.userId));
        const minutesOverdue = Math.floor(
          (now.getTime() - new Date(callback.scheduledFor).getTime()) / (1000 * 60)
        );
        
        return {
          id: callback.id,
          userId: callback.userId,
          scheduledFor: callback.scheduledFor,
          callbackReason: callback.callbackReason,
          userName: userServiceContext ? 
            `${userServiceContext.user.firstName || 'Unknown'} ${userServiceContext.user.lastName || 'User'}`.trim() : 
            `User ID ${callback.userId} (not found)`,
          userPhone: userServiceContext?.user.phoneNumber || 'Unknown',
          minutesOverdue,
          preferredAgentId: callback.preferredAgent?.id,
          preferredAgentName: callback.preferredAgent ? 
            `${callback.preferredAgent.firstName} ${callback.preferredAgent.lastName}` : 
            undefined
        };
      })
    );

    console.log(`📋 Found ${callbacksWithContext.length} overdue callbacks for manual handling`);

    // Convert BigInt values to numbers for JSON serialization
    const jsonSafeCallbacks = JSON.parse(JSON.stringify(callbacksWithContext, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ));

    return NextResponse.json({
      success: true,
      callbacks: jsonSafeCallbacks,
      total: jsonSafeCallbacks.length
    });

  } catch (error) {
    console.error('Error fetching overdue callbacks:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch overdue callbacks'
    }, { status: 500 });
  }
}

 