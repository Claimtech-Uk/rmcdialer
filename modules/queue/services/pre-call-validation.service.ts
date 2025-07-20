import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import { UserService } from '@/modules/users/services/user.service';
import type { QueueType } from '../types/queue.types';

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

export class PreCallValidationService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
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
            include: {
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

      // 4. Check for scheduled callbacks (with error handling for PostgreSQL)
      let scheduledCallback = null;
      try {
        scheduledCallback = await prisma.callback.findFirst({
          where: {
            userId: BigInt(userId),
            status: 'pending',
            scheduledFor: { lte: new Date() }
          }
        });
      } catch (error: any) {
        console.log(`⚠️ Could not check callbacks for user ${userId}: ${error.message}`);
        // Continue without callback check - PostgreSQL might not be running
        // This is acceptable for direct replica mode
      }

      // 3. Determine current eligibility
      const hasSignature = userData.current_signature_file_id !== null;
      const pendingRequirements = userData.claims.reduce((acc, claim) => 
        acc + claim.requirements.length, 0
      );

      const userStatus = {
        hasSignature,
        pendingRequirements,
        hasScheduledCallback: !!scheduledCallback,
        isEnabled: userData.is_enabled,
        userExists: true
      };

      // 4. Determine current queue type based on actual state
      let currentQueueType: QueueType | null = null;
      
      if (scheduledCallback) {
        currentQueueType = 'callback';
      } else if (!hasSignature) {
        currentQueueType = 'unsigned_users';
      } else if (pendingRequirements > 0) {
        currentQueueType = 'outstanding_requests';
      }

      // 5. Validate against expected queue type
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
   * Automatically skips invalid users until finding a valid one
   */
  async getNextValidUserForCall(queueType: QueueType): Promise<NextUserForCallResult | null> {
    try {
      console.log(`🔍 Finding next valid user for ${queueType} queue...`);
      
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
              queuePosition: entry.queuePosition ?? 0,
              queueEntryId: entry.id,
              validationResult: validation
            };
          } else {
            console.log(`❌ Could not get user context for ${userId}`);
            // Mark entry as invalid if we can't get user context
            await this.markQueueEntryInvalid(entry.id, 'Could not load user context');
          }
        } else {
          // Mark this queue entry as invalid and remove it
          console.log(`❌ Marking user ${userId} as invalid: ${validation.reason}`);
          await this.markQueueEntryInvalid(entry.id, validation.reason || 'No longer eligible');
        }
      }

      console.log(`❌ No valid users found in ${queueType} queue`);
      return null; // No valid users found in queue
    } catch (error) {
      console.error(`❌ Error finding next valid user for ${queueType}:`, error);
      return null;
    }
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
      const queueTypes: QueueType[] = queueType ? [queueType] : ['unsigned_users', 'outstanding_requests', 'callback'];
      
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
} 