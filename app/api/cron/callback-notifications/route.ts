import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/modules/core';

/**
 * Callback Notification Cron Job
 * 
 * Runs every minute to check for callbacks due in 5 minutes.
 * Queues callbacks for agents and triggers in-app notifications.
 * 
 * If preferred agent is offline, routes to available online agent.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🔔 [CRON] Callback notification check starting...');
    
    // Calculate 5 minutes from now
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    const oneMinuteFromNow = new Date(Date.now() + 1 * 60 * 1000);
    
    // Find callbacks that are due in 5 minutes (±1 minute window to avoid missing any)
    const dueCallbacks = await prisma.callback.findMany({
      where: {
        status: 'pending',
        scheduledFor: {
          gte: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes from now
          lte: new Date(Date.now() + 6 * 60 * 1000), // 6 minutes from now
        }
      },
      include: {
        preferredAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            sessions: {
              where: {
                logoutAt: null
              },
              orderBy: { lastActivity: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (dueCallbacks.length === 0) {
      console.log('📭 No callbacks due for notification');
      return NextResponse.json({ 
        success: true, 
        message: 'No callbacks due for notification',
        processed: 0
      });
    }

    console.log(`🔔 Found ${dueCallbacks.length} callbacks due for notification`);

    const results = {
      processed: 0,
      notified: 0,
      routed: 0,
      errors: 0
    };

    // Process each callback
    for (const callback of dueCallbacks) {
      try {
        results.processed++;
        
        // Get user details for the callback
        const userContext = await getUserCallContext(Number(callback.userId));
        
        if (!userContext) {
          console.error(`❌ User context not found for callback ${callback.id}`);
          results.errors++;
          continue;
        }

        const userName = `${userContext.firstName || 'Unknown'} ${userContext.lastName || 'User'}`.trim();
        
        // Check if preferred agent is available
        let targetAgent = callback.preferredAgent;
        let isPreferredAgent = true;
        
        if (!targetAgent || !targetAgent.sessions?.[0] || targetAgent.sessions[0].status !== 'available') {
          // Preferred agent not available, find an available agent
          console.log(`🔄 Preferred agent ${targetAgent?.id} not available, finding alternative...`);
          
          const availableAgent = await findAvailableAgent();
          if (availableAgent) {
            targetAgent = availableAgent;
            isPreferredAgent = false;
            results.routed++;
            console.log(`✅ Routed callback to available agent ${availableAgent.id}`);
          } else {
            console.warn(`⚠️ No agents available for callback ${callback.id}`);
            // Still proceed but log the issue
          }
        }

        if (targetAgent) {
          // Log in-app notification trigger (actual popup will be shown via the CallbackNotificationHandler)
          logCallbackNotification({
            callback,
            agent: targetAgent,
            userName,
            isPreferredAgent
          });
          
          // Queue the callback for the agent
          await queueCallbackForAgent({
            callback,
            agentId: targetAgent.id,
            userName
          });
          
          results.notified++;
        }

        // TODO: Create notification record to avoid duplicate notifications
        // This will be implemented when CallbackNotification model is available
        console.log(`📝 Would create notification record for callback ${callback.id}`);

      } catch (error) {
        console.error(`❌ Error processing callback ${callback.id}:`, error);
        results.errors++;
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`✅ [CRON] Callback notifications completed: ${results.notified}/${results.processed} notified, ${results.routed} routed (${duration}ms)`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} callbacks, sent ${results.notified} notifications`,
      results,
      duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ [CRON] Callback notification error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    }, { status: 500 });
  }
}

/**
 * Get user call context
 */
async function getUserCallContext(userId: number) {
  try {
    // Using the same pattern as existing services
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

/**
 * Find an available agent
 */
async function findAvailableAgent() {
  const availableAgent = await prisma.agent.findFirst({
    where: {
      isActive: true,
      sessions: {
        some: {
          status: 'available',
          logoutAt: null
        }
      }
    },
    include: {
      sessions: {
        where: {
          logoutAt: null
        },
        orderBy: { lastActivity: 'desc' },
        take: 1
      }
    },
    orderBy: {
      sessions: {
        _count: 'desc' // Prefer agents with more session activity
      }
    }
  });

  return availableAgent;
}

/**
 * Log callback notification trigger for agent
 * The actual popup notification will be shown by the CallbackNotificationHandler component
 */
function logCallbackNotification({
  callback,
  agent,
  userName,
  isPreferredAgent
}: {
  callback: any;
  agent: any;
  userName: string;
  isPreferredAgent: boolean;
}) {
  // Format the callback time
  const callbackTime = new Date(callback.scheduledFor).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Create notification message for logging
  const routingNote = isPreferredAgent ? '' : ' (routed to you)';
  const message = `🔔 Callback due: ${userName} scheduled for ${callbackTime}${routingNote}. Reason: ${callback.callbackReason || 'Scheduled callback'}`;

  console.log(`📱 In-app notification triggered for ${agent.firstName} ${agent.lastName}: ${message}`);
  console.log(`📋 Agent can accept callback via the popup notification that will appear in their interface`);
}

/**
 * Queue callback for agent
 */
async function queueCallbackForAgent({
  callback,
  agentId,
  userName
}: {
  callback: any;
  agentId: number;
  userName: string;
}) {
  try {
    // Add to appropriate queue based on user's status
    // First check which queue this user belongs to
    const userScore = await prisma.userCallScore.findUnique({
      where: { userId: callback.userId },
      select: { currentQueueType: true }
    });

    const queueType = userScore?.currentQueueType || 'outstanding_requests';

    // Add to the main call queue with callback reference
    await prisma.callQueue.create({
      data: {
        userId: callback.userId,
        queueType: queueType,
        priorityScore: -1000, // Highest priority for callbacks
        queueReason: `Callback: ${callback.callbackReason || 'Scheduled callback'}`,
        assignedToAgentId: agentId,
        assignedAt: new Date(),
        callbackId: callback.id,
        availableFrom: callback.scheduledFor,
        status: 'assigned'
      }
    });

    console.log(`✅ Queued callback for ${userName} to agent ${agentId} in ${queueType} queue`);
    
  } catch (error) {
    console.error(`Error queuing callback for agent ${agentId}:`, error);
  }
} 