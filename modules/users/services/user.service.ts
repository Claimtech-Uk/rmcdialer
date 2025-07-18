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

  // Private helper methods

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

  // TODO: Implement when PostgreSQL is set up
  private async getCallScoreFromDialler(userId: number) {
    // Will be implemented when PostgreSQL is configured
    return null;
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

} 