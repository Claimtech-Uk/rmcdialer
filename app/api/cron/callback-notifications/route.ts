import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/modules/core';
import { UserService } from '@/modules/users';

// Prevent static generation - this route requires runtime
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Callback Notification Cron Job
 * 
 * Runs every minute to check for:
 * 1. Callbacks due in 5 minutes (advance notification)
 * 2. Overdue callbacks that haven't been dealt with yet
 * 
 * Queues callbacks for agents and triggers in-app notifications.
 * If preferred agent is offline, routes to available online agent.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Skip during build to prevent hanging
  if (process.env.VERCEL_ENV === 'preview' || process.env.CI === 'true') {
    return NextResponse.json({ success: true, message: 'Skipped during build' });
  }

  const userService = new UserService();
  
  try {
    console.log('🔔 [CRON] Callback notification check starting...');
    
    // Calculate time windows
    const now = new Date();
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    const oneMinuteFromNow = new Date(Date.now() + 1 * 60 * 1000);
    
    // Find callbacks that need to be queued:
    // 1. Upcoming callbacks (4-6 minutes from now) with status 'pending'
    // 2. Overdue callbacks (past scheduled time) with status 'pending' OR 'accepted'
    const dueCallbacks = await prisma.callback.findMany({
      where: {
        OR: [
          // Upcoming callbacks for advance notification
          {
            status: 'pending',
            scheduledFor: {
              gte: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes from now
              lte: new Date(Date.now() + 6 * 60 * 1000), // 6 minutes from now
            }
          },
          // Overdue callbacks that haven't been completed yet
          {
            status: { in: ['pending', 'accepted'] },
            scheduledFor: {
              lt: now // Past the scheduled time
            }
          }
        ]
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
      console.log('📭 No callbacks due for notification or overdue callbacks to process');
      return NextResponse.json({ 
        success: true, 
        message: 'No callbacks due for notification or overdue callbacks to process',
        processed: 0
      });
    }

    // Categorize callbacks for logging
    const upcomingCallbacks = dueCallbacks.filter((cb: any) => 
      cb.status === 'pending' && new Date(cb.scheduledFor) > now
    );
    const overdueCallbacks = dueCallbacks.filter((cb: any) => 
      new Date(cb.scheduledFor) <= now
    );

    console.log(`🔔 Found ${dueCallbacks.length} callbacks to process:`);
    console.log(`   📅 ${upcomingCallbacks.length} upcoming (advance notification)`);
    console.log(`   ⏰ ${overdueCallbacks.length} overdue (past scheduled time)`);

    const results = {
      processed: 0,
      notified: 0,
      routed: 0,
      errors: 0,
      upcoming: 0,
      overdue: 0
    };

    // Batch fetch minimal identities to avoid N parallel DB calls
    const userIds = dueCallbacks.map((cb: any) => Number(cb.userId));
    const identities = await userService.getMinimalUserIdentitiesBatch(userIds);

    // Process each callback
    for (const callback of dueCallbacks) {
      try {
        results.processed++;
        
        // Track if this is upcoming or overdue
        const isOverdue = new Date(callback.scheduledFor) <= now;
        if (isOverdue) {
          results.overdue++;
        } else {
          results.upcoming++;
        }
        
        // Get minimal user identity (avoid full context during cron dispatch)
        const ident = identities.get(Number(callback.userId));
        const userName = `${ident?.firstName || 'Unknown'} ${ident?.lastName || 'User'}`.trim();
        
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
    
    console.log(`✅ [CRON] Callback notifications completed: ${results.notified}/${results.processed} processed (${results.upcoming} upcoming, ${results.overdue} overdue), ${results.routed} routed (${duration}ms)`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} callbacks (${results.upcoming} upcoming, ${results.overdue} overdue), sent ${results.notified} notifications`,
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