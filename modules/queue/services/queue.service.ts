import { PrismaClient, Prisma } from '@prisma/client';
import { 
  QueueOptions, 
  UserEligibilityFactors, 
  ScoredUser, 
  QueueResult, 
  QueueRefreshResult,
  QueueFilters,
  QueueEntry,
  QueueAssignment,
  QueueType,
  QUEUE_CONFIGS
} from '../types/queue.types';
import { UserService } from '@/modules/users/services/user.service';
import { PriorityScoringService, type ScoringContext } from '@/modules/scoring';
import { PreCallValidationService, type NextUserForCallResult, type PreCallValidationResult } from './pre-call-validation.service';

// Dependencies that will be injected
interface QueueServiceDependencies {
  prisma: PrismaClient;
  scoringService: PriorityScoringService;
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}

export class QueueService {
  private userService: UserService;
  private preCallValidator: PreCallValidationService;

  constructor(private deps: QueueServiceDependencies) {
    this.userService = new UserService();
    this.preCallValidator = new PreCallValidationService();
  }

  /**
   * Refresh all three queue types
   */
  async refreshAllQueues(): Promise<QueueRefreshResult[]> {
    const queueTypes: QueueType[] = ['unsigned_users', 'outstanding_requests', 'callback'];
    
    this.deps.logger.info('Starting refresh of all queue types');
    
    const results = await Promise.all(
      queueTypes.map(queueType => this.refreshQueueByType(queueType))
    );
    
    const totalAdded = results.reduce((sum, result) => sum + result.usersAdded, 0);
    this.deps.logger.info(`All queues refreshed: ${totalAdded} total users added across ${queueTypes.length} queues`);
    
    return results;
  }

  /**
   * Refresh a specific queue type using the new dual queue system
   */
  async refreshQueueByType(queueType: QueueType): Promise<QueueRefreshResult> {
    return await this.deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      try {
        const config = QUEUE_CONFIGS[queueType];
        this.deps.logger.info(`Starting refresh for ${config.displayName} queue`);
        
        // Get eligible users for this specific queue type
        const eligibleUsersResponse = await this.userService.getEligibleUsersByQueueType(queueType, {
          limit: 1000, // Get more users for queue population
          offset: 0
        });
        
        const eligibleUsers = eligibleUsersResponse.users;
        this.deps.logger.info(`Found ${eligibleUsers.length} eligible users for ${queueType} queue`);
        
        if (eligibleUsers.length === 0) {
          this.deps.logger.info(`No eligible users found for ${queueType} queue`);
          return {
            usersAdded: 0,
            queueSize: 0,
            queueType
          };
        }
        
        // Calculate priority scores for each user
        const scoredUsers = await Promise.all(
          eligibleUsers.map(user => this.calculatePriorityForUser(user, queueType))
        );
        
        // Filter out users who shouldn't be called yet (cooldown periods)
        const readyUsers = scoredUsers.filter(user => user.nextCallAfter <= new Date());
        
        // Sort by priority score (lower score = higher priority)
        readyUsers.sort((a, b) => a.score - b.score);
        
        // Clear existing pending queue entries for this queue type to avoid duplicates
        await tx.callQueue.deleteMany({
          where: { 
            status: 'pending',
            queueType 
          }
        });
        
        // Add users to queue with proper queue type
        const queueEntries = readyUsers.map((user, index) => ({
          userId: BigInt(user.userId),
          claimId: user.claimId ? BigInt(user.claimId) : null,
          priorityScore: Math.max(0, Math.min(user.score, 9999)), // Clamp score between 0-9999
          queuePosition: index + 1,
          queueReason: user.reason,
          status: 'pending' as const,
          queueType, // Use the specific queue type
          availableFrom: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        
        if (queueEntries.length > 0) {
          await tx.callQueue.createMany({ data: queueEntries });
        }
        
        // Update user call scores for tracking
        await this.updateUserCallScoresBulk(tx, scoredUsers);
        
        this.deps.logger.info(`${config.displayName} queue refresh complete: ${queueEntries.length} users added`);
        
        return {
          usersAdded: queueEntries.length,
          queueSize: queueEntries.length,
          queueType
        };
      } catch (error) {
        this.deps.logger.error(`Queue refresh failed for ${queueType}:`, error);
        throw error;
      }
    });
  }

  /**
   * Legacy method - now delegates to refreshAllQueues for backwards compatibility
   */
  async refreshQueue(): Promise<QueueRefreshResult> {
    this.deps.logger.info('Legacy refreshQueue called - refreshing all queue types');
    const results = await this.refreshAllQueues();
    
    // Return combined results for backwards compatibility
    const totalAdded = results.reduce((sum, result) => sum + result.usersAdded, 0);
    const totalSize = results.reduce((sum, result) => sum + result.queueSize, 0);
    
    return {
      usersAdded: totalAdded,
      queueSize: totalSize,
      queueType: 'unsigned_users' // Default for backwards compatibility
    };
  }

  /**
   * Get the current queue with pagination and filtering
   */
  async getQueue(filters: QueueFilters = {}): Promise<QueueResult> {
    const { page = 1, limit = 20, status = 'pending', agentId, queueType } = filters;
    
    const where: any = { status };
    if (agentId) where.assignedToAgentId = agentId;
    if (queueType) where.queueType = queueType;
    
    const [entries, total] = await Promise.all([
      this.deps.prisma.callQueue.findMany({
        where,
        orderBy: [
          { priorityScore: 'asc' },
          { queuePosition: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      this.deps.prisma.callQueue.count({ where })
    ]);
    
    return {
      entries: entries as QueueEntry[], // Type assertion for Prisma return type
      queueType: queueType || 'unsigned_users', // Default queue type for backwards compatibility
      meta: {
        page,
        limit, 
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Assign a call to an agent
   */
  async assignCall(queueId: string, agentId: number): Promise<QueueEntry> {
    const entry = await this.deps.prisma.callQueue.update({
      where: { id: queueId },
      data: {
        status: 'assigned',
        assignedToAgentId: agentId,
        assignedAt: new Date()
      }
    });
    
    this.deps.logger.info(`Call ${queueId} assigned to agent ${agentId}`);
    return entry as QueueEntry;
  }

  /**
   * Get next valid user for calling with real-time validation
   * This is the main method agents use to get guaranteed valid leads
   */
  async getNextUserForCall(queueType: QueueType): Promise<NextUserForCallResult | null> {
    this.deps.logger.info(`Getting next valid user for ${queueType} queue`);
    
    try {
      // Try PostgreSQL queue first, but fall back to direct replica mode
      let result: NextUserForCallResult | null = null;
      
      try {
        // Use pre-call validation to get next valid user from PostgreSQL queue
        result = await this.preCallValidator.getNextValidUserForCall(queueType);
      } catch (pgError: any) {
        this.deps.logger.warn(`PostgreSQL queue unavailable: ${pgError.message}, using direct replica mode`);
        
        // Fall back to direct replica mode
        result = await this.preCallValidator.getNextValidUserDirectFromReplica(queueType);
      }
      
      if (!result) {
        this.deps.logger.warn(`No valid users found in ${queueType} queue`);
        return null;
      }

      this.deps.logger.info(`Successfully found valid user ${result.userId} for ${queueType} queue`);
      return result;
      
    } catch (error) {
      this.deps.logger.error(`Failed to get next user for ${queueType}:`, error);
      return null;
    }
  }

  /**
   * Validate a specific user for calling
   */
  async validateUserForCall(userId: number, queueType: QueueType): Promise<PreCallValidationResult> {
    this.deps.logger.info(`Validating user ${userId} for ${queueType} queue`);
    
    try {
      const result = await this.preCallValidator.validateUserForCall(userId, queueType);
      
      if (result.isValid) {
        this.deps.logger.info(`User ${userId} is valid for ${queueType} queue`);
      } else {
        this.deps.logger.warn(`User ${userId} is invalid for ${queueType} queue: ${result.reason}`);
      }
      
      return result;
    } catch (error) {
      this.deps.logger.error(`Failed to validate user ${userId} for ${queueType}:`, error);
      throw error;
    }
  }

  /**
   * Run health check on a queue to identify and clean up invalid entries
   */
  async runQueueHealthCheck(queueType: QueueType, limit: number = 50): Promise<{
    totalChecked: number;
    validUsers: number;
    invalidUsers: number;
    invalidEntries: Array<{ userId: number; reason: string; queueEntryId: string }>;
  }> {
    this.deps.logger.info(`Running health check for ${queueType} queue (limit: ${limit})`);
    
    try {
      const result = await this.preCallValidator.validateQueueHealth(queueType, limit);
      
      this.deps.logger.info(
        `Health check complete for ${queueType}: ${result.validUsers} valid, ${result.invalidUsers} invalid`
      );
      
      return result;
    } catch (error) {
      this.deps.logger.error(`Health check failed for ${queueType}:`, error);
      throw error;
    }
  }

  /**
   * Get queue statistics including validation status
   */
  async getQueueStatistics(queueType?: QueueType): Promise<{
    queueStats: Array<{
      queueType: QueueType;
      totalPending: number;
      totalInvalid: number;
      lastUpdated: Date;
    }>;
  }> {
    this.deps.logger.info(`Getting queue statistics for ${queueType || 'all queues'}`);
    
    try {
      const result = await this.preCallValidator.getQueueStatistics(queueType);
      return result;
    } catch (error) {
      this.deps.logger.error(`Failed to get queue statistics:`, error);
      throw error;
    }
  }

  /**
   * Calculate priority score for a user using the scoring service
   */
  private async calculatePriorityForUser(userContext: any, queueType: QueueType): Promise<ScoredUser> {
    const config = QUEUE_CONFIGS[queueType];
    
    // Create scoring context for the scoring service
    const scoringContext: ScoringContext = {
      userId: userContext.user.id,
      userCreatedAt: userContext.user.createdAt || new Date(), // Fallback to current date if null
      currentTime: new Date()
    };

    // Calculate priority using the scoring service
    const priorityScore = await this.deps.scoringService.calculatePriority(scoringContext);
    
    // Determine next call time based on cooldown rules
    let nextCallAfter = new Date();
    if (config.cooldownHours && userContext.callScore?.lastCallAt) {
      const cooldownMs = config.cooldownHours * 60 * 60 * 1000;
      const lastCallTime = new Date(userContext.callScore.lastCallAt).getTime();
      const earliestNextCall = lastCallTime + cooldownMs;
      
      if (earliestNextCall > Date.now()) {
        nextCallAfter = new Date(earliestNextCall);
      }
    }
    
    // Build reason text based on queue type and scoring factors
    let reason = `${config.displayName}: `;
    switch (queueType) {
      case 'unsigned_users':
        reason += 'Missing signature to proceed with claim';
        break;
      case 'outstanding_requests':
        const pendingReqs = userContext.claims.reduce((acc: any, claim: any) => 
          acc + claim.requirements.filter((req: any) => req.status === 'PENDING').length, 0);
        reason += `${pendingReqs} pending requirement(s)`;
        break;
      case 'callback':
        reason += 'Scheduled callback requested';
        break;
    }
    
    // Add scoring explanation to reason
    if (priorityScore.factors.length > 0) {
      reason += ` (Score: ${priorityScore.finalScore} - ${priorityScore.factors[0].reason})`;
    }
    
    return {
      userId: userContext.user.id,
      claimId: userContext.claims[0]?.id || null,
      daysSinceLastContact: userContext.callScore?.lastCallAt 
        ? Math.floor((Date.now() - new Date(userContext.callScore.lastCallAt).getTime()) / (1000 * 60 * 60 * 24))
        : 30,
      pendingRequirements: userContext.claims.reduce((acc: any, claim: any) => 
        acc + claim.requirements.filter((req: any) => req.status === 'PENDING').length, 0),
      lastOutcome: userContext.callScore?.lastOutcome,
      totalAttempts: userContext.callScore?.totalAttempts || 0,
      lastCallAt: userContext.callScore?.lastCallAt ? new Date(userContext.callScore.lastCallAt) : undefined,
      hasSignature: queueType !== 'unsigned_users', // Inferred from queue type
      score: priorityScore.finalScore,
      reason,
      nextCallAfter,
      queueType
    };
  }

  /**
   * Calculate when this user should be eligible for next call
   */
  private calculateNextCallTime(user: UserEligibilityFactors): Date {
    const now = new Date();
    
    // Respect scheduled callbacks
    if (user.scheduledCallback) {
      return user.scheduledCallback;
    }
    
    // Business rules for different outcomes
    switch (user.lastOutcome) {
      case 'not_interested':
        // Wait 48 hours after "not interested"
        return new Date(now.getTime() + 48 * 60 * 60 * 1000);
        
      case 'callback_requested':
        // Try again in 4 hours if no specific callback time
        return new Date(now.getTime() + 4 * 60 * 60 * 1000);
        
      case 'wrong_number':
        // Wait 24 hours to verify number update
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
      case 'no_answer':
        // Try again in 2 hours
        return new Date(now.getTime() + 2 * 60 * 60 * 1000);
        
      default:
        // Standard retry delay: 1 hour
        return new Date(now.getTime() + 60 * 60 * 1000);
    }
  }



  /**
   * Update user call scores in bulk for performance
   */
  private async updateUserCallScoresBulk(
    tx: Prisma.TransactionClient, 
    scoredUsers: ScoredUser[]
  ): Promise<void> {
    for (const user of scoredUsers) {
      await tx.userCallScore.upsert({
        where: { userId: user.userId },
        update: {
          currentScore: user.score,
          nextCallAfter: user.nextCallAfter,
          lastCallAt: user.lastCallAt,
          totalAttempts: user.totalAttempts,
          lastOutcome: user.lastOutcome,
          updatedAt: new Date()
        },
        create: {
          userId: user.userId,
          currentScore: user.score,
          nextCallAfter: user.nextCallAfter,
          lastCallAt: user.lastCallAt,
          totalAttempts: user.totalAttempts,
          lastOutcome: user.lastOutcome
        }
      });
    }
  }

  /**
   * Map Prisma result to QueueEntry domain type
   */
  private mapToQueueEntry(dbEntry: any): QueueEntry {
    return {
      id: dbEntry.id,
      userId: dbEntry.userId,
      claimId: dbEntry.claimId,
      queueType: dbEntry.queueType,
      priorityScore: dbEntry.priorityScore,
      queuePosition: dbEntry.queuePosition,
      status: dbEntry.status,
      queueReason: dbEntry.queueReason,
      assignedToAgentId: dbEntry.assignedToAgentId,
      assignedAt: dbEntry.assignedAt,
      callbackId: dbEntry.callbackId,
      availableFrom: dbEntry.availableFrom,
      createdAt: dbEntry.createdAt,
      updatedAt: dbEntry.updatedAt
    };
  }
} 