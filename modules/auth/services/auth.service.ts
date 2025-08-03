import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  LoginRequest,
  LoginResponse,
  AgentProfile,
  AgentSession,
  AgentStatusUpdate,
  AgentSessionStats,
  AgentPerformanceMetrics,
  JwtPayload,
  AuthError,
  CreateAgentRequest,
  AgentPermissions
} from '../types/auth.types';

// Dependencies that will be injected
interface AuthServiceDependencies {
  prisma: PrismaClient;
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}

export class AuthService {
  constructor(private deps: AuthServiceDependencies) {}

  /**
   * Authenticate user with email and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { email, password } = credentials;

    try {
      this.deps.logger.info('AuthService login attempt', { email });
      
      // Find agent by email
      const agent = await this.deps.prisma.agent.findUnique({
        where: { email, isActive: true }
      });

      if (!agent) {
        this.deps.logger.warn('Agent not found', { email });
        throw new Error('Invalid credentials');
      }

      this.deps.logger.info('Agent found', { email, agentId: agent.id });

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, agent.passwordHash);
      this.deps.logger.info('Password verification', { email, isPasswordValid });
      if (!isPasswordValid) {
        this.deps.logger.warn('Invalid password', { email });
        throw new Error('Invalid credentials');
      }

      // Create/update session
      const session = await this.setAgentStatus(agent.id, { status: 'available' });

      // Generate JWT token
      const token = this.generateToken(agent);

      this.deps.logger.info('Agent logged in successfully', {
        agentId: agent.id,
        email: agent.email,
        sessionId: session.id
      });

      return {
        success: true,
        data: {
          agent: this.mapToAgentProfile(agent),
          accessToken: token
        }
      };
    } catch (error) {
      this.deps.logger.error('Login failed', { email, error });
      throw new Error('Authentication failed');
    }
  }

  /**
   * Logout agent and update session
   */
  async logout(agentId: number): Promise<void> {
    try {
      await this.setAgentStatus(agentId, { status: 'offline' });
      this.deps.logger.info('Agent logged out', { agentId });
    } catch (error) {
      this.deps.logger.error('Logout failed', { agentId, error });
      throw error;
    }
  }

  /**
   * Get agent profile by ID
   */
  async getAgentProfile(agentId: number): Promise<AgentProfile | null> {
    const agent = await this.deps.prisma.agent.findUnique({
      where: { id: agentId, isActive: true }
    });

    return agent ? this.mapToAgentProfile(agent) : null;
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-secret-for-build'
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
      
      // Verify agent still exists and is active
      const agent = await this.deps.prisma.agent.findUnique({
        where: { id: decoded.id, isActive: true }
      });

      if (!agent) {
        throw new Error('Agent not found or inactive');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Set agent status (login/logout/break/available)
   * Migrated from agent.service.ts
   */
  async setAgentStatus(agentId: number, statusUpdate: AgentStatusUpdate): Promise<AgentSession> {
    return await this.deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
              totalTalkTimeSeconds: 0,
              lastActivity: new Date()
            }
          });

          this.deps.logger.info('Agent logged in', {
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
          status: statusUpdate.status,
          lastActivity: new Date()
        };

        // Handle different status changes with proper cleanup
        switch (statusUpdate.status) {
          case 'offline':
            updateData.logoutAt = new Date();
            updateData.currentCallSessionId = null; // Clear any stuck call sessions
            this.deps.logger.info('Agent going offline - clearing session', { agentId });
            break;
            
          case 'break':
            // Agent on break - should not receive calls, but keep session active
            updateData.currentCallSessionId = null; // Clear calls when on break
            this.deps.logger.info('Agent going on break - clearing calls', { agentId });
            break;
            
          case 'available':
            // Agent back and ready - keep existing currentCallSessionId if they have one
            this.deps.logger.info('Agent now available for calls', { agentId });
            break;

          case 'on_call':
            // This should typically be set by the call system, not manually
            this.deps.logger.info('Agent status set to on_call', { agentId });
            break;
        }

        agentSession = await tx.agentSession.update({
          where: { id: agentSession.id },
          data: updateData
        });

        this.deps.logger.info('Agent status updated', {
          agentId,
          sessionId: agentSession.id,
          newStatus: statusUpdate.status
        });
      }

      return this.mapToAgentSession(agentSession);
    });
  }

  /**
   * Get agent's current status and session info
   * Migrated from agent.service.ts
   */
  async getAgentStatus(agentId: number): Promise<AgentSessionStats | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agentSession = await this.deps.prisma.agentSession.findFirst({
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
      lastStatusChange: agentSession.lastActivity || agentSession.loginAt,
      agent: agentSession.agent
    };
  }

  /**
   * Get all agents' current status (for supervisors)
   * Migrated from agent.service.ts
   */
  async getAllAgentsStatus(): Promise<AgentSessionStats[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agentSessions = await this.deps.prisma.agentSession.findMany({
      where: {
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
      },
      orderBy: {
        loginAt: 'desc'
      }
    });

    return agentSessions.map((session: any) => ({
      agentId: session.agentId,
      loginTime: session.loginAt,
      totalCallsToday: session.callsCompletedToday || 0,
      totalTalkTimeSeconds: session.totalTalkTimeSeconds || 0,
      currentStatus: session.status,
      lastStatusChange: session.lastActivity || session.loginAt,
      agent: session.agent
    }));
  }

  /**
   * Get agent performance metrics
   * Migrated from agent.service.ts
   */
  async getAgentPerformance(
    agentId: number, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<AgentPerformanceMetrics> {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const [sessionStats, callStats] = await Promise.all([
      // Session-based stats
      this.deps.prisma.agentSession.aggregate({
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
      this.deps.prisma.callSession.findMany({
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
   * Migrated from agent.service.ts
   */
  async logoutInactiveAgents(maxInactiveHours: number = 8): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxInactiveHours * 60 * 60 * 1000);

    const result = await this.deps.prisma.agentSession.updateMany({
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
      this.deps.logger.info('Logged out inactive agents', {
        count: result.count,
        maxInactiveHours,
        cutoffTime
      });
    }

    return result.count;
  }

  /**
   * Get agent permissions based on role
   */
  getAgentPermissions(role: string): AgentPermissions {
    const basePermissions = {
      canViewAllQueues: false,
      canAssignCalls: false,
      canViewReports: false,
      canManageAgents: false,
      canViewSupervisorDashboard: false,
      canModifyCallOutcomes: false
    };

    switch (role) {
      case 'admin':
        return {
          canViewAllQueues: true,
          canAssignCalls: true,
          canViewReports: true,
          canManageAgents: true,
          canViewSupervisorDashboard: true,
          canModifyCallOutcomes: true
        };
      case 'supervisor':
        return {
          ...basePermissions,
          canViewAllQueues: true,
          canAssignCalls: true,
          canViewReports: true,
          canViewSupervisorDashboard: true,
          canModifyCallOutcomes: true
        };
      case 'agent':
      default:
        return {
          ...basePermissions,
          canAssignCalls: true // Agents can assign calls to themselves
        };
    }
  }

  // ===============================================
  // AGENT MANAGEMENT METHODS (Admin Only)
  // ===============================================

  /**
   * Create a new agent (admin only)
   */
  async createAgent(data: CreateAgentRequest): Promise<AgentProfile> {
    try {
      // Hash the password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(data.password, saltRounds);

      // Create the agent
      const agent = await this.deps.prisma.agent.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          isAiAgent: data.isAiAgent || false,
          isActive: true
        }
      });

      this.deps.logger.info('Agent created successfully', {
        agentId: agent.id,
        email: agent.email,
        role: agent.role
      });

      return this.mapToAgentProfile(agent);
    } catch (error: any) {
      this.deps.logger.error('Failed to create agent', { error, email: data.email });
      throw error;
    }
  }

  /**
   * Update an agent (admin only)
   */
  async updateAgent(agentId: number, data: Partial<AgentProfile>): Promise<AgentProfile> {
    try {
      // First check if agent exists
      const existingAgent = await this.deps.prisma.agent.findUnique({
        where: { id: agentId }
      });

      if (!existingAgent) {
        throw new Error('Agent not found');
      }

      // Update the agent
      const agent = await this.deps.prisma.agent.update({
        where: { id: agentId },
        data: {
          ...(data.email && { email: data.email }),
          ...(data.firstName && { firstName: data.firstName }),
          ...(data.lastName && { lastName: data.lastName }),
          ...(data.role && { role: data.role }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.isAiAgent !== undefined && { isAiAgent: data.isAiAgent }),
          ...(data.twilioWorkerSid !== undefined && { twilioWorkerSid: data.twilioWorkerSid })
        }
      });

      this.deps.logger.info('Agent updated successfully', {
        agentId: agent.id,
        updatedFields: Object.keys(data)
      });

      return this.mapToAgentProfile(agent);
    } catch (error: any) {
      this.deps.logger.error('Failed to update agent', { error, agentId });
      throw error;
    }
  }

  /**
   * Delete an agent (admin only)
   */
  async deleteAgent(agentId: number): Promise<void> {
    try {
      // First check if agent exists
      const existingAgent = await this.deps.prisma.agent.findUnique({
        where: { id: agentId }
      });

      if (!existingAgent) {
        throw new Error('Agent not found');
      }

      // Log the deletion for audit trail
      this.deps.logger.info('Agent deletion initiated', {
        agentId,
        email: existingAgent.email,
        role: existingAgent.role,
        deleteAction: 'hard_delete'
      });

      // Use transaction to ensure atomicity
      await this.deps.prisma.$transaction(async (tx) => {
        // 1. Delete/update all foreign key relationships in correct order
        
        // Delete MagicLinkActivity records
        const deletedMagicLinks = await tx.magicLinkActivity.deleteMany({
          where: { sentByAgentId: agentId }
        });
        this.deps.logger.info('Deleted magic link activities', { count: deletedMagicLinks.count });

        // Delete SMS conversations and messages (cascade should handle messages)
        const deletedSMSConversations = await tx.smsConversation.deleteMany({
          where: { assignedAgentId: agentId }
        });
        this.deps.logger.info('Deleted SMS conversations', { count: deletedSMSConversations.count });

        // Delete CallOutcome records
        const deletedCallOutcomes = await tx.callOutcome.deleteMany({
          where: { recordedByAgentId: agentId }
        });
        this.deps.logger.info('Deleted call outcomes', { count: deletedCallOutcomes.count });

        // Update CallSession records to remove foreign key references
        const updatedCallSessions = await tx.callSession.updateMany({
          where: { lastOutcomeAgentId: agentId },
          data: { lastOutcomeAgentId: null }
        });
        this.deps.logger.info('Updated call sessions (removed lastOutcomeAgentId)', { count: updatedCallSessions.count });

        // Delete CallSession records where agent is primary
        const deletedCallSessions = await tx.callSession.deleteMany({
          where: { agentId: agentId }
        });
        this.deps.logger.info('Deleted call sessions', { count: deletedCallSessions.count });

        // Update CallQueue records to remove assignment
        const updatedCallQueue = await tx.callQueue.updateMany({
          where: { assignedToAgentId: agentId },
          data: { 
            assignedToAgentId: null,
            assignedAt: null,
            status: 'pending' // Reset to pending so they can be reassigned
          }
        });
        this.deps.logger.info('Updated call queue (removed assignment)', { count: updatedCallQueue.count });

        // Update Callback records to remove preferred agent
        const updatedCallbacks = await tx.callback.updateMany({
          where: { preferredAgentId: agentId },
          data: { preferredAgentId: null }
        });
        this.deps.logger.info('Updated callbacks (removed preferred agent)', { count: updatedCallbacks.count });

        // Delete AgentSession records
        const deletedAgentSessions = await tx.agentSession.deleteMany({
          where: { agentId }
        });
        this.deps.logger.info('Deleted agent sessions', { count: deletedAgentSessions.count });

        // Finally, hard delete the agent record
        await tx.agent.delete({
          where: { id: agentId }
        });

        this.deps.logger.info('Agent deleted successfully', {
          agentId,
          originalEmail: existingAgent.email,
          deleteAction: 'completed'
        });
      });

    } catch (error: any) {
      this.deps.logger.error('Failed to delete agent', { 
        error: error.message, 
        agentId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get all agents with filtering and pagination
   */
  async getAllAgents(filters: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<{
    agents: AgentProfile[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { 
        page = 1, 
        limit = 20, 
        role, 
        isActive, 
        search 
      } = filters;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      
      if (role) {
        where.role = role;
      }
      
      if (isActive !== undefined) {
        where.isActive = isActive;
      }
      
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Get agents and total count
      const [agents, total] = await Promise.all([
        this.deps.prisma.agent.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        this.deps.prisma.agent.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        agents: agents.map(this.mapToAgentProfile),
        total,
        page,
        limit,
        totalPages
      };
    } catch (error: any) {
      this.deps.logger.error('Failed to get all agents', { error, filters });
      throw error;
    }
  }

  /**
   * Reset agent password (admin only)
   */
  async resetAgentPassword(agentId: number, newPassword: string): Promise<void> {
    try {
      // First check if agent exists
      const existingAgent = await this.deps.prisma.agent.findUnique({
        where: { id: agentId }
      });

      if (!existingAgent) {
        throw new Error('Agent not found');
      }

      // Hash the new password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update the password
      await this.deps.prisma.agent.update({
        where: { id: agentId },
        data: { passwordHash }
      });

      this.deps.logger.info('Agent password reset successfully', {
        agentId,
        email: existingAgent.email
      });
    } catch (error: any) {
      this.deps.logger.error('Failed to reset agent password', { error, agentId });
      throw error;
    }
  }

  // ===============================================
  // PRIVATE HELPER METHODS
  // ===============================================

  /**
   * Generate JWT token for agent
   */
  private generateToken(agent: any): string {
    const payload: JwtPayload = {
      id: agent.id,
      email: agent.email,
      role: agent.role
    };

    const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-secret-for-build'
    return jwt.sign(payload, jwtSecret, {
      expiresIn: '8h'
    });
  }

  /**
   * Map database agent to AgentProfile
   */
  private mapToAgentProfile(dbAgent: any): AgentProfile {
    return {
      id: dbAgent.id,
      email: dbAgent.email,
      firstName: dbAgent.firstName,
      lastName: dbAgent.lastName,
      role: dbAgent.role,
      team: dbAgent.team || 'general',
      allowedQueues: dbAgent.allowedQueues ? 
        (Array.isArray(dbAgent.allowedQueues) ? dbAgent.allowedQueues : JSON.parse(dbAgent.allowedQueues)) : 
        ['unsigned_users', 'outstanding_requests'],
      isActive: dbAgent.isActive,
      isAiAgent: dbAgent.isAiAgent,
      twilioWorkerSid: dbAgent.twilioWorkerSid,
      createdAt: dbAgent.createdAt,
      updatedAt: dbAgent.updatedAt
    };
  }

  /**
   * Map database session to AgentSession
   */
  private mapToAgentSession(dbSession: any): AgentSession {
    return {
      id: dbSession.id,
      agentId: dbSession.agentId,
      status: dbSession.status,
      currentCallSessionId: dbSession.currentCallSessionId,
      loginAt: dbSession.loginAt,
      logoutAt: dbSession.logoutAt,
      lastActivity: dbSession.lastActivity,
      callsCompletedToday: dbSession.callsCompletedToday,
      totalTalkTimeSeconds: dbSession.totalTalkTimeSeconds
    };
  }
} 