import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '@/lib/redis';
import type { 
  UserCallContext, 
  ClaimContext,
  UserDataFromReplica,
  ClaimDataFromReplica,
  GetUserContextRequest,
  GetEligibleUsersRequest,
  GetEligibleUsersResponse,
  UserNotFoundError,
  CacheError
} from '../types/user.types';
import { DatabaseConnectionError } from '../types/user.types';
import type { QueueType } from '@/modules/queue/types/queue.types';

// Enhanced user details interface with all connected data
export interface CompleteUserDetails {
  // Basic user info
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    status: string;
    isEnabled: boolean;
    introducer: string;
    solicitor: string | null;
    dateOfBirth: Date | null;
    lastLogin: Date | null;
    createdAt: Date | null;
  };
  
  // Address information
  address: {
    id: string;
    type: string;
    fullAddress: string;
    postCode: string;
    county: string;
  } | null;
  
  // Claims with all related data
  claims: Array<{
    id: number;
    type: string;
    status: string;
    lender: string;
    solicitor: string;
    lastUpdated: Date | null;
    createdAt: Date | null;
    
    // Requirements for this claim
    requirements: Array<{
      id: string;
      type: string;
      status: string;
      reason: string | null;
      rejectionReason: string | null;
      createdAt: Date | null;
    }>;
    
    // Vehicle packages for this claim
    vehiclePackages: Array<{
      id: string;
      registration: string;
      make: string;
      model: string;
      dealership: string;
      monthlyPayment: number | null;
      contractStartDate: Date | null;
      status: string;
    }>;
  }>;
  
  // User activity logs
  activityLogs: Array<{
    id: string;
    action: string;
    message: string;
    createdAt: Date | null;
  }>;
  
  // Call history from dialler system
  callHistory: Array<{
    id: string;
    agentId: number;
    agentName: string;
    twilioCallSid: string | null;
    status: string;
    direction: string;
    startedAt: Date;
    connectedAt: Date | null;
    endedAt: Date | null;
    durationSeconds: number | null;
    talkTimeSeconds: number | null;
    
    // Call outcome
    outcome: {
      type: string;
      notes: string | null;
      magicLinkSent: boolean;
      smsSent: boolean;
      documentsRequested: any;
    } | null;
  }>;
  
  // Magic link activities
  magicLinks: Array<{
    id: string;
    linkType: string;
    sentVia: string;
    sentAt: Date;
    accessedAt: Date | null;
    callSessionId: string | null;
  }>;
  
  // Scheduled callbacks
  callbacks: Array<{
    id: string;
    scheduledFor: Date;
    reason: string | null;
    status: string;
    preferredAgentId: number | null;
    preferredAgentName: string | null;
  }>;
  
  // Call scoring data
  callScore: {
    currentScore: number;
    nextCallAfter: Date | null;
    lastCallAt: Date | null;
    totalAttempts: number;
    successfulCalls: number;
    lastOutcome: string | null;
  } | null;
  
  // Summary statistics
  summary: {
    totalClaims: number;
    pendingRequirements: number;
    completedCalls: number;
    lastContactDate: Date | null;
    totalCallDuration: number; // in seconds
    magicLinksCount: number;
    pendingCallbacks: number;
  };
}

export class UserService {
  private logger: any;

  constructor() {
    // Initialize logger - will use winston when available
    this.logger = {
      info: console.log,
      error: console.error,
      warn: console.warn,
      debug: console.debug
    };
  }

  /**
   * Get complete user details with ALL connected data
   * This is the comprehensive view for agent dashboards
   */
  async getCompleteUserDetails(userId: number): Promise<CompleteUserDetails | null> {
    try {
      // 1. Check cache first
      const cacheKey = `${CACHE_KEYS.userContext(userId)}:complete`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Complete user details cache hit for user ${userId}`);
        return cached as CompleteUserDetails;
      }

      this.logger.debug(`Fetching complete details for user ${userId} from databases`);

      // 2. Fetch from MySQL replica (user, claims, requirements, logs, addresses)
      const userData = await this.getCompleteUserDataFromReplica(userId);
      if (!userData) {
        this.logger.warn(`User ${userId} not found in replica database`);
        return null;
      }

      // 3. Fetch call data from PostgreSQL dialler database
      const [callScore, callHistory, magicLinks, callbacks] = await Promise.all([
        this.getUserCallScore(userId),
        this.getCallHistory(userId),
        this.getMagicLinkActivities(userId),
        this.getCallbacks(userId)
      ]);

      // 4. Build complete user details
      const details = this.buildCompleteUserDetails(userData, callScore, callHistory, magicLinks, callbacks);

      // 5. Cache result (15 minute TTL)
      await cacheService.set(cacheKey, details, CACHE_TTL.USER_CONTEXT);

      this.logger.info(`Complete user details built for ${userId}: ${details.claims.length} claims, ${details.callHistory.length} calls, ${details.summary.pendingRequirements} pending requirements`);

      return details;

    } catch (error) {
      this.logger.error(`Failed to get complete user details for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get complete user context for calling
   * Combines data from MySQL replica (user/claims) + PostgreSQL (call scores)
   */
  async getUserCallContext(userId: number): Promise<UserCallContext | null> {
    try {
      // 1. Check cache first
      const cacheKey = CACHE_KEYS.userContext(userId);
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for user ${userId}`);
        return cached as UserCallContext;
      }

      this.logger.debug(`Cache miss for user ${userId}, fetching from databases`);

      // 2. Fetch from MySQL replica (PostgreSQL call scores will be added later)
      const userData = await this.getUserDataFromReplica(userId);

      if (!userData) {
        this.logger.warn(`User ${userId} not found in replica database`);
        return null;
      }

      // 3. Merge data into context (without call scores for now)
      const context = this.mergeUserContext(userData, null);

      // 4. Cache result (15 minute TTL)
      await cacheService.set(cacheKey, context, CACHE_TTL.USER_CONTEXT);

      this.logger.info(`User context built for ${userId}: ${context.claims.length} claims, ${context.claims.reduce((acc, c) => acc + c.requirements.length, 0)} requirements`);

      return context;

    } catch (error) {
      this.logger.error(`Failed to get user context for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get eligible users for calling queue
   * Optimized query with caching
   */
  async getEligibleUsers(request: GetEligibleUsersRequest): Promise<GetEligibleUsersResponse> {
    const { limit = 50, offset = 0, filters = {} } = request;
    
    try {
      // Create cache key based on filters
      const filterString = JSON.stringify(filters);
      const cacheKey = CACHE_KEYS.eligibleUsers(filterString);
      
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        const cachedResponse = cached as GetEligibleUsersResponse;
        // Return paginated slice from cache
        const slicedUsers = cachedResponse.users.slice(offset, offset + limit);
        return {
          ...cachedResponse,
          users: slicedUsers,
          page: Math.floor(offset / limit) + 1,
          limit
        };
      }

      // Build where conditions for eligible users
      const whereConditions: any = {
        is_enabled: true,
        status: {
          not: 'inactive'
        }
      };

      // Add claim-based filters
      if (filters.hasRequirements || filters.claimTypes?.length) {
        whereConditions.claims = {
          some: {
            ...(filters.claimTypes?.length && {
              type: { in: filters.claimTypes }
            }),
            ...(filters.hasRequirements && {
              requirements: {
                some: {
                  status: 'PENDING'
                }
              }
            })
          }
        };
      }

      // Get total count and paginated data
      const [totalCount, users] = await Promise.all([
        replicaDb.user.count({ where: whereConditions }),
        replicaDb.user.findMany({
          where: whereConditions,
          include: {
            claims: {
              include: {
                requirements: {
                  where: { status: 'PENDING' }
                },
                vehiclePackages: true
              }
            },
            address: true
          },
          orderBy: { created_at: 'desc' },
          take: Math.min(limit, 100), // Cap at 100
          skip: offset
        })
      ]);

      // Build user contexts (without call scores for now)
      const userContexts: UserCallContext[] = users.map(userData => {
        return this.mergeUserContext(userData as UserDataFromReplica, null);
      });

      const response: GetEligibleUsersResponse = {
        users: userContexts,
        total: totalCount,
        page: Math.floor(offset / limit) + 1,
        limit
      };

      // Cache the full result
      await cacheService.set(cacheKey, response, CACHE_TTL.ELIGIBLE_USERS);

      return response;

    } catch (error) {
      this.logger.error('Failed to get eligible users:', error);
      throw new DatabaseConnectionError('mysql', error as Error);
    }
  }

  /**
   * Invalidate user cache when data changes
   */
  async invalidateUserCache(userId: number): Promise<void> {
    try {
      const keysToDelete = [
        CACHE_KEYS.userContext(userId),
        `${CACHE_KEYS.userContext(userId)}:complete`,
        CACHE_KEYS.userClaims(userId),
        CACHE_KEYS.userScore(userId)
      ];

      // Delete individual cache keys
      await Promise.all(keysToDelete.map(key => cacheService.del(key)));

      // Also invalidate any eligible users cache that might contain this user
      await cacheService.delPattern('eligible_users:*');

      this.logger.info(`Cache invalidated for user ${userId}`);
      
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for user ${userId}:`, error);
    }
  }

  /**
   * Check if user should be added to call queue
   */
  async checkQueueEligibility(userId: number): Promise<boolean> {
    try {
      const context = await this.getUserCallContext(userId);
      
      if (!context || !context.user.isEnabled) {
        return false;
      }

      // Check if user has pending requirements
      const hasPendingRequirements = context.claims.some(claim => 
        claim.requirements.some(req => req.status === 'PENDING')
      );

      // Check call score restrictions
      const callScore = context.callScore;
      if (callScore?.nextCallAfter && callScore.nextCallAfter > new Date()) {
        return false; // Still in cooldown period
      }

      return hasPendingRequirements;

    } catch (error) {
      this.logger.error(`Failed to check queue eligibility for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Determine which queue type a user belongs to based on their current state
   */
  async determineUserQueueType(userId: number): Promise<QueueType | null> {
    try {
      // First check if there's a scheduled callback
      const scheduledCallback = await prisma.callback.findFirst({
        where: {
          userId: BigInt(userId),
          status: 'pending',
          scheduledFor: {
            lte: new Date()
          }
        }
      });

      if (scheduledCallback) {
        return 'callback';
      }

      // Get user data from replica to check signature and requirements
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

      if (!userData || !userData.is_enabled) {
        return null; // User not eligible for any queue
      }

      // Check if user has signature
      const hasSignature = userData.current_signature_file_id !== null;

      if (!hasSignature) {
        // User missing signature - highest priority queue
        return 'unsigned_users';
      }

      // User has signature, check for pending requirements
      const hasPendingRequirements = userData.claims.some(claim =>
        claim.requirements.some(req => req.status === 'PENDING')
      );

      if (hasPendingRequirements) {
        // User has signature but missing documents
        return 'outstanding_requests';
      }

      // User has signature and no pending requirements - not eligible for queue
      return null;

    } catch (error) {
      this.logger.error(`Failed to determine queue type for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get eligible users for a specific queue type
   */
  async getEligibleUsersByQueueType(queueType: QueueType, options: GetEligibleUsersRequest = {}): Promise<GetEligibleUsersResponse> {
    const { limit = 50, offset = 0 } = options;
    
    try {
      // Create cache key specific to queue type
      const cacheKey = `eligible_users:${queueType}:${limit}:${offset}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        this.logger.debug(`Cache hit for ${queueType} queue`);
        return cached as GetEligibleUsersResponse;
      }

      let users: any[] = [];
      let totalCount = 0;

      switch (queueType) {
        case 'unsigned_users':
          [users, totalCount] = await this.getUnsignedUsers(limit, offset);
          break;
        
        case 'outstanding_requests':
          [users, totalCount] = await this.getOutstandingRequestUsers(limit, offset);
          break;
        
        case 'callback':
          [users, totalCount] = await this.getCallbackUsers(limit, offset);
          break;
        
        default:
          throw new Error(`Unknown queue type: ${queueType}`);
      }

      // Build user contexts
      const userContexts: UserCallContext[] = users.map(userData => {
        return this.mergeUserContext(userData as UserDataFromReplica, null);
      });

      const response: GetEligibleUsersResponse = {
        users: userContexts,
        total: totalCount,
        page: Math.floor(offset / limit) + 1,
        limit
      };

      // Cache the result for 5 minutes
      await cacheService.set(cacheKey, response, CACHE_TTL.ELIGIBLE_USERS);

      this.logger.info(`Found ${totalCount} eligible users for ${queueType} queue`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to get eligible users for ${queueType}:`, error);
      throw new DatabaseConnectionError('mysql', error as Error);
    }
  }

  // Private helper methods

  private async getCompleteUserDataFromReplica(userId: number): Promise<UserDataFromReplica | null> {
    try {
      const userData = await replicaDb.user.findUnique({
        where: { id: BigInt(userId) },
        include: {
          claims: {
            include: {
              requirements: true, // Get ALL requirements, not just pending
              vehiclePackages: true
            }
          },
          address: true,
          user_logs: {
            orderBy: { created_at: 'desc' },
            take: 50 // Last 50 activity logs
          }
        }
      });

      return userData as UserDataFromReplica | null;

    } catch (error) {
      this.logger.error(`Failed to fetch complete user ${userId} from replica:`, error);
      throw new DatabaseConnectionError('mysql', error as Error);
    }
  }

  private async getUserDataFromReplica(userId: number): Promise<UserDataFromReplica | null> {
    try {
      const userData = await replicaDb.user.findUnique({
        where: { id: BigInt(userId) },
        include: {
          claims: {
            include: {
              requirements: {
                where: { status: 'PENDING' }
              },
              vehiclePackages: true
            }
          },
          address: true
        }
      });

      return userData as UserDataFromReplica | null;

    } catch (error) {
      this.logger.error(`Failed to fetch user ${userId} from replica:`, error);
      throw new DatabaseConnectionError('mysql', error as Error);
    }
  }

  private async getUserCallScore(userId: number) {
    try {
      return await prisma.userCallScore.findUnique({
        where: { userId: BigInt(userId) }
      });
    } catch (error) {
      this.logger.warn(`No call score found for user ${userId}`);
      return null;
    }
  }

  private async getCallHistory(userId: number) {
    try {
      return await prisma.callSession.findMany({
        where: { userId: BigInt(userId) },
        include: {
          agent: {
            select: { firstName: true, lastName: true }
          },
          callOutcomes: true
        },
        orderBy: { startedAt: 'desc' },
        take: 20 // Last 20 calls
      });
    } catch (error) {
      this.logger.warn(`No call history found for user ${userId}`);
      return [];
    }
  }

  private async getMagicLinkActivities(userId: number) {
    try {
      return await prisma.magicLinkActivity.findMany({
        where: { userId: BigInt(userId) },
        orderBy: { sentAt: 'desc' },
        take: 20 // Last 20 magic links
      });
    } catch (error) {
      this.logger.warn(`No magic link activities found for user ${userId}`);
      return [];
    }
  }

  private async getCallbacks(userId: number) {
    try {
      return await prisma.callback.findMany({
        where: { userId: BigInt(userId) },
        include: {
          preferredAgent: {
            select: { firstName: true, lastName: true }
          }
        },
        orderBy: { scheduledFor: 'desc' }
      });
    } catch (error) {
      this.logger.warn(`No callbacks found for user ${userId}`);
      return [];
    }
  }

  private buildCompleteUserDetails(
    userData: UserDataFromReplica, 
    callScore: any, 
    callHistory: any[], 
    magicLinks: any[], 
    callbacks: any[]
  ): CompleteUserDetails {
    
    // Calculate summary statistics
    const totalCallDuration = callHistory.reduce((acc, call) => acc + (call.durationSeconds || 0), 0);
    const completedCalls = callHistory.filter(call => call.status === 'completed').length;
    const pendingRequirements = userData.claims.reduce((acc, claim) => 
      acc + claim.requirements.filter(req => req.status === 'PENDING').length, 0
    );
    const pendingCallbacks = callbacks.filter(cb => cb.status === 'pending').length;
    const lastContactDate = callHistory.length > 0 ? callHistory[0].startedAt : null;

    return {
      user: {
        id: Number(userData.id),
        firstName: userData.first_name || 'Unknown',
        lastName: userData.last_name || 'User',
        email: userData.email_address || '',
        phoneNumber: userData.phone_number || '',
        status: userData.status || 'Unknown',
        isEnabled: userData.is_enabled || false,
        introducer: userData.introducer || 'mcc',
        solicitor: userData.solicitor,
        dateOfBirth: userData.date_of_birth,
        lastLogin: userData.last_login,
        createdAt: userData.created_at
      },
      
      address: userData.address ? {
        id: userData.address.id,
        type: userData.address.type || 'Unknown',
        fullAddress: userData.address.full_address || '',
        postCode: userData.address.post_code || '',
        county: userData.address.county || ''
      } : null,
      
      claims: userData.claims.map(claim => ({
        id: Number(claim.id),
        type: claim.type || 'Unknown',
        status: claim.status || 'Unknown',
        lender: claim.lender || 'Unknown',
        solicitor: claim.solicitor || '',
        lastUpdated: claim.client_last_updated_at,
        createdAt: claim.created_at,
        
        requirements: claim.requirements.map(req => ({
          id: req.id,
          type: req.type || 'Unknown',
          status: req.status || 'Unknown',
          reason: req.claim_requirement_reason,
          rejectionReason: req.claim_requirement_rejection_reason,
          createdAt: req.created_at
        })),
        
        vehiclePackages: claim.vehiclePackages.map(pkg => ({
          id: pkg.id,
          registration: pkg.vehicle_registration || '',
          make: pkg.vehicle_make || '',
          model: pkg.vehicle_model || '',
          dealership: pkg.dealership_name || '',
          monthlyPayment: pkg.monthly_payment ? Number(pkg.monthly_payment) : null,
          contractStartDate: pkg.contract_start_date,
          status: pkg.status || 'Unknown'
        }))
      })),
      
      activityLogs: (userData as any).user_logs?.map((log: any) => ({
        id: log.id,
        action: log.type || 'Unknown',
        message: log.detail || '',
        createdAt: log.created_at
      })) || [],
      
      callHistory: callHistory.map(call => ({
        id: call.id,
        agentId: call.agentId,
        agentName: `${call.agent.firstName} ${call.agent.lastName}`,
        twilioCallSid: call.twilioCallSid,
        status: call.status,
        direction: call.direction,
        startedAt: call.startedAt,
        connectedAt: call.connectedAt,
        endedAt: call.endedAt,
        durationSeconds: call.durationSeconds,
        talkTimeSeconds: call.talkTimeSeconds,
        outcome: call.callOutcomes?.[0] ? {
          type: call.callOutcomes[0].outcomeType,
          notes: call.callOutcomes[0].outcomeNotes,
          magicLinkSent: call.callOutcomes[0].magicLinkSent,
          smsSent: call.callOutcomes[0].smsSent,
          documentsRequested: call.callOutcomes[0].documentsRequested
        } : null
      })),
      
      magicLinks: magicLinks.map(link => ({
        id: link.id,
        linkType: link.linkType,
        sentVia: link.sentVia,
        sentAt: link.sentAt,
        accessedAt: link.accessedAt,
        callSessionId: link.callSessionId
      })),
      
      callbacks: callbacks.map(callback => ({
        id: callback.id,
        scheduledFor: callback.scheduledFor,
        reason: callback.callbackReason,
        status: callback.status,
        preferredAgentId: callback.preferredAgentId,
        preferredAgentName: callback.preferredAgent 
          ? `${callback.preferredAgent.firstName} ${callback.preferredAgent.lastName}`
          : null
      })),
      
      callScore: callScore ? {
        currentScore: callScore.currentScore,
        nextCallAfter: callScore.nextCallAfter,
        lastCallAt: callScore.lastCallAt,
        totalAttempts: callScore.totalAttempts,
        successfulCalls: callScore.successfulCalls,
        lastOutcome: callScore.lastOutcome
      } : null,
      
      summary: {
        totalClaims: userData.claims.length,
        pendingRequirements,
        completedCalls,
        lastContactDate,
        totalCallDuration,
        magicLinksCount: magicLinks.length,
        pendingCallbacks
      }
    };
  }

  private mergeUserContext(userData: UserDataFromReplica, callScore: any): UserCallContext {
    return {
      user: {
        id: Number(userData.id),
        firstName: userData.first_name,
        lastName: userData.last_name,
        phoneNumber: userData.phone_number,
        email: userData.email_address,
        status: userData.status,
        isEnabled: userData.is_enabled,
        introducer: userData.introducer,
        solicitor: userData.solicitor,
        lastLogin: userData.last_login,
        address: userData.address ? {
          id: userData.address.id,
          type: userData.address.type,
          fullAddress: userData.address.full_address,
          postCode: userData.address.post_code,
          county: userData.address.county
        } : null
      },
      claims: userData.claims.map(claim => ({
        id: Number(claim.id),
        type: claim.type,
        status: claim.status,
        lender: claim.lender,
        solicitor: claim.solicitor,
        lastUpdated: claim.client_last_updated_at,
        requirements: claim.requirements.map(req => ({
          id: req.id,
          type: req.type,
          status: req.status,
          reason: req.claim_requirement_reason,
          rejectionReason: req.claim_requirement_rejection_reason,
          createdAt: req.created_at
        })),
        vehiclePackages: claim.vehiclePackages.map(pkg => ({
          id: pkg.id,
          registration: pkg.vehicle_registration,
          make: pkg.vehicle_make,
          model: pkg.vehicle_model,
          dealership: pkg.dealership_name,
          monthlyPayment: pkg.monthly_payment ? Number(pkg.monthly_payment) : null,
          contractStartDate: pkg.contract_start_date,
          status: pkg.status
        }))
      })),
      callScore: callScore ? {
        currentScore: callScore.currentScore,
        totalAttempts: callScore.totalAttempts,
        successfulCalls: callScore.successfulCalls,
        lastOutcome: callScore.lastOutcome,
        nextCallAfter: callScore.nextCallAfter,
        lastCallAt: callScore.lastCallAt,
        baseScore: callScore.baseScore || 0,
        outcomePenaltyScore: callScore.outcomePenaltyScore || 0,
        timePenaltyScore: callScore.timePenaltyScore || 0
      } : null
    };
  }

  /**
   * Get users missing signatures (unsigned_users queue)
   */
  private async getUnsignedUsers(limit: number, offset: number): Promise<[any[], number]> {
    const whereConditions = {
      is_enabled: true,
      status: { not: 'inactive' },
      current_signature_file_id: null, // Missing signature
      claims: {
        some: {
          status: { not: 'complete' }
        }
      }
    };

    const [totalCount, users] = await Promise.all([
      replicaDb.user.count({ where: whereConditions }),
      replicaDb.user.findMany({
        where: whereConditions,
        include: {
          claims: {
            include: {
              requirements: true,
              vehiclePackages: true
            }
          },
          address: true
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset
      })
    ]);

    return [users, totalCount];
  }

  /**
   * Get users with outstanding document requests (but have signatures)
   */
  private async getOutstandingRequestUsers(limit: number, offset: number): Promise<[any[], number]> {
    const whereConditions = {
      is_enabled: true,
      status: { not: 'inactive' },
      current_signature_file_id: { not: null }, // Has signature
      claims: {
        some: {
          requirements: {
            some: { status: 'PENDING' }
          }
        }
      }
    };

    const [totalCount, users] = await Promise.all([
      replicaDb.user.count({ where: whereConditions }),
      replicaDb.user.findMany({
        where: whereConditions,
        include: {
          claims: {
            include: {
              requirements: {
                where: { status: 'PENDING' }
              },
              vehiclePackages: true
            }
          },
          address: true
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset
      })
    ]);

    return [users, totalCount];
  }

  /**
   * Get users with scheduled callbacks (from PostgreSQL)
   */
  private async getCallbackUsers(limit: number, offset: number): Promise<[any[], number]> {
    // Get callback user IDs from PostgreSQL
    const callbacks = await prisma.callback.findMany({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: new Date()
        }
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
      skip: offset
    });

    const callbackUserIds = callbacks.map((cb: any) => Number(cb.userId));
    
    if (callbackUserIds.length === 0) {
      return [[], 0];
    }

    // Get user data from MySQL replica
    const whereConditions = {
      id: { in: callbackUserIds.map((id: number) => BigInt(id)) },
      is_enabled: true
    };

    const [users, totalCallbacks] = await Promise.all([
      replicaDb.user.findMany({
        where: whereConditions,
        include: {
          claims: {
            include: {
              requirements: true,
              vehiclePackages: true
            }
          },
          address: true
        }
      }),
      prisma.callback.count({
        where: {
          status: 'pending',
          scheduledFor: { lte: new Date() }
        }
      })
    ]);

    return [users, totalCallbacks];
  }
} 