import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface QueueOptions {
  limit?: number;
  status?: 'pending' | 'assigned' | 'completed';
  agentId?: number;
}

export interface UserEligibilityFactors {
  userId: number;
  claimId?: number;
  daysSinceLastContact: number;
  pendingRequirements: number;
  claimValue: number;
  lastOutcome?: string;
  totalAttempts: number;
  preferredCallTime?: [number, number]; // [startHour, endHour]
  lastCallAt?: Date;
  scheduledCallback?: Date;
}

export interface ScoredUser extends UserEligibilityFactors {
  score: number;
  reason: string;
  nextCallAfter: Date;
}

export class QueueService {
  /**
   * Refresh the entire queue by calculating scores and populating with eligible users
   */
  async refreshQueue(): Promise<{ usersAdded: number; queueSize: number }> {
    // Use database transaction for atomicity
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      try {
        logger.info('Starting queue refresh');
        
        // Get eligible users for calling
        const eligibleUsers = await this.getEligibleUsers();
        logger.info(`Found ${eligibleUsers.length} eligible users`);
        
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
        
        logger.info(`Queue refresh complete: ${queueEntries.length} users added to queue`);
        
        return {
          usersAdded: queueEntries.length,
          queueSize: queueEntries.length
        };
      } catch (error) {
        logger.error('Queue refresh failed:', error);
        throw error;
      }
    });
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
        claimId: 67890,
        daysSinceLastContact: 7,
        pendingRequirements: 2,
        claimValue: 15000,
        lastOutcome: 'no_answer',
        totalAttempts: 1,
        preferredCallTime: [9, 17] // 9 AM to 5 PM
      },
      {
        userId: 23456,
        claimId: 78901,
        daysSinceLastContact: 14,
        pendingRequirements: 1,
        claimValue: 8000,
        lastOutcome: 'contacted',
        totalAttempts: 2
      },
      {
        userId: 34567,
        claimId: 89012,
        daysSinceLastContact: 3,
        pendingRequirements: 3,
        claimValue: 25000,
        lastOutcome: undefined, // First contact
        totalAttempts: 0
      },
      {
        userId: 45678,
        claimId: 90123,
        daysSinceLastContact: 21,
        pendingRequirements: 1,
        claimValue: 5000,
        lastOutcome: 'callback_requested',
        totalAttempts: 1,
        scheduledCallback: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
      },
      {
        userId: 56789,
        claimId: 12340,
        daysSinceLastContact: 35,
        pendingRequirements: 2,
        claimValue: 12000,
        lastOutcome: 'not_interested',
        totalAttempts: 3
      }
    ];
    
    return mockUsers;
  }
  
  /**
   * Calculate priority score for a user (lower score = higher priority)
   */
  private async calculatePriority(user: UserEligibilityFactors): Promise<ScoredUser> {
    let score = 0;
    const reasons: string[] = [];
    
    // Base score from days since last contact (decay function)
    const daysPenalty = Math.min(user.daysSinceLastContact * 2, 60);
    score += daysPenalty;
    
    // Pending requirements boost (more requirements = higher priority)
    const requirementBoost = user.pendingRequirements * 15;
    score -= requirementBoost;
    if (user.pendingRequirements > 0) {
      reasons.push(`${user.pendingRequirements}_pending_requirements`);
    }
    
    // Claim value factor (higher value = higher priority)
    if (user.claimValue > 10000) {
      score -= 20;
      reasons.push('high_value_claim');
    } else if (user.claimValue > 5000) {
      score -= 10;
      reasons.push('medium_value_claim');
    }
    
    // Previous call outcome penalties/bonuses
    const outcomeAdjustments: Record<string, number> = {
      'not_interested': 50,      // Much lower priority
      'no_answer': 10,           // Slight penalty
      'wrong_number': 100,       // Very low priority
      'callback_requested': -20,  // Higher priority (negative = boost)
      'contacted': 5             // Slight penalty (recently contacted)
    };
    
    if (user.lastOutcome && outcomeAdjustments[user.lastOutcome] !== undefined) {
      score += outcomeAdjustments[user.lastOutcome];
      reasons.push(`last_outcome_${user.lastOutcome}`);
    }
    
    // First-time contact boost
    if (user.totalAttempts === 0) {
      score -= 15;
      reasons.push('first_contact');
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
        
      case 'contacted':
        // Wait 24 hours after successful contact
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
      default:
        // Default: eligible immediately
        return now;
    }
  }
  
  /**
   * Update user call scores in database with bulk operations
   */
  private async updateUserCallScoresBulk(tx: Prisma.TransactionClient, scoredUsers: ScoredUser[]): Promise<void> {
    // Group users that need updates vs creates
    const existingScores = await tx.userCallScore.findMany({
      where: {
        userId: {
          in: scoredUsers.map(u => u.userId)
        }
      },
      select: { userId: true }
    });
    
    const existingUserIds = new Set(existingScores.map((s: { userId: bigint }) => Number(s.userId)));
    const usersToUpdate = scoredUsers.filter(u => existingUserIds.has(u.userId));
    const usersToCreate = scoredUsers.filter(u => !existingUserIds.has(u.userId));
    
    // Bulk update existing scores
    if (usersToUpdate.length > 0) {
      await Promise.all(
        usersToUpdate.map(user =>
          tx.userCallScore.update({
            where: { userId: user.userId },
            data: {
              currentScore: user.score,
              nextCallAfter: user.nextCallAfter,
              lastCallAt: user.lastCallAt || null,
              totalAttempts: user.totalAttempts,
              lastOutcome: user.lastOutcome || null,
              updatedAt: new Date()
            }
          })
        )
      );
    }
    
    // Bulk create new scores
    if (usersToCreate.length > 0) {
      await tx.userCallScore.createMany({
        data: usersToCreate.map(user => ({
          userId: user.userId,
          currentScore: user.score,
          nextCallAfter: user.nextCallAfter,
          lastCallAt: user.lastCallAt || null,
          totalAttempts: user.totalAttempts,
          successfulCalls: user.lastOutcome === 'contacted' ? 1 : 0,
          lastOutcome: user.lastOutcome || null,
          baseScore: user.score
        }))
      });
    }
  }
  
  /**
   * Get current queue with pagination and filtering
   */
  async getQueue(options: QueueOptions = {}) {
    const { limit = 20, status = 'pending', agentId } = options;
    
    const where: any = { status };
    if (agentId) {
      where.assignedToAgentId = agentId;
    }
    
    const [queue, total] = await Promise.all([
      prisma.callQueue.findMany({
        where,
        orderBy: [
          { priorityScore: 'asc' },
          { queuePosition: 'asc' },
          { createdAt: 'asc' }
        ],
        take: limit,
        include: {
          userCallScore: true
        }
      }),
      prisma.callQueue.count({ where })
    ]);
    
    // Enhance with user data (in production, this would join with replica data)
    const enhancedQueue = queue.map((item: any, index: number) => ({
      ...item,
      user: this.getMockUserData(Number(item.userId)),
      actualPosition: index + 1
    }));
    
    return {
      queue: enhancedQueue,
      total,
      hasMore: queue.length === limit && total > limit
    };
  }
  
  /**
   * Assign a call from queue to an agent
   */
  async assignCall(queueId: string, agentId: number) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Check if agent is available
      const agentSession = await tx.agentSession.findFirst({
        where: { agentId, status: 'available' }
      });
      
      if (!agentSession) {
        throw new Error('Agent is not available');
      }
      
      // Check if queue entry is still pending
      const queueEntry = await tx.callQueue.findUnique({
        where: { id: queueId }
      });
      
      if (!queueEntry) {
        throw new Error('Queue entry not found');
      }
      
      if (queueEntry.status !== 'pending') {
        throw new Error('Queue entry is no longer available');
      }
      
      // Update queue entry
      const updatedQueueEntry = await tx.callQueue.update({
        where: { id: queueId },
        data: {
          status: 'assigned',
          assignedToAgentId: agentId,
          assignedAt: new Date()
        },
        include: {
          userCallScore: true
        }
      });
      
      // Update agent status
      await tx.agentSession.updateMany({
        where: { agentId },
        data: { status: 'on_call' }
      });
      
      logger.info('Call assigned', {
        queueId,
        agentId,
        userId: updatedQueueEntry.userId,
        priorityScore: updatedQueueEntry.priorityScore
      });
      
      return {
        ...updatedQueueEntry,
        user: this.getMockUserData(Number(updatedQueueEntry.userId))
      };
    });
  }
  
  /**
   * Release a call back to the queue
   */
  async releaseCall(queueId: string, agentId: number): Promise<any> {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update queue entry back to pending
      const queueEntry = await tx.callQueue.update({
        where: { id: queueId, assignedToAgentId: agentId },
        data: {
          status: 'pending',
          assignedToAgentId: null,
          assignedAt: null
        }
      });
      
      // Update agent status back to available
      await tx.agentSession.updateMany({
        where: { agentId },
        data: { status: 'available' }
      });
      
      logger.info('Call released back to queue', {
        queueId,
        agentId,
        userId: queueEntry.userId
      });
      
      return queueEntry;
    });
  }
  
  /**
   * Get mock user data (will be replaced with replica query)
   */
  private getMockUserData(userId: number) {
    const mockUsers: Record<number, any> = {
      12345: {
        id: 12345,
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@email.com',
        phoneNumber: '+447700123456',
        address: {
          fullAddress: '123 High Street, London',
          postCode: 'SW1A 1AA',
          county: 'London'
        },
        claims: [{
          id: 67890,
          type: 'VEHICLE',
          status: 'documents_needed',
          lender: 'Santander Consumer Finance',
          requirements: [
            { type: 'ID_DOCUMENT', status: 'PENDING', reason: 'Proof of identity required' },
            { type: 'BANK_STATEMENTS', status: 'PENDING', reason: 'Last 3 months statements' }
          ]
        }]
      },
      23456: {
        id: 23456,
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.j@email.com',
        phoneNumber: '+447700234567',
        address: {
          fullAddress: '456 Queen Street, Manchester',
          postCode: 'M1 2AB',
          county: 'Greater Manchester'
        },
        claims: [{
          id: 78901,
          type: 'BANK_FRAUD',
          status: 'documents_needed',
          lender: 'Barclays Bank',
          requirements: [
            { type: 'BANK_STATEMENTS', status: 'PENDING', reason: 'Transaction evidence required' }
          ]
        }]
      },
      34567: {
        id: 34567,
        firstName: 'Michael',
        lastName: 'Brown',
        email: 'mike.brown@email.com',
        phoneNumber: '+447700345678',
        address: {
          fullAddress: '789 King Street, Birmingham',
          postCode: 'B1 1AA',
          county: 'West Midlands'
        },
        claims: [{
          id: 89012,
          type: 'VEHICLE',
          status: 'documents_needed',
          lender: 'Close Brothers Motor Finance',
          requirements: [
            { type: 'ID_DOCUMENT', status: 'PENDING', reason: 'Proof of identity required' },
            { type: 'VEHICLE_DOCS', status: 'PENDING', reason: 'V5C registration document' },
            { type: 'FINANCE_AGREEMENT', status: 'PENDING', reason: 'Original finance agreement' }
          ]
        }]
      },
      45678: {
        id: 45678,
        firstName: 'Emma',
        lastName: 'Wilson',
        email: 'emma.wilson@email.com',
        phoneNumber: '+447700456789',
        address: {
          fullAddress: '321 Church Lane, Leeds',
          postCode: 'LS1 2BC',
          county: 'West Yorkshire'
        },
        claims: [{
          id: 90123,
          type: 'CREDIT_CARD',
          status: 'documents_needed',
          lender: 'MBNA',
          requirements: [
            { type: 'CREDIT_STATEMENTS', status: 'PENDING', reason: 'Credit card statements required' }
          ]
        }]
      },
      56789: {
        id: 56789,
        firstName: 'David',
        lastName: 'Taylor',
        email: 'david.taylor@email.com',
        phoneNumber: '+447700567890',
        address: {
          fullAddress: '654 Park Road, Glasgow',
          postCode: 'G1 2CD',
          county: 'Glasgow'
        },
        claims: [{
          id: 12340,
          type: 'LOAN',
          status: 'documents_needed',
          lender: 'Provident Personal Credit',
          requirements: [
            { type: 'ID_DOCUMENT', status: 'PENDING', reason: 'Proof of identity required' },
            { type: 'BANK_STATEMENTS', status: 'PENDING', reason: 'Last 3 months statements' }
          ]
        }]
      }
    };
    
    return mockUsers[userId] || {
      id: userId,
      firstName: 'Unknown',
      lastName: 'User',
      email: `user${userId}@email.com`,
      phoneNumber: '+447700000000',
      claims: []
    };
  }
}

export const queueService = new QueueService(); 