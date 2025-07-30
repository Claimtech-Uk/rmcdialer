/**
 * Unsigned Users Queue Service (Truly Simplified)
 * 
 * PURE storage/retrieval from user_call_scores + callback tables only.
 * NO business logic - criteria already applied upstream by discovery/scoring.
 */

import { PrismaClient } from '@prisma/client';
import { replicaDb } from '@/lib/mysql';
import { 
  UnsignedUsersQueueEntry,
  UnsignedQueueData,
  QueueServiceDependencies,
  BaseQueueService,
  QueueStats,
  QueueServiceError,
  NextUserForCallResult,
  CallbackUser
} from '../types/separated-queue.types';
import { QueueType } from '../types/queue.types';

export class UnsignedUsersQueueService implements BaseQueueService<UnsignedUsersQueueEntry, UnsignedQueueData> {
  private prisma: PrismaClient;
  private logger: any;
  private readonly queueType: QueueType = 'unsigned_users';

  constructor(dependencies: QueueServiceDependencies) {
    this.prisma = dependencies.prisma;
    this.logger = dependencies.logger;
  }

  // ============================================================================
  // QUEUE OPERATIONS WITH VALIDATION
  // ============================================================================

  /**
   * Get next VALID user - includes queue-specific validation
   * Validates against replica DB and updates user_call_scores if invalid
   * Assigns user to agent when found
   */
  async getNextValidUser(agentId?: number): Promise<UnsignedUsersQueueEntry | null> {
    this.logger.info('🎯 Getting next VALID user from unsigned users queue');

    const maxAttempts = 10; // Prevent infinite loops
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.info(`🔍 Attempt ${attempt}/${maxAttempts} to find valid user...`);
      
      // 1. Get next user from queue (callbacks + user_call_scores)
      const user = await this.getNextUser();
      if (!user) {
        this.logger.info('📭 No more users in unsigned users queue');
        return null;
      }
      
      // 2. Validate user against replica DB for unsigned queue criteria
      const isValid = await this.validateUserForUnsignedQueue(user.userId);
      
      if (isValid) {
        this.logger.info(`✅ User ${user.userId} is valid for unsigned queue`);
        
        // 3. Assign user to agent if agent ID provided
        if (agentId && user.id) {
          await this.assignUserToAgent(user.id, agentId);
          this.logger.info(`👤 Assigned user ${user.userId} to agent ${agentId}`);
        }
        
        return user;
      }
      
      // 3. User invalid - mark inactive and try next
      await this.markUserInactive(user.userId, 'No longer missing signature');
      this.logger.warn(`⚠️ User ${user.userId} no longer qualifies for unsigned queue, trying next...`);
    }
    
    this.logger.warn(`⚠️ Exhausted ${maxAttempts} attempts in unsigned users queue`);
    return null;
  }

  /**
   * Validate user against replica DB for unsigned_users queue criteria
   * Criteria: current_signature_file_id IS NULL AND is_enabled = true
   */
  private async validateUserForUnsignedQueue(userId: bigint): Promise<boolean> {
    try {
      this.logger.info(`🔍 Validating user ${userId} for unsigned queue criteria...`);
      
      const userData = await replicaDb.user.findUnique({
        where: { id: userId },
        select: { 
          current_signature_file_id: true, 
          is_enabled: true 
        }
      });
      
      if (!userData) {
        this.logger.warn(`⚠️ User ${userId} not found in replica DB`);
        return false;
      }
      
      if (!userData.is_enabled) {
        this.logger.warn(`⚠️ User ${userId} is disabled`);
        return false;
      }
      
      const isMissingSignature = !userData.current_signature_file_id;
      
      if (isMissingSignature) {
        this.logger.info(`✅ User ${userId} still missing signature - valid for unsigned queue`);
      } else {
        this.logger.info(`❌ User ${userId} now has signature - no longer valid for unsigned queue`);
      }
      
      return isMissingSignature;
      
    } catch (error) {
      this.logger.error(`❌ Validation error for user ${userId}:`, error);
      // Treat validation errors as invalid (safer to skip than call potentially invalid user)
      return false;
    }
  }

  /**
   * Mark user as inactive in user_call_scores to prevent future pickup
   */
  private async markUserInactive(userId: bigint, reason: string): Promise<void> {
    try {
      await this.prisma.userCallScore.updateMany({
        where: { userId },
        data: {
          isActive: false,
          currentQueueType: null,
          lastOutcome: reason
        }
      });
      
      this.logger.info(`🚫 Marked user ${userId} as inactive: ${reason}`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to mark user ${userId} as inactive:`, error);
      // Don't throw - this is cleanup, continue with next user
    }
  }

  /**
   * Assign user to agent in the queue
   */
  private async assignUserToAgent(queueEntryId: string, agentId: number): Promise<void> {
    try {
      await this.prisma.unsignedUsersQueue.update({
        where: { id: queueEntryId },
        data: {
          assignedToAgent: agentId,
          assignedAt: new Date(),
          status: 'assigned'
        }
      });
      
      this.logger.info(`👤 Successfully assigned queue entry ${queueEntryId} to agent ${agentId}`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to assign user to agent:`, error);
      throw error;
    }
  }

  /**
   * Mark user as skipped
   */
  async markUserSkipped(queueEntryId: string): Promise<void> {
    try {
      await this.prisma.unsignedUsersQueue.update({
        where: { id: queueEntryId },
        data: {
          status: 'skipped',
          assignedToAgent: null,
          assignedAt: null
        }
      });
      
      this.logger.info(`⏭️ Marked queue entry ${queueEntryId} as skipped`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to mark user as skipped:`, error);
      throw error;
    }
  }

  /**
   * Mark user as completed
   */
  async markUserCompleted(queueEntryId: string): Promise<void> {
    try {
      await this.prisma.unsignedUsersQueue.update({
        where: { id: queueEntryId },
        data: {
          status: 'completed'
        }
      });
      
      this.logger.info(`✅ Marked queue entry ${queueEntryId} as completed`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to mark user as completed:`, error);
      throw error;
    }
  }

  /**
   * Get next user - ONLY from user_call_scores + callbacks (NO validation)
   * This is used internally by getNextValidUser()
   */
  async getNextUser(): Promise<UnsignedUsersQueueEntry | null> {
    try {
      // 1. Priority: Check for ready callbacks first
      const callback = await this.getNextReadyCallback();
      if (callback) {
        return this.formatCallbackAsQueueEntry(callback);
      }

      // 2. Get from UnsignedUsersQueue table (the CORRECT new queue table)
      const queueEntry = await this.prisma.unsignedUsersQueue.findFirst({
        where: {
          status: 'pending',
          assignedToAgent: null  // Not yet assigned to any agent
        },
        orderBy: {
          queuePosition: 'asc'  // ✅ Use proper queue ordering (lowest position = highest priority)
        }
      });

      if (!queueEntry) {
        return null;
      }

      return this.formatUnsignedQueueEntryAsEntry(queueEntry);

    } catch (error) {
      this.logger.error('❌ Failed to get next user from unsigned queue:', error);
      throw new QueueServiceError('Failed to get next user', 'unsigned_users', undefined, error as Error);
    }
  }

  // ============================================================================
  // COMPATIBILITY METHODS
  // ============================================================================

  /**
   * Convert to format compatible with existing NextUserForCallResult
   * Uses getNextValidUser() to ensure validation
   */
  async getNextUserForCall(): Promise<NextUserForCallResult | null> {
    const user = await this.getNextValidUser(); // Use validated method
    if (!user) return null;

    return {
      userId: Number(user.userId),
      userContext: null, // Will be populated by pre-call validation
      queuePosition: user.queuePosition || 0,
      queueEntryId: user.id,
      queueType: 'unsigned_users' as QueueType
    };
  }

  // ============================================================================
  // EXISTING METHODS (Unchanged)
  // ============================================================================

  /**
   * Add user to queue (called by cron population only)
   */
  async addUserToQueue(data: UnsignedQueueData): Promise<UnsignedUsersQueueEntry> {
    this.logger.info(`📝 Adding user ${data.userId} to unsigned users queue`);

    try {
      // Simple storage - no validation needed (already done upstream)
      const entry = await (this.prisma as any).unsignedUsersQueue.create({
        data: {
          userId: data.userId,
          claimId: data.claimId,
          priorityScore: data.priorityScore || 0,
          queueReason: data.queueReason || 'Missing signature',
          status: 'pending',
          availableFrom: data.availableFrom || new Date()
        }
      });

      this.logger.info(`✅ User ${data.userId} added to unsigned users queue`);
      return entry;

    } catch (error) {
      this.logger.error(`❌ Failed to add user ${data.userId} to unsigned users queue:`, error);
      throw new QueueServiceError('Failed to add user to queue', 'unsigned_users', data.userId, error as Error);
    }
  }

  /**
   * Remove user from queue (called by pre-call validation only)
   */
  async removeUserFromQueue(userId: bigint): Promise<boolean> {
    this.logger.info(`🗑️ Removing user ${userId} from unsigned users queue`);

    try {
      const result = await (this.prisma as any).unsignedUsersQueue.deleteMany({
        where: { userId }
      });

      const removed = result.count > 0;
      
      if (removed) {
        this.logger.info(`✅ User ${userId} removed from unsigned users queue`);
      } else {
        this.logger.warn(`⚠️ User ${userId} was not found in unsigned users queue`);
      }

      return removed;

    } catch (error) {
      this.logger.error(`❌ Failed to remove user ${userId} from unsigned users queue:`, error);
      throw new QueueServiceError('Failed to remove user from queue', 'unsigned_users', userId, error as Error);
    }
  }

  /**
   * Get user's queue entry
   */
  async getUserQueueEntry(userId: bigint): Promise<UnsignedUsersQueueEntry | null> {
    try {
      return await (this.prisma as any).unsignedUsersQueue.findUnique({
        where: { userId }
      });
    } catch (error) {
      this.logger.error(`❌ Failed to get queue entry for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get queue statistics for monitoring
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      // Count from user_call_scores for this queue type
      const totalCount = await this.prisma.userCallScore.count({
        where: { 
          currentQueueType: this.queueType,
          isActive: true
        }
      });

      const aggregates = await this.prisma.userCallScore.aggregate({
        where: { 
          currentQueueType: this.queueType,
          isActive: true
        },
        _avg: { currentScore: true },
        _min: { createdAt: true },
        _max: { createdAt: true }
      });

      return {
        total: totalCount,
        pending: totalCount, // All scores are considered pending
        assigned: 0, // Not tracked in user_call_scores
        completed: 0, // Not tracked in user_call_scores
        avgPriorityScore: aggregates._avg.currentScore || 0,
        oldestEntry: aggregates._min.createdAt || undefined,
        newestEntry: aggregates._max.createdAt || undefined
      };

    } catch (error) {
      this.logger.error('❌ Failed to get unsigned queue stats:', error);
      throw new QueueServiceError('Failed to get queue stats', 'unsigned_users', undefined, error as Error);
    }
  }

  // ============================================================================
  // CALLBACK HANDLING (Pure retrieval)
  // ============================================================================

  /**
   * Get next ready callback
   */
  private async getNextReadyCallback(): Promise<CallbackUser | null> {
    try {
      const callback = await this.prisma.callback.findFirst({
        where: {
          status: 'pending',
          scheduledFor: { lte: new Date() }
        },
        orderBy: { scheduledFor: 'asc' }
      });

      return callback ? {
        id: callback.id,
        userId: callback.userId,
        scheduledFor: callback.scheduledFor,
        callbackReason: callback.callbackReason ?? undefined,
        preferredAgentId: callback.preferredAgentId ?? undefined,
        originalCallSessionId: callback.originalCallSessionId
      } : null;

    } catch (error) {
      this.logger.error('❌ Failed to get ready callbacks:', error);
      return null;
    }
  }

  /**
   * Format callback as queue entry for consistent interface
   */
  private formatCallbackAsQueueEntry(callback: CallbackUser): UnsignedUsersQueueEntry {
    return {
      id: callback.id,
      userId: callback.userId,
      claimId: null,
      priorityScore: -1000, // Callbacks get highest priority
      queuePosition: 0,
      status: 'pending',
      queueReason: `Callback: ${callback.callbackReason || 'Scheduled callback'}`,
      assignedToAgentId: callback.preferredAgentId,
      assignedAt: null,
      callbackId: callback.id,
      availableFrom: callback.scheduledFor,
      createdAt: callback.scheduledFor,
      updatedAt: new Date(),
      signatureMissingSince: null,
      signatureType: 'initial'
    };
  }

  /**
   * Format user score as queue entry
   */
  private formatUserScoreAsQueueEntry(userScore: any): UnsignedUsersQueueEntry {
    return {
      id: `score-${userScore.userId}`, // Temporary ID
      userId: userScore.userId,
      claimId: userScore.claimId,
      priorityScore: userScore.currentScore,
      queuePosition: 0,
      status: 'pending',
      queueReason: 'Missing signature',
      assignedToAgentId: null,
      assignedAt: null,
      callbackId: null,
      availableFrom: userScore.nextCallAfter || new Date(),
      createdAt: userScore.createdAt,
      updatedAt: userScore.updatedAt,
      signatureMissingSince: userScore.createdAt, // Approximate
      signatureType: 'initial'
    };
  }

  /**
   * Format UnsignedUsersQueue entry as UnsignedUsersQueueEntry
   */
  private formatUnsignedQueueEntryAsEntry(queueEntry: any): UnsignedUsersQueueEntry {
    return {
      id: `queue-${queueEntry.id}`, // Use actual ID from UnsignedUsersQueue
      userId: queueEntry.userId,
      claimId: queueEntry.claimId,
      priorityScore: 0, // UnsignedUsersQueue entries don't have a direct priorityScore
      queuePosition: queueEntry.queuePosition,
      status: queueEntry.status,
      queueReason: queueEntry.queueReason,
      assignedToAgentId: queueEntry.assignedToAgent,
      assignedAt: queueEntry.assignedAt,
      callbackId: null, // UnsignedUsersQueue entries don't have a direct callbackId
      availableFrom: queueEntry.availableFrom,
      createdAt: queueEntry.createdAt,
      updatedAt: queueEntry.updatedAt,
      signatureMissingSince: null, // No direct signatureMissingSince in UnsignedUsersQueue
      signatureType: 'initial'
    };
  }
} 