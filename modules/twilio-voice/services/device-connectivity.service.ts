// =============================================================================
// Device Connectivity Service - Twilio Voice Module
// =============================================================================
// Validates agent device connectivity and readiness for inbound call routing

import { PrismaClient } from '@prisma/client';
import { logger } from '@/modules/core';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

// Dependencies that will be injected
interface DeviceConnectivityDependencies {
  prisma: PrismaClient;
  logger: typeof logger;
}

export interface AgentReadiness {
  agentId: number;
  isReady: boolean;
  deviceConnected: boolean;
  twilioClientIdentity: string;
  lastHeartbeat: Date | null;
  readinessScore: number; // 0-100, higher = more ready
  issues: string[];
}

export interface DeviceValidationResult {
  agentId: number;
  isValid: boolean;
  twilioClientConnected: boolean;
  deviceOnline: boolean;
  lastPingTime: Date | null;
  validationErrors: string[];
}

export class DeviceConnectivityService {
  private validationCache = new Map<number, DeviceValidationResult>();
  private readonly CACHE_TTL = 10000; // 10 seconds cache
  private readonly VALIDATION_TIMEOUT = 5000; // 5 seconds for device validation

  constructor(private deps: DeviceConnectivityDependencies) {}

  /**
   * Check if agent's Twilio device is connected and ready
   */
  async isDeviceConnected(agentId: number): Promise<boolean> {
    try {
      const validation = await this.validateAgentDevice(agentId);
      return validation.isValid && validation.twilioClientConnected;
    } catch (error) {
      this.deps.logger.error('Device connectivity check failed', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Comprehensive agent readiness validation
   */
  async validateAgentReadiness(agentId: number): Promise<AgentReadiness> {
    const issues: string[] = [];
    let readinessScore = 100;
    let isReady = true;

    try {
      // 1. Check agent session status
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
              lastName: true,
              email: true
            }
          }
        }
      });

      if (!agentSession) {
        issues.push('No active agent session found');
        readinessScore -= 100;
        isReady = false;
      }

      if (agentSession && !agentSession.agent.isActive) {
        issues.push('Agent account is inactive');
        readinessScore -= 100;
        isReady = false;
      }

      // 2. Check agent status
      if (agentSession && agentSession.status !== 'available') {
        issues.push(`Agent status is ${agentSession.status}, not available`);
        readinessScore -= 50;
        if (agentSession.status === 'on_call') {
          isReady = false; // Can't take calls if already on call
        }
      }

      // 3. Check heartbeat recency
      const heartbeatThreshold = new Date(Date.now() - (INBOUND_CALL_FLAGS.AGENT_HEARTBEAT_INTERVAL * 1000));
      const lastHeartbeat = agentSession?.lastHeartbeat || agentSession?.lastActivity;
      
      if (!lastHeartbeat || lastHeartbeat < heartbeatThreshold) {
        issues.push('Heartbeat is stale or missing');
        readinessScore -= 30;
        if (!lastHeartbeat) {
          isReady = false;
        }
      }

      // 4. Check device connectivity
      let deviceConnected = false;
      if (INBOUND_CALL_FLAGS.DEVICE_CONNECTIVITY_CHECK && agentSession) {
        try {
          const deviceValidation = await this.validateAgentDevice(agentId);
          deviceConnected = deviceValidation.isValid;
          
          if (!deviceConnected) {
            issues.push('Device not connected to Twilio');
            readinessScore -= 40;
            isReady = false;
          }

          // Add specific device issues
          if (deviceValidation.validationErrors.length > 0) {
            issues.push(...deviceValidation.validationErrors);
          }
        } catch (error) {
          issues.push('Device validation failed');
          readinessScore -= 20;
        }
      } else if (agentSession) {
        // Use stored device_connected status if real-time validation is disabled
        deviceConnected = agentSession.deviceConnected || false;
        if (!deviceConnected) {
          issues.push('Device connection status is false');
          readinessScore -= 30;
          isReady = false; // CRITICAL FIX: Hard fail if device not connected
        }
      }

      // 5. Check for existing call session conflicts
      if (agentSession?.currentCallSessionId) {
        issues.push('Agent already has an active call session');
        readinessScore -= 60;
        isReady = false;
      }

      const twilioClientIdentity = `agent_${agentId}`;

      return {
        agentId,
        isReady,
        deviceConnected,
        twilioClientIdentity,
        lastHeartbeat: lastHeartbeat || null,
        readinessScore: Math.max(0, readinessScore),
        issues
      };

    } catch (error) {
      this.deps.logger.error('Agent readiness validation failed', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        agentId,
        isReady: false,
        deviceConnected: false,
        twilioClientIdentity: `agent_${agentId}`,
        lastHeartbeat: null,
        readinessScore: 0,
        issues: ['Validation system error']
      };
    }
  }

  /**
   * Validate specific agent device connectivity
   */
  async validateAgentDevice(agentId: number): Promise<DeviceValidationResult> {
    // Check cache first
    const cached = this.validationCache.get(agentId);
    if (cached && Date.now() - cached.lastPingTime!.getTime() < this.CACHE_TTL) {
      return cached;
    }

    const validationErrors: string[] = [];
    let isValid = true;
    let twilioClientConnected = false;
    let deviceOnline = false;

    try {
      // For now, we'll use the stored device_connected status
      // In a future enhancement, this could ping Twilio's API to check client connectivity
      const agentSession = await this.deps.prisma.agentSession.findFirst({
        where: {
          agentId,
          logoutAt: null,
        }
      });

      if (!agentSession) {
        validationErrors.push('No active agent session');
        isValid = false;
      } else {
        deviceOnline = agentSession.deviceConnected || false;
        twilioClientConnected = deviceOnline; // For now, assume they're the same
        
        if (!deviceOnline) {
          validationErrors.push('Device marked as disconnected');
          isValid = false;
        }

        // Additional validation checks could be added here:
        // - Ping agent's browser/app endpoint
        // - Check Twilio Workspace API for client status
        // - Validate WebRTC connection status
      }

      const result: DeviceValidationResult = {
        agentId,
        isValid,
        twilioClientConnected,
        deviceOnline,
        lastPingTime: new Date(),
        validationErrors
      };

      // Cache the result
      this.validationCache.set(agentId, result);

      if (INBOUND_CALL_FLAGS.INBOUND_CALL_DEBUG) {
        this.deps.logger.info('Agent device validation completed', {
          agentId,
          isValid,
          twilioClientConnected,
          deviceOnline,
          validationErrors
        });
      }

      return result;

    } catch (error) {
      this.deps.logger.error('Device validation error', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });

      const errorResult: DeviceValidationResult = {
        agentId,
        isValid: false,
        twilioClientConnected: false,
        deviceOnline: false,
        lastPingTime: new Date(),
        validationErrors: ['Validation system error']
      };

      this.validationCache.set(agentId, errorResult);
      return errorResult;
    }
  }

  /**
   * Batch validate multiple agents for efficiency
   */
  async validateMultipleAgents(agentIds: number[]): Promise<AgentReadiness[]> {
    const results = await Promise.allSettled(
      agentIds.map(agentId => this.validateAgentReadiness(agentId))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        this.deps.logger.error('Agent validation failed in batch', {
          agentId: agentIds[index],
          error: result.reason
        });
        
        return {
          agentId: agentIds[index],
          isReady: false,
          deviceConnected: false,
          twilioClientIdentity: `agent_${agentIds[index]}`,
          lastHeartbeat: null,
          readinessScore: 0,
          issues: ['Batch validation failed']
        };
      }
    });
  }

  /**
   * Get the most ready agents sorted by readiness score
   */
  async getMostReadyAgents(limit: number = 5): Promise<AgentReadiness[]> {
    try {
      // Get all available agents
      const availableAgentSessions = await this.deps.prisma.agentSession.findMany({
        where: {
          status: 'available',
          logoutAt: null,
          agent: {
            isActive: true
          }
        },
        select: {
          agentId: true
        },
        orderBy: {
          lastActivity: 'desc'
        }
      });

      const agentIds = availableAgentSessions.map(session => session.agentId);
      
      if (agentIds.length === 0) {
        return [];
      }

      // Validate all agents
      const readinessResults = await this.validateMultipleAgents(agentIds);
      
      // Sort by readiness score and filter ready agents
      return readinessResults
        .filter(agent => agent.isReady)
        .sort((a, b) => b.readinessScore - a.readinessScore)
        .slice(0, limit);

    } catch (error) {
      this.deps.logger.error('Failed to get most ready agents', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Clear validation cache for specific agent
   */
  clearAgentCache(agentId: number): void {
    this.validationCache.delete(agentId);
  }

  /**
   * Clear all validation cache
   */
  clearAllCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get connectivity statistics for monitoring
   */
  async getConnectivityStats(): Promise<{
    totalActiveAgents: number;
    connectedDevices: number;
    readyAgents: number;
    averageReadinessScore: number;
  }> {
    try {
      const activeAgentSessions = await this.deps.prisma.agentSession.findMany({
        where: {
          logoutAt: null,
          agent: {
            isActive: true
          }
        },
        select: {
          agentId: true,
          deviceConnected: true,
          status: true
        }
      });

      const agentIds = activeAgentSessions.map(session => session.agentId);
      const readinessResults = await this.validateMultipleAgents(agentIds);

      const connectedDevices = activeAgentSessions.filter(s => s.deviceConnected).length;
      const readyAgents = readinessResults.filter(r => r.isReady).length;
      const averageReadinessScore = readinessResults.length > 0 
        ? readinessResults.reduce((sum, r) => sum + r.readinessScore, 0) / readinessResults.length
        : 0;

      return {
        totalActiveAgents: activeAgentSessions.length,
        connectedDevices,
        readyAgents,
        averageReadinessScore
      };
    } catch (error) {
      this.deps.logger.error('Failed to get connectivity stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        totalActiveAgents: 0,
        connectedDevices: 0,
        readyAgents: 0,
        averageReadinessScore: 0
      };
    }
  }
}

// Factory function for dependency injection
export function createDeviceConnectivityService(prisma: PrismaClient): DeviceConnectivityService {
  return new DeviceConnectivityService({
    prisma,
    logger
  });
}