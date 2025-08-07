import { PrismaClient } from '@prisma/client';

/**
 * Simplified Agent Heartbeat Service
 * Adapted to work with production schema (no lastHeartbeat/deviceConnected fields)
 */

export interface AgentHeartbeatInfo {
  agentId: number;
  lastActivity: Date;
}

export interface AgentValidationResult {
  isValid: boolean;
  agentId: number;
  lastActivity: Date | null;
  reason: string;
}

interface AgentHeartbeatServiceDependencies {
  prisma: PrismaClient;
  logger?: any;
}

export class AgentHeartbeatService {
  private deps: AgentHeartbeatServiceDependencies;
  private heartbeatCache = new Map<number, AgentHeartbeatInfo>();

  constructor(deps: AgentHeartbeatServiceDependencies) {
    this.deps = {
      ...deps,
      logger: deps.logger || console,
    };
  }

  /**
   * Update agent heartbeat (simplified to only update lastActivity)
   */
  async updateHeartbeat(agentId: number): Promise<void> {
    const now = new Date();

    try {
      // Update only active sessions with lastActivity
      await this.deps.prisma.agentSession.updateMany({
        where: {
          agentId,
          logoutAt: null, // Only update active sessions
        },
        data: {
          lastActivity: now
        }
      });

      // Update cache
      const heartbeatInfo: AgentHeartbeatInfo = {
        agentId,
        lastActivity: now,
      };

      this.heartbeatCache.set(agentId, heartbeatInfo);
      this.deps.logger.info(`💓 Heartbeat updated for agent ${agentId}`);

    } catch (error) {
      this.deps.logger.error(`❌ Failed to update heartbeat for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Validate agent heartbeat (simplified to check lastActivity)
   */
  async validateAgentHeartbeat(agentId: number): Promise<AgentValidationResult> {
    try {
      const session = await this.deps.prisma.agentSession.findFirst({
        where: {
          agentId,
          logoutAt: null, // Only check active sessions
        },
        orderBy: {
          lastActivity: 'desc'
        }
      });

      if (!session) {
        return {
          isValid: false,
          agentId,
          lastActivity: null,
          reason: 'No active session found',
        };
      }

      const heartbeatThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
      const lastActivity = session.lastActivity;
      const isValid = lastActivity >= heartbeatThreshold;

      return {
        isValid,
        agentId,
        lastActivity,
        reason: isValid ? 'Valid' : `Activity stale (${Math.round((Date.now() - lastActivity.getTime()) / 1000)}s ago)`,
      };

    } catch (error) {
      this.deps.logger.error(`❌ Failed to validate heartbeat for agent ${agentId}:`, error);
      return {
        isValid: false,
        agentId,
        lastActivity: null,
        reason: 'Validation error',
      };
    }
  }

  /**
   * Get all agents with recent activity
   */
  async getActiveAgents(): Promise<AgentValidationResult[]> {
    try {
      const heartbeatThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes

      const sessions = await this.deps.prisma.agentSession.findMany({
        where: {
          logoutAt: null,
          lastActivity: {
            gte: heartbeatThreshold
          }
        },
        include: {
          agent: true
        }
      });

      return sessions.map(session => ({
        isValid: true,
        agentId: session.agentId,
        lastActivity: session.lastActivity,
        reason: 'Active'
      }));

    } catch (error) {
      this.deps.logger.error('❌ Failed to get active agents:', error);
      return [];
    }
  }

  /**
   * Cleanup stale sessions (simplified)
   */
  async cleanupStaleSessions(): Promise<{ cleaned: number }> {
    try {
      const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours

      const result = await this.deps.prisma.agentSession.updateMany({
        where: {
          lastActivity: {
            lt: staleThreshold
          },
          logoutAt: null
        },
        data: {
          status: 'ended',
          logoutAt: new Date()
        }
      });

      this.deps.logger.info(`🧹 Cleaned up ${result.count} stale agent sessions`);
      return { cleaned: result.count };

    } catch (error) {
      this.deps.logger.error('❌ Failed to cleanup stale sessions:', error);
      return { cleaned: 0 };
    }
  }
}

// Factory function
export function createAgentHeartbeatService(prisma: PrismaClient): AgentHeartbeatService {
  return new AgentHeartbeatService({ prisma });
}