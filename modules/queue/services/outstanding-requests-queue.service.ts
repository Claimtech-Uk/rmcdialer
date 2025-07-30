/**
 * Outstanding Requests Queue Service (Truly Simplified)
 * 
 * PURE storage/retrieval from user_call_scores + callback tables only.
 * NO business logic - criteria already applied upstream by discovery/scoring.
 */

import { PrismaClient } from '@prisma/client';
import { replicaDb } from '@/lib/mysql';
import { 
  OutstandingRequestsQueueEntry,
  OutstandingQueueData,
  QueueServiceDependencies,
  BaseQueueService,
  QueueStats,
  QueueServiceError,
  NextUserForCallResult,
  CallbackUser
} from '../types/separated-queue.types';
import { QueueType } from '../types/queue.types';

export class OutstandingRequestsQueueService implements BaseQueueService<OutstandingRequestsQueueEntry, OutstandingQueueData> {
  private prisma: PrismaClient;
  private logger: any;
  private readonly queueType: QueueType = 'outstanding_requests';

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
  async getNextValidUser(agentId?: number): Promise<OutstandingRequestsQueueEntry | null> {
    this.logger.info('🎯 Getting next VALID user from outstanding requests queue');

    const maxAttempts = 10; // Prevent infinite loops
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.info(`🔍 Attempt ${attempt}/${maxAttempts} to find valid user...`);
      
      // 1. Get next user from queue (callbacks + user_call_scores)
      const user = await this.getNextUser();
      if (!user) {
        this.logger.info('📭 No more users in outstanding requests queue');
        return null;
      }
      
      // 2. Validate user against replica DB for outstanding requests queue criteria
      const isValid = await this.validateUserForOutstandingQueue(user.userId);
      
      if (isValid) {
        this.logger.info(`✅ User ${user.userId} is valid for outstanding requests queue`);
        
        // 3. Assign user to agent if agent ID provided
        if (agentId && user.id) {
          await this.assignUserToAgent(user.id, agentId);
          this.logger.info(`👤 Assigned user ${user.userId} to agent ${agentId}`);
        }
        
        return user;
      }
      
      // 3. User invalid - mark inactive and try next
      await this.markUserInactive(user.userId, 'No longer has pending requirements or missing signature');
      this.logger.warn(`⚠️ User ${user.userId} no longer qualifies for outstanding requests queue, trying next...`);
    }
    
    this.logger.warn(`⚠️ Exhausted ${maxAttempts} attempts in outstanding requests queue`);
    return null;
  }

  /**
   * Validate user against replica DB for outstanding_requests queue criteria
   * Criteria: current_signature_file_id IS NOT NULL AND pending_requirements > 0 AND is_enabled = true
   */
  private async validateUserForOutstandingQueue(userId: bigint): Promise<boolean> {
    try {
      this.logger.info(`🔍 Validating user ${userId} for outstanding requests queue criteria...`);
      
      const userData = await replicaDb.user.findUnique({
        where: { id: userId },
        include: {
          claims: {
            include: {
              requirements: { 
                where: { status: 'PENDING' },
                select: { 
                  id: true,
                  type: true,
                  claim_requirement_reason: true
                }
              }
            }
          }
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
      
      const hasSignature = !!userData.current_signature_file_id;
      
      // Define excluded requirement types (same as discovery services)
      const EXCLUDED_TYPES = [
        'signature',
        'vehicle_registration',
        'cfa',
        'solicitor_letter_of_authority',
        'letter_of_authority'
      ];
      
      // Count pending requirements excluding filtered types
      const pendingRequirements = userData.claims.reduce((acc, claim) => {
        const validRequirements = claim.requirements.filter(req => {
          // Exclude standard excluded types
          if (EXCLUDED_TYPES.includes(req.type || '')) {
            return false;
          }
          // Exclude id_document with specific reason
          if (req.type === 'id_document' && req.claim_requirement_reason === 'base requirement for claim.') {
            return false;
          }
          return true;
        });
        return acc + validRequirements.length;
      }, 0);
      
      const isValid = hasSignature && pendingRequirements > 0;
      
      if (isValid) {
        this.logger.info(`✅ User ${userId} has signature + ${pendingRequirements} pending requirements - valid for outstanding queue`);
      } else {
        this.logger.info(`❌ User ${userId} validation failed - hasSignature: ${hasSignature}, pendingRequirements: ${pendingRequirements}`);
      }
      
      return isValid;
      
    } catch (error) {
      this.logger.error(`❌ Validation error for user ${userId}:`, error);
      // Treat validation errors as invalid (safer to skip than call potentially invalid user)
      return false;
    }
  }

  /**
   * Mark user as inactive in user_call_scores AND remove from queue to prevent future pickup
   */
  private async markUserInactive(userId: bigint, reason: string): Promise<void> {
    try {
      // Update user_call_scores
      await this.prisma.userCallScore.updateMany({
        where: { userId: userId },
        data: {
          isActive: false,
          currentQueueType: null,
          lastOutcome: reason
        }
      });

      // CRITICAL FIX: Also update the queue entry status to remove from future queries
      await this.prisma.outstandingRequestsQueue.updateMany({
        where: { 
          userId: userId,
          status: 'pending' // Only update pending entries
        },
        data: {
          status: 'inactive',
          assignedToAgent: null,
          assignedAt: null,
          updatedAt: new Date()
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
      // Extract raw ID if it's prefixed with 'queue-'
      const rawId = queueEntryId.startsWith('queue-') ? queueEntryId.replace('queue-', '') : queueEntryId;
      
      await this.prisma.outstandingRequestsQueue.update({
        where: { id: rawId }, // Use the raw UUID, not the prefixed ID
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
      // Extract raw ID if it's prefixed with 'queue-'
      const rawId = queueEntryId.startsWith('queue-') ? queueEntryId.replace('queue-', '') : queueEntryId;
      
      await this.prisma.outstandingRequestsQueue.update({
        where: { id: rawId }, // Use the raw UUID, not the prefixed ID
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
      // Extract raw ID if it's prefixed with 'queue-'
      const rawId = queueEntryId.startsWith('queue-') ? queueEntryId.replace('queue-', '') : queueEntryId;
      
      await this.prisma.outstandingRequestsQueue.update({
        where: { id: rawId }, // Use the raw UUID, not the prefixed ID
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
  async getNextUser(): Promise<OutstandingRequestsQueueEntry | null> {
    try {
      // 1. Priority: Check for ready callbacks first
      const callback = await this.getNextReadyCallback();
      if (callback) {
        return this.formatCallbackAsQueueEntry(callback);
      }

      // 2. Get from user_call_scores where currentQueueType = 'outstanding_requests'
      const userScore = await this.prisma.userCallScore.findFirst({
        where: {
          currentQueueType: this.queueType,
          isActive: true,
          // Include users ready to be called (NULL means immediately available)
          OR: [
            { nextCallAfter: null },
            { nextCallAfter: { lte: new Date() } }
          ]
        },
        orderBy: [
          { currentScore: 'asc' }, // Lower score = higher priority
          { createdAt: 'asc' }     // FIFO for same score
        ]
      });

      if (!userScore) {
        return null;
      }

      return this.formatUserScoreAsQueueEntry(userScore);

    } catch (error) {
      this.logger.error('❌ Failed to get next user from outstanding requests queue:', error);
      throw new QueueServiceError('Failed to get next user', 'outstanding_requests', undefined, error as Error);
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
      queueType: 'outstanding_requests' as QueueType
    };
  }

  // ============================================================================
  // EXISTING METHODS (Unchanged)
  // ============================================================================

  /**
   * Add user to queue (called by cron population only)
   */
  async addUserToQueue(data: OutstandingQueueData): Promise<OutstandingRequestsQueueEntry> {
    this.logger.info(`📝 Adding user ${data.userId} to outstanding requests queue`);

    try {
      // Simple storage - no validation needed (already done upstream)
      const entry = await (this.prisma as any).outstandingRequestsQueue.create({
        data: {
          userId: data.userId,
          claimId: data.claimId,
          priorityScore: data.priorityScore || 0,
          requirementTypes: data.requirementTypes,
          totalRequirements: data.totalRequirements,
          pendingRequirements: data.pendingRequirements,
          completedRequirements: data.totalRequirements - data.pendingRequirements,
          oldestRequirementDate: data.oldestRequirementDate || new Date(),
          queueReason: data.queueReason || 'Pending document requirements',
          status: 'pending',
          availableFrom: data.availableFrom || new Date()
        }
      });

      this.logger.info(`✅ User ${data.userId} added to outstanding requests queue`);
      return entry;

    } catch (error) {
      this.logger.error(`❌ Failed to add user ${data.userId} to outstanding requests queue:`, error);
      throw new QueueServiceError('Failed to add user to queue', 'outstanding_requests', data.userId, error as Error);
    }
  }

  /**
   * Remove user from queue (called by pre-call validation only)
   */
  async removeUserFromQueue(userId: bigint): Promise<boolean> {
    this.logger.info(`🗑️ Removing user ${userId} from outstanding requests queue`);

    try {
      const result = await (this.prisma as any).outstandingRequestsQueue.deleteMany({
        where: { userId }
      });

      const removed = result.count > 0;
      
      if (removed) {
        this.logger.info(`✅ User ${userId} removed from outstanding requests queue`);
      } else {
        this.logger.warn(`⚠️ User ${userId} was not found in outstanding requests queue`);
      }

      return removed;

    } catch (error) {
      this.logger.error(`❌ Failed to remove user ${userId} from outstanding requests queue:`, error);
      throw new QueueServiceError('Failed to remove user from queue', 'outstanding_requests', userId, error as Error);
    }
  }

  /**
   * Get user's queue entry
   */
  async getUserQueueEntry(userId: bigint): Promise<OutstandingRequestsQueueEntry | null> {
    try {
      return await (this.prisma as any).outstandingRequestsQueue.findUnique({
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
      this.logger.error('❌ Failed to get outstanding requests queue stats:', error);
      throw new QueueServiceError('Failed to get queue stats', 'outstanding_requests', undefined, error as Error);
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
  private formatCallbackAsQueueEntry(callback: CallbackUser): OutstandingRequestsQueueEntry {
    return {
      id: callback.id,
      userId: callback.userId,
      claimId: null,
      priorityScore: -1000, // Callbacks get highest priority
      queuePosition: 0,
      status: 'pending' as const,
      queueReason: `Callback: ${callback.callbackReason || 'Scheduled callback'}`,
      assignedToAgentId: callback.preferredAgentId,
      assignedAt: null,
      callbackId: callback.id,
      availableFrom: callback.scheduledFor,
      createdAt: callback.scheduledFor,
      updatedAt: new Date(),
      requirementTypes: ['callback'],
      totalRequirements: 1,
      pendingRequirements: 1,
      completedRequirements: 0,
      oldestRequirementDate: callback.scheduledFor
    };
  }

  /**
   * Format user score as queue entry
   */
  private formatUserScoreAsQueueEntry(userScore: any): OutstandingRequestsQueueEntry {
    return {
      id: `score-${userScore.userId}`, // Temporary ID
      userId: userScore.userId,
      claimId: null, // Not available in user_call_scores
      priorityScore: userScore.currentScore,
      queuePosition: 0,
      status: 'pending' as const,
      queueReason: 'Pending document requirements',
      assignedToAgentId: null,
      assignedAt: null,
      callbackId: null,
      availableFrom: userScore.nextCallAfter || new Date(),
      createdAt: userScore.createdAt,
      updatedAt: userScore.updatedAt,
      requirementTypes: ['document'], // Generic - actual types determined upstream
      totalRequirements: 1, // Generic - actual count determined upstream
      pendingRequirements: 1, // Generic - actual count determined upstream
      completedRequirements: 0,
      oldestRequirementDate: userScore.createdAt // Approximate
    };
  }
} 