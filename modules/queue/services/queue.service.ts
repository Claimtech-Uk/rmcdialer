import { PrismaClient, Prisma } from '@prisma/client';
import { 
  QueueOptions, 
  UserEligibilityFactors, 
  ScoredUser, 
  QueueResult, 
  QueueRefreshResult,
  QueueFilters,
  QueueEntry,
  QueueAssignment 
} from '../types/queue.types';

// Dependencies that will be injected
interface QueueServiceDependencies {
  prisma: PrismaClient;
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}

export class QueueService {
  constructor(private deps: QueueServiceDependencies) {}

  /**
   * Refresh the entire queue by calculating scores and populating with eligible users
   */
  async refreshQueue(): Promise<QueueRefreshResult> {
    // Use database transaction for atomicity
    return await this.deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      try {
        this.deps.logger.info('Starting queue refresh');
        
        // Get eligible users for calling
        const eligibleUsers = await this.getEligibleUsers();
        this.deps.logger.info(`Found ${eligibleUsers.length} eligible users`);
        
        // Calculate priority scores for each user
        const scoredUsers = await Promise.all(
          eligibleUsers.map(user => this.calculatePriority(user))
        );
        
        // Filter out users who shouldn't be called yet
        const readyUsers = scoredUsers.filter(user => user.nextCallAfter <= new Date());
        
        // Sort by priority score (lower score = higher priority)
        readyUsers.sort((a, b) => a.score - b.score);
        
        // Clear existing pending queue entries to avoid duplicates
        await tx.callQueue.deleteMany({
          where: { status: 'pending' }
        });
        
        // Add users to queue
        const queueEntries = readyUsers.map((user, index) => ({
          userId: user.userId,
          claimId: user.claimId,
          priorityScore: Math.max(0, Math.min(user.score, 9999)), // Clamp score between 0-9999
          queuePosition: index + 1,
          queueReason: user.reason,
          status: 'pending' as const,
          queueType: 'priority_call' as const,
          availableFrom: new Date()
        }));
        
        if (queueEntries.length > 0) {
          await tx.callQueue.createMany({ data: queueEntries });
        }
        
        // Update user call scores with bulk operations
        await this.updateUserCallScoresBulk(tx, scoredUsers);
        
        this.deps.logger.info(`Queue refresh complete: ${queueEntries.length} users added to queue`);
        
        return {
          usersAdded: queueEntries.length,
          queueSize: queueEntries.length
        };
      } catch (error) {
        this.deps.logger.error('Queue refresh failed:', error);
        throw error;
      }
    });
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
          { createdAt: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      this.deps.prisma.callQueue.count({ where })
    ]);
    
    return {
      entries: entries.map(this.mapToQueueEntry),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Assign a queue entry to an agent
   */
  async assignCall(queueId: string, agentId: number): Promise<QueueEntry> {
    const updated = await this.deps.prisma.callQueue.update({
      where: { id: queueId },
      data: {
        assignedToAgentId: agentId,
        assignedAt: new Date(),
        status: 'assigned'
      }
    });
    
    this.deps.logger.info('Queue entry assigned', { queueId, agentId });
    return this.mapToQueueEntry(updated);
  }

  /**
   * Calculate priority score for a user based on business rules
   */
  private async calculatePriority(user: UserEligibilityFactors): Promise<ScoredUser> {
    let score = 0;
    const reasons: string[] = [];
    
    // Base scoring factors
    // Time since last contact (priority increases over time)
    score += Math.min(user.daysSinceLastContact * 2, 60); // Max 60 points
    
    // Pending requirements (more requirements = higher priority)
    score -= user.pendingRequirements * 15; // Negative = higher priority
    
    // Claim value (higher value = higher priority)
    if (user.claimValue > 10000) {
      score -= 20;
      reasons.push('high_value_claim');
    }
    
    // Previous outcome penalties
    const outcomeScores: Record<string, number> = {
      'not_interested': 50,
      'no_answer': 10,
      'wrong_number': 100,
      'callback_requested': -20, // Negative = higher priority
      'contacted': 5
    };
    
    if (user.lastOutcome && outcomeScores[user.lastOutcome]) {
      score += outcomeScores[user.lastOutcome];
      reasons.push(`outcome_${user.lastOutcome}`);
    }
    
    // Multiple attempts penalty
    if (user.totalAttempts > 2) {
      score += user.totalAttempts * 5;
      reasons.push('multiple_attempts');
    }
    
    // Time of day preference
    const currentHour = new Date().getHours();
    if (user.preferredCallTime) {
      const [start, end] = user.preferredCallTime;
      if (currentHour >= start && currentHour <= end) {
        score -= 5;
        reasons.push('preferred_time');
      }
    }
    
    // Calculate next call time based on business rules
    const nextCallAfter = this.calculateNextCallTime(user);
    
    return {
      ...user,
      score: Math.max(score, 0), // Ensure score is never negative
      reason: reasons.join(',') || 'standard_priority',
      nextCallAfter
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
   * Get users eligible for calling based on business rules
   */
  private async getEligibleUsers(): Promise<UserEligibilityFactors[]> {
    // For now, we'll simulate user data since we don't have the replica connection yet
    // In production, this would query the MySQL replica for users with pending requirements
    
    const mockUsers: UserEligibilityFactors[] = [
      {
        userId: 12345,
        claimId: 456,
        daysSinceLastContact: 3,
        pendingRequirements: 2,
        claimValue: 15000,
        lastOutcome: 'no_answer',
        totalAttempts: 1,
        preferredCallTime: [9, 17],
        lastCallAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        userId: 12346,
        claimId: 457,
        daysSinceLastContact: 7,
        pendingRequirements: 1,
        claimValue: 8000,
        lastOutcome: 'callback_requested',
        totalAttempts: 2,
        scheduledCallback: new Date(Date.now() + 2 * 60 * 60 * 1000)
      }
    ];
    
    return mockUsers;
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
      userId: Number(dbEntry.userId),
      claimId: dbEntry.claimId ? Number(dbEntry.claimId) : undefined,
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