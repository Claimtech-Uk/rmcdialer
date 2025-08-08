import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import { UserService } from '@/modules/users/services/user.service';
import type { QueueType } from '../types/queue.types';
import type { QueueAdapterService } from './queue-adapter.service';
import { createMissedCallService } from '@/modules/missed-calls/services/missed-call.service';

export interface PreCallValidationResult {
  isValid: boolean;
  reason?: string;
  currentQueueType?: QueueType | null;
  userStatus: {
    hasSignature: boolean;
    pendingRequirements: number;
    hasScheduledCallback: boolean;
    isEnabled: boolean;
    userExists: boolean;
  };
}

export interface NextUserForCallResult {
  userId: number;
  userContext: any;
  queuePosition: number;
  queueEntryId: string;
  validationResult: PreCallValidationResult;
}

/**
 * @deprecated This service is redundant with queue-specific validation.
 * Each queue service now handles its own validation internally via:
 * - UnsignedUsersQueueService.validateUserForUnsignedQueue()
 * - OutstandingRequestsQueueService.validateUserForOutstandingQueue()
 * Remove after updating health checks and queue adapter.
 */
export class PreCallValidationService {
  private userService: UserService;
  private queueAdapter: QueueAdapterService | null = null;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Set queue adapter for integration with new queue system
   */
  setQueueAdapter(queueAdapter: QueueAdapterService): void {
    this.queueAdapter = queueAdapter;
  }

  /**
   * Add penalty score for users with all cancelled claims
   */
  private async penalizeUserForCancelledClaims(userId: number): Promise<void> {
    try {
      // Update user_call_scores - add 200 penalty points
      await prisma.userCallScore.updateMany({
        where: { userId: BigInt(userId) },
        data: {
          currentScore: { increment: 200 },
          lastOutcome: 'All claims cancelled',
          updatedAt: new Date()
        }
      });

      // Also mark in both queue tables as inactive to prevent future attempts
      await Promise.all([
        prisma.callQueue.updateMany({
          where: { 
            userId: BigInt(userId),
            status: 'pending'
          },
          data: {
            status: 'invalid',
            queueReason: 'All claims cancelled',
            updatedAt: new Date()
          }
        })
      ]);
      
      console.log(`📈 Added 200 penalty points to user ${userId} for all cancelled claims`);
      
    } catch (error) {
      console.error(`❌ Failed to penalize user ${userId} for cancelled claims:`, error);
      // Don't throw - this is cleanup, continue with validation
    }
  }

  /**
   * Validate user is still eligible for calling RIGHT NOW
   * This is called immediately before agent dials the number
   */
  async validateUserForCall(userId: number, expectedQueueType: QueueType): Promise<PreCallValidationResult> {
    try {
      console.log(`🔍 Validating user ${userId} for ${expectedQueueType} queue...`);

      // 1. Get current user state from MySQL replica (real-time)
      const userData = await replicaDb.user.findUnique({
        where: { id: BigInt(userId) },
        include: {
          claims: {
            select: {
              id: true,
              status: true,
              requirements: {
                where: { status: 'PENDING' }
              }
            }
          }
        }
      });

      if (!userData) {
        console.log(`❌ User ${userId} not found in database`);
        return {
          isValid: false,
          reason: 'User not found in database',
          userStatus: {
            hasSignature: false,
            pendingRequirements: 0,
            hasScheduledCallback: false,
            isEnabled: false,
            userExists: false
          }
        };
      }

      if (!userData.is_enabled) {
        console.log(`❌ User ${userId} is disabled`);
        return {
          isValid: false,
          reason: 'User account is disabled',
          userStatus: {
            hasSignature: !!userData.current_signature_file_id,
            pendingRequirements: 0,
            hasScheduledCallback: false,
            isEnabled: false,
            userExists: true
          }
        };
      }

      // 2. Check if ALL claims are cancelled
      if (userData.claims.length > 0) {
        const allClaimsCancelled = userData.claims.every(claim => claim.status === 'cancelled');
        if (allClaimsCancelled) {
          console.log(`❌ User ${userId} has all claims cancelled (${userData.claims.length} claims) - adding penalty and skipping`);
          await this.penalizeUserForCancelledClaims(userId);
          return {
            isValid: false,
            reason: 'All claims cancelled',
            userStatus: {
              hasSignature: !!userData.current_signature_file_id,
              pendingRequirements: 0,
              hasScheduledCallback: false,
              isEnabled: true,
              userExists: true
            }
          };
        }
      }

      // 3. Check for scheduled callbacks that take priority
      const scheduledCallback = await prisma.callback.findFirst({
        where: {
          userId: BigInt(userId),
          status: 'pending',
          scheduledFor: { lte: new Date() }
        }
      });

      // 4. Determine current eligibility
      const hasSignature = userData.current_signature_file_id !== null;
      
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

      const userStatus = {
        hasSignature,
        pendingRequirements,
        hasScheduledCallback: !!scheduledCallback,
        isEnabled: userData.is_enabled,
        userExists: true
      };

      // 5. Determine current queue type based on actual state
      let currentQueueType: QueueType | null = null;
      
      if (scheduledCallback) {
        // User has callback - they go in their appropriate queue with callback priority
        if (!hasSignature) {
          currentQueueType = 'unsigned_users';
        } else if (pendingRequirements > 0) {
          currentQueueType = 'outstanding_requests';
        } else {
          currentQueueType = 'outstanding_requests'; // Default for callbacks
        }
      } else if (!hasSignature) {
        currentQueueType = 'unsigned_users';
      } else if (pendingRequirements > 0) {
        currentQueueType = 'outstanding_requests';
      } else {
        currentQueueType = null; // User doesn't need to be in any queue
      }

      // 6. Validate against expected queue type
      const isValid = currentQueueType === expectedQueueType;

      if (isValid) {
        console.log(`✅ User ${userId} is valid for ${expectedQueueType} queue`);
      } else {
        console.log(`❌ User ${userId} moved from ${expectedQueueType} to ${currentQueueType || 'none'}`);
      }

      return {
        isValid,
        reason: isValid ? undefined : `User moved from ${expectedQueueType} to ${currentQueueType || 'none'}`,
        currentQueueType,
        userStatus
      };

    } catch (error) {
      console.error(`❌ Pre-call validation failed for user ${userId}:`, error);
      return {
        isValid: false,
        reason: 'Validation error - please try another user',
        userStatus: {
          hasSignature: false,
          pendingRequirements: 0,
          hasScheduledCallback: false,
          isEnabled: false,
          userExists: false
        }
      };
    }
  }

  /**
   * Get the next valid user from queue for calling
   * 🎯 PRIORITY: Check missed calls FIRST, then regular queues
   * Uses QueueAdapterService when available, falls back to legacy CallQueue
   */
  async getNextValidUserForCall(queueType: QueueType, agentId?: number): Promise<NextUserForCallResult | null> {
    try {
      console.log(`🔍 Finding next valid user for ${queueType} queue...`);
      
      // 🎯 PRIORITY 1: Check for missed calls first (if agent ID provided)
      if (agentId) {
        const missedCallResult = await this.getNextMissedCallForAgent(agentId);
        if (missedCallResult) {
          console.log(`🚀 PRIORITY: Found missed call for agent ${agentId}`);
          return missedCallResult;
        }
      }
      
      // 🎯 PRIORITY 2: Use regular queue system
      console.log(`📋 No missed calls available, checking ${queueType} queue...`);
      
      // Use new queue adapter if available
      if (this.queueAdapter) {
        return await this.getNextValidUserFromAdapter(queueType, agentId);
      }
      
      // Fallback to legacy CallQueue method
      return await this.getNextValidUserFromLegacy(queueType);

    } catch (error) {
      console.error(`❌ Error getting next valid user for ${queueType}:`, error);
      return null;
    }
  }

  /**
   * Get next valid user using QueueAdapterService (preferred method)
   */
  private async getNextValidUserFromAdapter(queueType: QueueType, agentId?: number): Promise<NextUserForCallResult | null> {
    console.log(`🔄 Using QueueAdapterService for ${queueType} queue`);
    
    const maxAttempts = 5; // Prevent infinite loops
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔍 Attempt ${attempt}/${maxAttempts} to find valid user...`);
      
      // 1. Get next user from queue adapter
      const user = await this.queueAdapter!.getNextUserForCall({ queueType, agentId });
      if (!user) {
        console.log(`📭 No more users in ${queueType} queue`);
        return null;
      }
      
      console.log(`🔍 Validating user ${user.userId} from queue adapter...`);
      
      // 2. Validate user against MySQL replica
      const validation = await this.validateUserForCall(user.userId, queueType);
      
      if (validation.isValid) {
        // Get complete user context for the call
        const userServiceContext = await this.userService.getUserCallContext(user.userId);
        
        if (userServiceContext) {
          console.log(`✅ Found valid user ${user.userId} for ${queueType} queue`);
          
          // Transform from users module format (nested) to calls module format (flat)
          // This ensures compatibility with auto dialler and other components expecting flat structure
          const userContext = {
            userId: userServiceContext.user.id,
            firstName: userServiceContext.user.firstName || 'Unknown',
            lastName: userServiceContext.user.lastName || 'User',
            email: userServiceContext.user.email || `user${user.userId}@unknown.com`,
            phoneNumber: userServiceContext.user.phoneNumber || '+44000000000',
            createdAt: userServiceContext.user.createdAt,
            address: userServiceContext.user.address ? {
              fullAddress: userServiceContext.user.address.fullAddress || '',
              postCode: userServiceContext.user.address.postCode || '',
              county: userServiceContext.user.address.county || ''
            } : undefined,
            claims: userServiceContext.claims.map(claim => ({
              id: claim.id,
              type: claim.type || 'unknown',
              status: claim.status || 'unknown',
              lender: claim.lender || 'unknown',
              value: 0, // Not available in users module data
              requirements: claim.requirements.map(req => ({
                id: req.id,
                type: req.type || 'unknown',
                status: req.status || 'unknown',
                reason: req.reason || 'No reason provided'
              }))
            })),
            callScore: userServiceContext.callScore ? {
              currentScore: userServiceContext.callScore.currentScore,
              totalAttempts: userServiceContext.callScore.totalAttempts,
              lastOutcome: userServiceContext.callScore.lastOutcome || 'no_attempt'
            } : {
              currentScore: 50,
              totalAttempts: 0,
              lastOutcome: 'no_attempt'
            }
          };
          
          return {
            userId: user.userId,
            userContext,
            queuePosition: user.queuePosition,
            queueEntryId: user.queueEntryId,
            validationResult: validation
          };
        } else {
          console.log(`⚠️ User ${user.userId} context not available, skipping...`);
        }
      } else {
        console.log(`❌ User ${user.userId} no longer valid for ${queueType}: ${validation.reason}`);
        // Note: In a complete implementation, we might remove the user from queue here
        // For now, we'll just skip to the next user
      }
    }
    
    console.log(`⚠️ Exhausted ${maxAttempts} attempts to find valid user in ${queueType} queue`);
    return null;
  }

  /**
   * Legacy method: Get next valid user from CallQueue table directly
   */
  private async getNextValidUserFromLegacy(queueType: QueueType): Promise<NextUserForCallResult | null> {
    console.log(`🔄 Using legacy CallQueue for ${queueType} queue`);
    
    const queueEntries = await prisma.callQueue.findMany({
      where: {
        queueType,
        status: 'pending'
      },
      orderBy: [
        { priorityScore: 'asc' },
        { queuePosition: 'asc' }
      ],
      take: 10 // Check up to 10 users to find a valid one
    });

    console.log(`Found ${queueEntries.length} queue entries to validate`);

    for (const entry of queueEntries) {
      const userId = Number(entry.userId);
      console.log(`🔍 Validating queue entry ${entry.id} for user ${userId}...`);
      
      const validation = await this.validateUserForCall(userId, queueType);
      
      if (validation.isValid) {
        // Get complete user context for the call
        const userContext = await this.userService.getUserCallContext(userId);
        
        if (userContext) {
          console.log(`✅ Found valid user ${userId} for ${queueType} queue`);
          return {
            userId,
            userContext,
            queuePosition: entry.queuePosition || 0,
            queueEntryId: entry.id,
            validationResult: validation
          };
        } else {
          console.log(`⚠️ User ${userId} context not available, skipping...`);
        }
      } else {
        console.log(`❌ User ${userId} no longer valid for ${queueType}: ${validation.reason}`);
        
        // Remove invalid user from queue
        await prisma.callQueue.deleteMany({
          where: { 
            userId: entry.userId,
            queueType 
          }
        });
        console.log(`🗑️ Removed invalid user ${userId} from ${queueType} queue`);
      }
    }

    console.log(`📭 No valid users found in ${queueType} queue`);
    return null;
  }

  /**
   * Get the next valid user directly from MySQL replica (simplified mode)
   * This bypasses the PostgreSQL queue and works directly with real data
   */
  async getNextValidUserDirectFromReplica(queueType: QueueType): Promise<NextUserForCallResult | null> {
    try {
      console.log(`🔍 Finding next valid user for ${queueType} queue directly from replica...`);
      
      let users: any[] = [];
      
      if (queueType === 'unsigned_users') {
        // Get unsigned users directly from MySQL replica
        users = await replicaDb.user.findMany({
          where: {
            is_enabled: true,
            current_signature_file_id: null,
            claims: {
              some: {
                status: { not: 'complete' }
              }
            }
          },
          include: {
            claims: {
              include: {
                requirements: {
                  where: { status: 'PENDING' }
                }
              }
            }
          },
          orderBy: { created_at: 'desc' }, // Newest first
          take: 5 // Get top 5 candidates
        });
      } else if (queueType === 'outstanding_requests') {
        // Get users with pending requirements but have signatures
        // NOTE: This query gets candidates - detailed filtering (excluding id_document with 
        // 'base requirement for claim.' reason and other excluded types) happens in validateUserForCall()
        users = await replicaDb.user.findMany({
          where: {
            is_enabled: true,
            current_signature_file_id: { not: null },
            claims: {
              some: {
                requirements: {
                  some: {
                    status: 'PENDING'
                  }
                }
              }
            }
          },
          include: {
            claims: {
              include: {
                requirements: {
                  where: { status: 'PENDING' }
                }
              }
            }
          },
          orderBy: { created_at: 'desc' }, // Newest first
          take: 5 // Get top 5 candidates
        });
      } else if (queueType === 'callback') {
        // For callbacks, we'd need PostgreSQL, so return null for now
        console.log(`📞 Callback queue requires PostgreSQL - returning null`);
        return null;
      }

      if (users.length === 0) {
        console.log(`❌ No users found for ${queueType} queue`);
        return null;
      }

      // Take the first user (could add more sophisticated scoring later)
      const selectedUser = users[0];
      const userId = Number(selectedUser.id);

      // Validate the selected user (double-check they're still eligible)
      const validation = await this.validateUserForCall(userId, queueType);
      
      if (!validation.isValid) {
        console.log(`❌ Selected user ${userId} is no longer valid: ${validation.reason}`);
        
        // Try the next user
        for (let i = 1; i < users.length; i++) {
          const nextUser = users[i];
          const nextUserId = Number(nextUser.id);
          const nextValidation = await this.validateUserForCall(nextUserId, queueType);
          
          if (nextValidation.isValid) {
            console.log(`✅ Found valid user ${nextUserId} on retry`);
            return await this.buildUserContextResult(nextUser, nextValidation, i + 1);
          }
        }
        
        console.log(`❌ No valid users found after checking ${users.length} candidates`);
        return null;
      }

      console.log(`✅ Found valid user ${userId} for ${queueType} queue`);
      return await this.buildUserContextResult(selectedUser, validation, 1);

    } catch (error) {
      console.error(`❌ Error finding next valid user for ${queueType}:`, error);
      return null;
    }
  }

  /**
   * Mark a queue entry as invalid and update the reason
   */
  private async markQueueEntryInvalid(queueEntryId: string, reason: string): Promise<void> {
    try {
      await prisma.callQueue.update({
        where: { id: queueEntryId },
        data: { 
          status: 'invalid',
          queueReason: reason,
          updatedAt: new Date()
        }
      });
      console.log(`📝 Marked queue entry ${queueEntryId} as invalid: ${reason}`);
    } catch (error) {
      console.error(`❌ Failed to mark queue entry ${queueEntryId} as invalid:`, error);
    }
  }

  /**
   * Validate multiple users in batch (for queue health checks)
   */
  async validateQueueHealth(queueType: QueueType, limit: number = 50): Promise<{
    totalChecked: number;
    validUsers: number;
    invalidUsers: number;
    invalidEntries: Array<{ userId: number; reason: string; queueEntryId: string }>;
  }> {
    try {
      console.log(`🏥 Running health check for ${queueType} queue (limit: ${limit})...`);

      const queueEntries = await prisma.callQueue.findMany({
        where: {
          queueType,
          status: 'pending'
        },
        orderBy: [
          { priorityScore: 'asc' },
          { queuePosition: 'asc' }
        ],
        take: limit
      });

      let validUsers = 0;
      let invalidUsers = 0;
      const invalidEntries: Array<{ userId: number; reason: string; queueEntryId: string }> = [];

      for (const entry of queueEntries) {
        const userId = Number(entry.userId);
        const validation = await this.validateUserForCall(userId, queueType);
        
        if (validation.isValid) {
          validUsers++;
        } else {
          invalidUsers++;
          invalidEntries.push({
            userId,
            reason: validation.reason || 'Unknown validation error',
            queueEntryId: entry.id
          });
          
          // Mark as invalid in database
          await this.markQueueEntryInvalid(entry.id, validation.reason || 'Health check failed');
        }
      }

      console.log(`🏥 Health check complete for ${queueType}: ${validUsers} valid, ${invalidUsers} invalid`);

      return {
        totalChecked: queueEntries.length,
        validUsers,
        invalidUsers,
        invalidEntries
      };
    } catch (error) {
      console.error(`❌ Queue health check failed for ${queueType}:`, error);
      return {
        totalChecked: 0,
        validUsers: 0,
        invalidUsers: 0,
        invalidEntries: []
      };
    }
  }

  /**
   * Get queue statistics with validation status
   */
  async getQueueStatistics(queueType?: QueueType): Promise<{
    queueStats: Array<{
      queueType: QueueType;
      totalPending: number;
      totalInvalid: number;
      lastUpdated: Date;
    }>;
  }> {
    try {
      const queueTypes: QueueType[] = queueType ? [queueType] : ['unsigned_users', 'outstanding_requests'];
      
      const queueStats = await Promise.all(
        queueTypes.map(async (type) => {
          const [totalPending, totalInvalid] = await Promise.all([
            prisma.callQueue.count({
              where: { queueType: type, status: 'pending' }
            }),
            prisma.callQueue.count({
              where: { queueType: type, status: 'invalid' }
            })
          ]);

          return {
            queueType: type,
            totalPending,
            totalInvalid,
            lastUpdated: new Date()
          };
        })
      );

      return { queueStats };
    } catch (error) {
      console.error(`❌ Failed to get queue statistics:`, error);
      return { queueStats: [] };
    }
  }

  /**
   * Build user context result from MySQL replica data (simplified version)
   */
  private async buildUserContextResult(userData: any, validation: PreCallValidationResult, position: number): Promise<NextUserForCallResult> {
    // Build simplified user context directly from MySQL data
    const userContext = {
      user: {
        id: Number(userData.id),
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        phoneNumber: userData.phone_number,
        dateOfBirth: userData.date_of_birth,
        isEnabled: userData.is_enabled,
        hasSignature: !!userData.current_signature_file_id,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      },
      claims: userData.claims.map((claim: any) => ({
        id: Number(claim.id),
        claimNumber: claim.claim_number,
        status: claim.status,
        vehicleReg: claim.vehicle_reg,
        incidentDate: claim.incident_date,
        requirements: claim.requirements.map((req: any) => ({
          id: Number(req.id),
          type: req.type,
          status: req.status,
          description: req.description,
          createdAt: req.created_at
        })),
        vehiclePackages: claim.vehiclePackages || []
      })),
      addresses: userData.address ? [{
        id: Number(userData.address.id),
        addressLine1: userData.address.address_line_1,
        addressLine2: userData.address.address_line_2,
        city: userData.address.city,
        postcode: userData.address.postcode,
        country: userData.address.country
      }] : [],
      callScore: null // We'll add this later when PostgreSQL is available
    };

    return {
      userId: Number(userData.id),
      userContext,
      queuePosition: position,
      queueEntryId: `replica-${userData.id}`, // Synthetic queue entry ID
      validationResult: validation
    };
  }

  // ============================================================================
  // MISSED CALLS PRIORITY SYSTEM
  // ============================================================================

  /**
   * 🎯 Get next missed call for agent (PRIORITY over regular queue)
   * Returns formatted result compatible with NextUserForCallResult
   */
  private async getNextMissedCallForAgent(agentId: number): Promise<NextUserForCallResult | null> {
    try {
      console.log(`🔍 PRIORITY: Checking for missed calls for agent ${agentId}...`);
      
      const missedCallService = createMissedCallService(prisma);
      const missedCall = await missedCallService.findAndAssignNextMissedCall(agentId);
      
      if (!missedCall) {
        console.log(`📭 No missed calls available for agent ${agentId}`);
        return null;
      }

      console.log(`🚀 PRIORITY: Found missed call for ${missedCall.phoneNumber}, reason: ${missedCall.reason}`);
      
      // Get user context from services if userId is available (FULL context with claims)
      let userContext = null;
      let validatedUserId = null;

      if (missedCall.userId) {
        try {
          // Validate user exists quickly
          const userData = await replicaDb.user.findUnique({
            where: { id: BigInt(missedCall.userId) },
            select: { id: true }
          });

          if (userData) {
            validatedUserId = Number(userData.id);
            // Fetch full call context (includes claims, address, callScore)
            const fullContext = await this.userService.getUserCallContext(validatedUserId);
            if (fullContext) {
              userContext = {
                userId: fullContext.user.id,
                firstName: fullContext.user.firstName || 'Unknown',
                lastName: fullContext.user.lastName || 'User',
                email: fullContext.user.email || `user${validatedUserId}@unknown.com`,
                // Prefer missed call number if present
                phoneNumber: missedCall.phoneNumber || fullContext.user.phoneNumber || '+44000000000',
                // Keep compatibility fields some components might read
                phone: missedCall.phoneNumber || fullContext.user.phoneNumber || '+44000000000',
                createdAt: fullContext.user.createdAt,
                address: fullContext.user.address ? {
                  fullAddress: fullContext.user.address.fullAddress || '',
                  postCode: fullContext.user.address.postCode || '',
                  county: fullContext.user.address.county || ''
                } : undefined,
                claims: fullContext.claims.map(claim => ({
                  id: claim.id,
                  type: claim.type || 'unknown',
                  status: claim.status || 'unknown',
                  lender: claim.lender || 'unknown',
                  value: 0,
                  requirements: claim.requirements.map(req => ({
                    id: req.id,
                    type: req.type || 'unknown',
                    status: req.status || 'unknown',
                    reason: req.reason || 'No reason provided'
                  }))
                })),
                callScore: fullContext.callScore ? {
                  currentScore: fullContext.callScore.currentScore,
                  totalAttempts: fullContext.callScore.totalAttempts,
                  lastOutcome: fullContext.callScore.lastOutcome || 'no_attempt'
                } : {
                  currentScore: 50,
                  totalAttempts: 0,
                  lastOutcome: 'no_attempt'
                }
              };
              console.log(`✅ Built full user context for missed call user ${fullContext.user.firstName} ${fullContext.user.lastName}`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to get full user context for missed call userId ${missedCall.userId}:`, error);
        }
      }

      // If no user context from DB, create minimal context from missed call data
      if (!userContext) {
        // Try to extract name parts if available
        const nameParts = missedCall.callerName ? missedCall.callerName.split(' ') : [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        userContext = {
          userId: validatedUserId || 999999, // Special ID for unknown callers
          firstName,
          lastName,
          email: '',
          // Ensure both for backward-compat, UI expects phoneNumber
          phone: missedCall.phoneNumber,
          phoneNumber: missedCall.phoneNumber,
          claimCount: 0,
          claims: [],
          addresses: [],
          // Provide safe defaults so UI does not crash
          callScore: {
            currentScore: 50,
            totalAttempts: 0,
            lastOutcome: 'no_attempt'
          }
        };
        
        console.log(`📝 Created minimal user context for missed call: ${firstName} ${lastName}`);
      }

      // Return in NextUserForCallResult format with special markers for missed calls
      return {
        userId: userContext.userId,
        userContext: {
          ...userContext,
          // 🎯 SPECIAL MARKERS for missed call callbacks
          isMissedCallCallback: true,
          missedCallData: {
            id: missedCall.id,
            reason: missedCall.reason,
            missedAt: missedCall.missedAt,
            originalCallSid: missedCall.twilioCallSid
          }
        },
        queuePosition: 0, // Missed calls always have highest priority
        queueEntryId: `missed-call-${missedCall.id}`,
        validationResult: {
          isValid: true,
          reason: 'Missed call callback - skipping validation',
          userStatus: {
            hasSignature: true, // Skip signature checks for missed calls
            pendingRequirements: 0,
            hasScheduledCallback: false,
            isEnabled: true,
            userExists: true // Missed calls always come from real users
          }
        }
      };

    } catch (error) {
      console.error(`❌ Error getting missed call for agent ${agentId}:`, error);
      return null;
    }
  }
} 