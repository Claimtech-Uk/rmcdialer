// =============================================================================
// Agent Heartbeat Service - Agents Module
// =============================================================================
// Tracks real-time agent availability and connectivity for inbound call routing

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/modules/core';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

// Dependencies that will be injected
interface AgentHeartbeatDependencies {
  prisma: PrismaClient;
  logger: typeof logger;
}

export interface AgentHeartbeatInfo {
  agentId: number;
  isOnline: boolean;
  lastHeartbeat: Date;
  deviceConnected: boolean;
  currentCallSessionId: string | null;
  status: string;
}

export interface AgentReadinessCheck {
  agentId: number;
  isReady: boolean;
  reasonIfNotReady: string | null;
  lastHeartbeat: Date | null;
  deviceConnected: boolean;
  currentStatus: string;
}

export class AgentHeartbeatService {
  private heartbeatCache = new Map<number, AgentHeartbeatInfo>();
  private readonly HEARTBEAT_TIMEOUT = INBOUND_CALL_FLAGS.AGENT_HEARTBEAT_INTERVAL * 1000; // Convert to milliseconds
  private readonly CACHE_TTL = 5000; // 5 seconds cache for performance

  constructor(private deps: AgentHeartbeatDependencies) {}

  /**
   * Update agent heartbeat - called by frontend/agent applications
   */
  async updateHeartbeat(agentId: number, deviceConnected: boolean = true): Promise<void> {
    const now = new Date();
    
    try {
      // Update database with heartbeat
      await this.deps.prisma.agentSession.updateMany({
        where: {
          agentId,
          logoutAt: null, // Only update active sessions
        },
        data: {
          lastHeartbeat: now,
          deviceConnected,
          lastActivity: now
        }
      });

      // Update cache
      const heartbeatInfo: AgentHeartbeatInfo = {
        agentId,
        isOnline: true,
        lastHeartbeat: now,
        deviceConnected,
        currentCallSessionId: null, // Will be populated from DB if needed
        status: 'available' // Will be updated from actual status
      };

      this.heartbeatCache.set(agentId, heartbeatInfo);

      if (INBOUND_CALL_FLAGS.INBOUND_CALL_DEBUG) {
        this.deps.logger.info('Agent heartbeat updated', {
          agentId,
          deviceConnected,
          timestamp: now.toISOString()
        });
      }
    } catch (error) {
      this.deps.logger.error('Failed to update agent heartbeat', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all currently online agents based on recent heartbeats
   */
  async getOnlineAgents(): Promise<AgentHeartbeatInfo[]> {
    try {
      const heartbeatThreshold = new Date(Date.now() - this.HEARTBEAT_TIMEOUT);
      
      const onlineAgentSessions = await this.deps.prisma.agentSession.findMany({
        where: {
          logoutAt: null,
          lastHeartbeat: {
            gte: heartbeatThreshold
          },
          agent: {
            isActive: true
          }
        },
        include: {
          agent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true
            }
          }
        },
        orderBy: {
          lastHeartbeat: 'desc'
        }
      });

      const onlineAgents: AgentHeartbeatInfo[] = onlineAgentSessions.map(session => ({
        agentId: session.agentId,
        isOnline: true,
        lastHeartbeat: session.lastHeartbeat || session.lastActivity,
        deviceConnected: session.deviceConnected || false,
        currentCallSessionId: session.currentCallSessionId,
        status: session.status
      }));

      // Update cache
      onlineAgents.forEach(agent => {
        this.heartbeatCache.set(agent.agentId, agent);
      });

      return onlineAgents;
    } catch (error) {
      this.deps.logger.error('Failed to get online agents', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if specific agent is ready to take calls
   */
  async isAgentReady(agentId: number): Promise<AgentReadinessCheck> {
    try {
      const heartbeatThreshold = new Date(Date.now() - this.HEARTBEAT_TIMEOUT);
      
      const agentSession = await this.deps.prisma.agentSession.findFirst({
        where: {
          agentId,
          logoutAt: null,
        },
        include: {
          agent: {
            select: {
              id: true,
              isActive: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (!agentSession) {
        return {
          agentId,
          isReady: false,
          reasonIfNotReady: 'No active session found',
          lastHeartbeat: null,
          deviceConnected: false,
          currentStatus: 'offline'
        };
      }

      if (!agentSession.agent.isActive) {
        return {
          agentId,
          isReady: false,
          reasonIfNotReady: 'Agent is inactive',
          lastHeartbeat: agentSession.lastHeartbeat,
          deviceConnected: agentSession.deviceConnected || false,
          currentStatus: agentSession.status
        };
      }

      const lastHeartbeat = agentSession.lastHeartbeat || agentSession.lastActivity;
      const isHeartbeatRecent = lastHeartbeat >= heartbeatThreshold;
      
      if (!isHeartbeatRecent) {
        return {
          agentId,
          isReady: false,
          reasonIfNotReady: 'Heartbeat timeout - agent may be offline',
          lastHeartbeat,
          deviceConnected: agentSession.deviceConnected || false,
          currentStatus: agentSession.status
        };
      }

      if (agentSession.status !== 'available') {
        return {
          agentId,
          isReady: false,
          reasonIfNotReady: `Agent status is ${agentSession.status}`,
          lastHeartbeat,
          deviceConnected: agentSession.deviceConnected || false,
          currentStatus: agentSession.status
        };
      }

      if (!agentSession.deviceConnected) {
        return {
          agentId,
          isReady: false,
          reasonIfNotReady: 'Device not connected',
          lastHeartbeat,
          deviceConnected: false,
          currentStatus: agentSession.status
        };
      }

      // Agent is ready!
      return {
        agentId,
        isReady: true,
        reasonIfNotReady: null,
        lastHeartbeat,
        deviceConnected: true,
        currentStatus: agentSession.status
      };

    } catch (error) {
      this.deps.logger.error('Failed to check agent readiness', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        agentId,
        isReady: false,
        reasonIfNotReady: 'System error during readiness check',
        lastHeartbeat: null,
        deviceConnected: false,
        currentStatus: 'unknown'
      };
    }
  }

  /**
   * Mark agent as offline due to timeout or explicit logout
   */
  async markAgentOffline(agentId: number, reason: string = 'heartbeat_timeout'): Promise<void> {
    try {
      await this.deps.prisma.agentSession.updateMany({
        where: {
          agentId,
          logoutAt: null,
        },
        data: {
          status: 'offline',
          deviceConnected: false,
          lastActivity: new Date()
        }
      });

      // Remove from cache
      this.heartbeatCache.delete(agentId);

      this.deps.logger.info('Agent marked offline', {
        agentId,
        reason,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.deps.logger.error('Failed to mark agent offline', {
        agentId,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Cleanup expired heartbeats - run periodically
   */
  async cleanupExpiredHeartbeats(): Promise<{ expiredCount: number }> {
    try {
      const heartbeatThreshold = new Date(Date.now() - this.HEARTBEAT_TIMEOUT);
      
      const expiredSessions = await this.deps.prisma.agentSession.findMany({
        where: {
          logoutAt: null,
          status: { not: 'offline' },
          OR: [
            { lastHeartbeat: { lt: heartbeatThreshold } },
            { lastHeartbeat: null, lastActivity: { lt: heartbeatThreshold } }
          ]
        },
        select: {
          agentId: true,
          lastHeartbeat: true,
          lastActivity: true
        }
      });

      if (expiredSessions.length > 0) {
        // Mark expired sessions as offline
        const agentIds = expiredSessions.map(s => s.agentId);
        
        await this.deps.prisma.agentSession.updateMany({
          where: {
            agentId: { in: agentIds },
            logoutAt: null
          },
          data: {
            status: 'offline',
            deviceConnected: false,
            logoutAt: new Date(), // CRITICAL FIX: Set logout timestamp for proper session closure
            lastActivity: new Date()
          }
        });

        // Remove from cache
        agentIds.forEach(agentId => {
          this.heartbeatCache.delete(agentId);
        });

        this.deps.logger.info('Cleaned up expired agent heartbeats', {
          expiredCount: expiredSessions.length,
          agentIds,
          heartbeatThreshold: heartbeatThreshold.toISOString()
        });
      }

      return { expiredCount: expiredSessions.length };
    } catch (error) {
      this.deps.logger.error('Failed to cleanup expired heartbeats', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get heartbeat statistics for monitoring
   */
  async getHeartbeatStats(): Promise<{
    totalAgents: number;
    onlineAgents: number;
    availableAgents: number;
    onCallAgents: number;
    offlineAgents: number;
  }> {
    try {
      const heartbeatThreshold = new Date(Date.now() - this.HEARTBEAT_TIMEOUT);
      
      const [totalAgents, onlineAgents, availableAgents, onCallAgents] = await Promise.all([
        this.deps.prisma.agent.count({
          where: { isActive: true }
        }),
        this.deps.prisma.agentSession.count({
          where: {
            logoutAt: null,
            agent: { isActive: true },
            OR: [
              { lastHeartbeat: { gte: heartbeatThreshold } },
              { lastHeartbeat: null, lastActivity: { gte: heartbeatThreshold } }
            ]
          }
        }),
        this.deps.prisma.agentSession.count({
          where: {
            logoutAt: null,
            status: 'available',
            agent: { isActive: true },
            OR: [
              { lastHeartbeat: { gte: heartbeatThreshold } },
              { lastHeartbeat: null, lastActivity: { gte: heartbeatThreshold } }
            ]
          }
        }),
        this.deps.prisma.agentSession.count({
          where: {
            logoutAt: null,
            status: 'on_call',
            agent: { isActive: true },
            OR: [
              { lastHeartbeat: { gte: heartbeatThreshold } },
              { lastHeartbeat: null, lastActivity: { gte: heartbeatThreshold } }
            ]
          }
        })
      ]);

      return {
        totalAgents,
        onlineAgents,
        availableAgents,
        onCallAgents,
        offlineAgents: totalAgents - onlineAgents
      };
    } catch (error) {
      this.deps.logger.error('Failed to get heartbeat stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Factory function for dependency injection
export function createAgentHeartbeatService(prisma: PrismaClient): AgentHeartbeatService {
  return new AgentHeartbeatService({
    prisma,
    logger
  });
}