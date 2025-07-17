import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface AgentStatusUpdate {
  status: 'available' | 'on_call' | 'break' | 'offline';
  breakReason?: string;
}

export interface AgentSessionStats {
  agentId: number;
  loginTime: Date;
  totalCallsToday: number;
  totalTalkTimeSeconds: number;
  currentStatus: string;
  lastStatusChange: Date;
}

export class AgentService {
  /**
   * Set agent status (login/logout/break/available)
   */
  async setAgentStatus(agentId: number, statusUpdate: AgentStatusUpdate) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Check if agent exists and is active
      const agent = await tx.agent.findUnique({
        where: { id: agentId, isActive: true }
      });

      if (!agent) {
        throw new Error('Agent not found or inactive');
      }

      // Get or create agent session for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let agentSession = await tx.agentSession.findFirst({
        where: {
          agentId,
          loginAt: {
            gte: today
          }
        }
      });

      if (!agentSession) {
        // Create new session if logging in
        if (statusUpdate.status === 'available') {
          agentSession = await tx.agentSession.create({
            data: {
              agentId,
              status: 'available',
              loginAt: new Date(),
              callsCompletedToday: 0,
              totalTalkTimeSeconds: 0
            }
          });

          logger.info('Agent logged in', {
            agentId,
            sessionId: agentSession.id,
            loginTime: agentSession.loginAt
          });
        } else {
          throw new Error('Agent must log in first');
        }
      } else {
        // Update existing session
        const updateData: any = {
          status: statusUpdate.status
        };

        // Handle logout
        if (statusUpdate.status === 'offline') {
          updateData.logoutAt = new Date();
        }

        agentSession = await tx.agentSession.update({
          where: { id: agentSession.id },
          data: updateData
        });

        logger.info('Agent status updated', {
          agentId,
          sessionId: agentSession.id,
          oldStatus: agentSession.status,
          newStatus: statusUpdate.status
        });
      }

      return agentSession;
    });
  }

  /**
   * Get agent's current status and session info
   */
  async getAgentStatus(agentId: number): Promise<AgentSessionStats | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agentSession = await prisma.agentSession.findFirst({
      where: {
        agentId,
        loginAt: {
          gte: today
        }
      },
      include: {
        agent: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            isActive: true
          }
        }
      }
    });

    if (!agentSession) {
      return null;
    }

    return {
      agentId: agentSession.agentId,
      loginTime: agentSession.loginAt,
      totalCallsToday: agentSession.callsCompletedToday || 0,
      totalTalkTimeSeconds: agentSession.totalTalkTimeSeconds || 0,
      currentStatus: agentSession.status,
      lastStatusChange: agentSession.lastActivity || agentSession.loginAt
    };
  }

  /**
   * Get all agents' current status (for supervisors)
   */
  async getAllAgentsStatus() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agentSessions = await prisma.agentSession.findMany({
      where: {
        loginAt: {
          gte: today
        }
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { loginAt: 'asc' }
      ]
    });

    return agentSessions.map((session: any) => ({
      agent: session.agent,
      session: {
        id: session.id,
        status: session.status,
        loginAt: session.loginAt,
        logoutAt: session.logoutAt,
        callsCompletedToday: session.callsCompletedToday || 0,
        totalTalkTimeSeconds: session.totalTalkTimeSeconds || 0,
        currentCallSessionId: session.currentCallSessionId
      }
    }));
  }

  /**
   * Get available agents for call assignment
   */
  async getAvailableAgents() {
    const availableAgents = await prisma.agentSession.findMany({
      where: {
        status: 'available',
        agent: {
          isActive: true,
          role: 'agent' // Only regular agents, not supervisors
        }
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    return availableAgents.map((session: any) => ({
      agentId: session.agentId,
      agent: session.agent,
      callsToday: session.callsCompletedToday || 0,
      talkTimeMinutes: Math.round((session.totalTalkTimeSeconds || 0) / 60),
      sessionId: session.id
    }));
  }

  /**
   * Update agent session stats after a call
   */
  async updateAgentStats(agentId: number, callDurationSeconds: number, talkTimeSeconds: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.agentSession.updateMany({
      where: {
        agentId,
        loginAt: {
          gte: today
        }
      },
      data: {
        callsCompletedToday: {
          increment: 1
        },
        totalTalkTimeSeconds: {
          increment: talkTimeSeconds
        }
      }
    });

    logger.info('Agent stats updated', {
      agentId,
      callDurationSeconds,
      talkTimeSeconds
    });
  }

  /**
   * Get agent performance metrics
   */
  async getAgentPerformance(agentId: number, startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const [sessionStats, callStats] = await Promise.all([
      // Session-based stats
      prisma.agentSession.aggregate({
        where: {
          agentId,
          ...(startDate || endDate ? { loginAt: dateFilter } : {})
        },
        _sum: {
          callsCompletedToday: true,
          totalTalkTimeSeconds: true
        },
        _count: {
          id: true // Total sessions/days worked
        }
      }),
      
      // Call-based stats with outcomes
      prisma.callSession.findMany({
        where: {
          agentId,
          ...(startDate || endDate ? { startedAt: dateFilter } : {})
        },
        include: {
          callOutcomes: true
        }
      })
    ]);

    // Process call outcomes
    const outcomeStats: Record<string, number> = {};
    let totalCallDuration = 0;
    let totalTalkTime = 0;

    callStats.forEach((call: any) => {
      if (call.durationSeconds) totalCallDuration += call.durationSeconds;
      if (call.talkTimeSeconds) totalTalkTime += call.talkTimeSeconds;
      
      const outcome = call.callOutcomes?.[0]?.outcomeType;
      if (outcome) {
        outcomeStats[outcome] = (outcomeStats[outcome] || 0) + 1;
      }
    });

    const totalCalls = callStats.length;
    const successfulContacts = outcomeStats.contacted || 0;

    return {
      period: {
        startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default 30 days
        endDate: endDate || new Date(),
        totalDaysWorked: sessionStats._count.id
      },
      callMetrics: {
        totalCalls,
        totalCallsFromSessions: sessionStats._sum.callsCompletedToday || 0,
        successfulContacts,
        contactRate: totalCalls > 0 ? Math.round((successfulContacts / totalCalls) * 100) : 0,
        avgCallDurationMinutes: totalCalls > 0 ? 
          Math.round((totalCallDuration / totalCalls / 60) * 100) / 100 : 0,
        avgTalkTimeMinutes: totalCalls > 0 ? 
          Math.round((totalTalkTime / totalCalls / 60) * 100) / 100 : 0,
        totalTalkTimeHours: Math.round(((sessionStats._sum.totalTalkTimeSeconds || 0) / 3600) * 100) / 100
      },
      outcomes: outcomeStats,
      efficiency: {
        callsPerHour: sessionStats._sum.totalTalkTimeSeconds ? 
          Math.round((totalCalls / ((sessionStats._sum.totalTalkTimeSeconds || 0) / 3600)) * 100) / 100 : 0,
        talkTimeRatio: totalCallDuration > 0 ? 
          Math.round((totalTalkTime / totalCallDuration) * 100) : 0
      }
    };
  }

  /**
   * Force logout inactive agents (cleanup job)
   */
  async logoutInactiveAgents(maxInactiveHours: number = 8) {
    const cutoffTime = new Date(Date.now() - maxInactiveHours * 60 * 60 * 1000);

    const result = await prisma.agentSession.updateMany({
      where: {
        status: {
          in: ['available', 'break']
        },
        lastActivity: {
          lt: cutoffTime
        },
        logoutAt: null
      },
      data: {
        status: 'offline',
        logoutAt: new Date()
      }
    });

    if (result.count > 0) {
      logger.info('Logged out inactive agents', {
        count: result.count,
        maxInactiveHours,
        cutoffTime
      });
    }

    return result.count;
  }
}

export const agentService = new AgentService(); 