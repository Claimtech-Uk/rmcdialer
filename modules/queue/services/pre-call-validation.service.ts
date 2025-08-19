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
   * 🎯 PHASE 1: Get basic user data for both missed calls and callbacks
   * Fast, reliable, consistent approach using simple MySQL replica lookup
   * This ensures callbacks/missed calls NEVER fail due to data issues
   */
  private async getBasicUserForCallback(userId: number): Promise<{
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email: string;
    isEnabled: boolean;
  } | null> {
    try {
      console.log(`🔍 Getting basic user data for ${userId} from MySQL replica...`);
      
      const userData = await replicaDb.user.findUnique({
        where: { id: BigInt(userId) },
        select: {
          first_name: true,
          last_name: true,
          phone_number: true,
          email_address: true,
          is_enabled: true
        }
      });

      if (!userData || !userData.is_enabled) {
        console.log(`❌ User ${userId} not found or disabled in MySQL replica`);
        return null;
      }

      console.log(`✅ Found user data: ${userData.first_name} ${userData.last_name} - ${userData.phone_number}`);

      return {
        firstName: userData.first_name || 'Unknown',
        lastName: userData.last_name || 'User', 
        phoneNumber: userData.phone_number || '+44000000000',
        email: userData.email_address || `user${userId}@unknown.com`,
        isEnabled: userData.is_enabled
      };
    } catch (error) {
      console.error(`❌ Failed to get basic user data for ${userId}:`, error);
      return null;
    }
  }

  /**
   * 🎯 PHASE 2: Try to enrich basic context with full data for call interface
   * This attempts to get claims, addresses, etc. but gracefully falls back if it fails
   * The call interface needs this rich context but it shouldn't break callbacks/missed calls
   */
  private async enrichUserContext(basicContext: any, userId: number): Promise<any> {
    try {
      console.log(`🔧 Attempting to enrich user context for ${userId}...`);
      
      // Try to get full context with shorter timeout to avoid hanging
      const fullContext = await Promise.race([
        this.userService.getUserCallContext(userId, { 
          includeAddress: true, 
          includeRequirementDetails: true 
        }),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Context enrichment timeout')), 3000) // 3 second timeout
        )
      ]);

      if (fullContext) {
        console.log(`✅ Successfully enriched context for ${userId} with ${fullContext.claims.length} claims`);
        
        // Merge basic context (reliable) with full context (rich)
        return {
          userId: basicContext.userId,
          firstName: basicContext.firstName,
          lastName: basicContext.lastName,
          email: basicContext.email,
          phoneNumber: basicContext.phoneNumber, // Keep reliable phone number
          phone: basicContext.phoneNumber,
          dateOfBirth: fullContext.user.dateOfBirth,
          createdAt: fullContext.user.createdAt,
          isEnabled: fullContext.user.isEnabled,
          // Rich data from full context
          address: fullContext.user.address,
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
          callScore: fullContext.callScore || {
            currentScore: basicContext.callScore?.currentScore || 50,
            totalAttempts: 0,
            lastOutcome: basicContext.callScore?.lastOutcome || 'no_attempt'
          }
        };
      } else {
        console.log(`⚠️ Context enrichment failed for ${userId}, using basic context`);
        return basicContext;
      }
    } catch (error) {
      console.warn(`⚠️ Context enrichment failed for ${userId}:`, error);
      console.log(`🛡️ Falling back to basic context - call will still proceed`);
      return basicContext;
    }
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
      
      // 🥇 PRIORITY 1: Check for due callbacks first 
      const callbackResult = await this.getNextDueCallbackForQueue(queueType);
      if (callbackResult) {
        console.log(`🎯 HIGHEST PRIORITY: Found due callback for ${queueType} queue`);
        return callbackResult;
      }
      
      // 🥈 PRIORITY 2: Check for missed calls (if agent ID provided)
      if (agentId) {
        const missedCallResult = await this.getNextMissedCallForAgent(agentId);
        if (missedCallResult) {
          console.log(`🚀 MEDIUM PRIORITY: Found missed call for agent ${agentId}`);
          return missedCallResult;
        }
      }
      
      // 🥉 PRIORITY 3: Use regular queue system
      console.log(`📋 No callbacks or missed calls available, checking regular ${queueType} queue...`);
      
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
  // MISSED CALLS PRIORITY SYSTEM (UPDATED TO USE HYBRID APPROACH)
  // ============================================================================

  /**
   * 🎯 Get next missed call for agent (PRIORITY over regular queue)
   * Returns formatted result compatible with NextUserForCallResult
   * UPDATED: Uses hybrid approach - simple lookup + enrichment
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
      
      let userContext;
      let validatedUserId = null;

      // 🎯 PHASE 1: Simple user lookup for reliability
      if (missedCall.userId) {
        validatedUserId = Number(missedCall.userId);
        const basicUser = await this.getBasicUserForCallback(validatedUserId);
        
        if (basicUser) {
          console.log(`✅ Found basic user data for missed call: ${basicUser.firstName} ${basicUser.lastName}`);
          
          // Create basic context with reliable data
          userContext = {
            userId: validatedUserId,
            firstName: basicUser.firstName,
            lastName: basicUser.lastName,
            email: basicUser.email,
            phoneNumber: missedCall.phoneNumber || basicUser.phoneNumber, // Prefer missed call phone
            phone: missedCall.phoneNumber || basicUser.phoneNumber,
            claims: [], // Will be enriched in Phase 2
            addresses: [],
            callScore: {
              currentScore: 50,
              totalAttempts: 0,
              lastOutcome: 'missed_call'
            }
          };
          
          // 🎯 PHASE 2: Try to enrich with full context (claims, addresses, etc.)
          userContext = await this.enrichUserContext(userContext, validatedUserId);
        }
      }

      // If no user data available, create minimal context from missed call data
      if (!userContext) {
        const nameParts = missedCall.callerName ? missedCall.callerName.split(' ') : [];
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || 'Caller';
        
        userContext = {
          userId: validatedUserId || 999999, // Special ID for unknown callers
          firstName,
          lastName,
          email: '',
          phoneNumber: missedCall.phoneNumber,
          phone: missedCall.phoneNumber,
          claims: [],
          addresses: [],
          callScore: {
            currentScore: 50,
            totalAttempts: 0,
            lastOutcome: 'missed_call'
          }
        };
        
        console.log(`📝 Created minimal context for missed call: ${firstName} ${lastName} - ${missedCall.phoneNumber}`);
      }

      return {
        userId: userContext.userId,
        userContext: {
          ...userContext,
          isMissedCallCallback: true,
          missedCallData: {
            id: missedCall.id,
            reason: missedCall.reason,
            missedAt: missedCall.missedAt,
            originalCallSid: missedCall.twilioCallSid
          }
        },
        queuePosition: 0,
        queueEntryId: `missed-call-${missedCall.id}`,
        validationResult: {
          isValid: true,
          reason: 'Missed call callback - skipping validation',
          userStatus: {
            hasSignature: true,
            pendingRequirements: 0,
            hasScheduledCallback: false,
            isEnabled: true,
            userExists: true
          }
        }
      };

    } catch (error) {
      console.error(`❌ Error getting missed call for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Get next due callback for the specified queue type
   * Returns callback formatted as NextUserForCallResult for consistent interface
   * UPDATED: Uses hybrid approach - simple lookup + enrichment
   */
  private async getNextDueCallbackForQueue(queueType: QueueType): Promise<NextUserForCallResult | null> {
    try {
      const dueCallback = await prisma.callback.findFirst({
        where: {
          queueType: queueType, // Only callbacks for this specific queue
          status: 'pending',
          scheduledFor: { lte: new Date() } // Due now or overdue
        },
        orderBy: { scheduledFor: 'asc' }, // Oldest due first
        include: {
          preferredAgent: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (!dueCallback) {
        return null;
      }

      // 🎯 PHASE 1: Simple user lookup for reliability
      const callbackUserId = Number(dueCallback.userId);
      console.log(`🔍 Getting basic user data for callback ${dueCallback.id}, user ${callbackUserId}...`);
      
      const basicUser = await this.getBasicUserForCallback(callbackUserId);
      
      let userContext;
      
      if (basicUser) {
        console.log(`✅ Found basic user data for callback: ${basicUser.firstName} ${basicUser.lastName} - ${basicUser.phoneNumber}`);
        
        // Create basic context with reliable data
        userContext = {
          userId: callbackUserId,
          firstName: basicUser.firstName,
          lastName: basicUser.lastName,
          email: basicUser.email,
          phoneNumber: basicUser.phoneNumber, // ✅ REAL phone number from MySQL!
          claims: [], // Will be enriched in Phase 2
          addresses: [],
          callScore: {
            currentScore: 0, // Callbacks have highest priority
            totalAttempts: 0,
            lastOutcome: 'callback_scheduled'
          }
        };
        
        // 🎯 PHASE 2: Try to enrich with full context (claims, addresses, etc.)
        userContext = await this.enrichUserContext(userContext, callbackUserId);
      } else {
        console.log(`⚠️ User ${callbackUserId} not found in MySQL - creating minimal fallback`);
        
        userContext = {
          userId: callbackUserId,
          firstName: 'Callback',
          lastName: 'User',
          email: `callback-user-${callbackUserId}@unknown.com`,
          phoneNumber: '+44000000000', // Final fallback only
          claims: [],
          addresses: [],
          callScore: {
            currentScore: 0,
            totalAttempts: 0,
            lastOutcome: 'callback_scheduled'
          }
        };
        
        console.log(`🛡️ Created minimal fallback context for callback ${dueCallback.id}`);
      }

      return {
        userId: userContext.userId,
        userContext: {
          ...userContext,
          isCallbackCall: true,
          callbackData: {
            id: dueCallback.id,
            reason: dueCallback.callbackReason,
            scheduledFor: dueCallback.scheduledFor,
            originalCallSessionId: dueCallback.originalCallSessionId
          }
        },
        queuePosition: 0,
        queueEntryId: `callback-${dueCallback.id}`,
        validationResult: {
          isValid: true,
          reason: 'Scheduled callback - skipping validation',
          userStatus: {
            hasSignature: true,
            pendingRequirements: 0,
            hasScheduledCallback: true,
            isEnabled: true,
            userExists: true
          }
        }
      };

    } catch (error) {
      console.error(`❌ Error getting due callback for queue ${queueType}:`, error);
      return null;
    }
  }
}