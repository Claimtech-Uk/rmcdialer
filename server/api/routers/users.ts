import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server';
import { UserService } from '@/modules/users/services/user.service';
import type { QueueType } from '@/modules/queue/types/queue.types';

// Initialize UserService
const userService = new UserService();

// Input validation schemas
const GetUserContextSchema = z.object({
  userId: z.number().int().positive(),
  includeCallHistory: z.boolean().optional().default(false)
});

const GetEligibleUsersSchema = z.object({
  limit: z.number().int().positive().max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  filters: z.object({
    hasRequirements: z.boolean().optional(),
    claimTypes: z.array(z.string()).optional(),
    maxScore: z.number().int().optional(),
    excludeRecentCalls: z.boolean().optional()
  }).optional().default({})
});

const GetEligibleUsersByQueueTypeSchema = z.object({
  queueType: z.enum(['unsigned_users', 'outstanding_requests', 'callback']),
  limit: z.number().int().positive().max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0)
});

const DetermineQueueTypeSchema = z.object({
  userId: z.number().int().positive()
});

const InvalidateUserCacheSchema = z.object({
  userId: z.number().int().positive()
});

const CheckQueueEligibilitySchema = z.object({
  userId: z.number().int().positive()
});

export const usersRouter = createTRPCRouter({
  /**
   * Get complete user details with ALL connected data
   * Includes claims, requirements, call history, magic links, callbacks, logs
   */
  getCompleteUserDetails: protectedProcedure
    .input(z.object({
      userId: z.number().int().positive()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const details = await userService.getCompleteUserDetails(input.userId);
        
        if (!details) {
          throw new Error(`User ${input.userId} not found`);
        }

        // Log access for audit trail
        console.log(`Agent ${ctx.agent.id} accessed complete details for user ${input.userId}`);

        return {
          success: true,
          data: details,
          message: `Complete user details retrieved for ${details.user.firstName} ${details.user.lastName}`
        };

      } catch (error: any) {
        console.error(`Failed to get complete user details for ${input.userId}:`, error);
        throw new Error(`Failed to get complete user details: ${error.message}`);
      }
    }),

  /**
   * Get complete user context for calling
   * Returns user data, claims, requirements, and call score
   */
  getUserContext: protectedProcedure
    .input(GetUserContextSchema)
    .query(async ({ input, ctx }) => {
      try {
        const context = await userService.getUserCallContext(input.userId);
        
        if (!context) {
          throw new Error(`User ${input.userId} not found`);
        }

        // Log access for audit trail
        console.log(`Agent ${ctx.agent.id} accessed context for user ${input.userId}`);

        return {
          success: true,
          data: context,
          message: `User context retrieved for ${context.user.firstName} ${context.user.lastName}`
        };

      } catch (error: any) {
        console.error(`Failed to get user context for ${input.userId}:`, error);
        throw new Error(`Failed to get user context: ${error.message}`);
      }
    }),

  /**
   * Get list of eligible users for calling queue
   * Supports filtering and pagination
   */
  getEligibleUsers: protectedProcedure
    .input(GetEligibleUsersSchema)
    .query(async ({ input, ctx }) => {
      try {
        const result = await userService.getEligibleUsers(input);

        // Log queue access
        console.log(`Agent ${ctx.agent.id} retrieved ${result.users.length} eligible users (page ${result.page})`);

        return {
          success: true,
          data: result.users,
          meta: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: Math.ceil(result.total / result.limit)
          },
          message: `Found ${result.total} eligible users`
        };

      } catch (error: any) {
        console.error('Failed to get eligible users:', error);
        throw new Error(`Failed to get eligible users: ${error.message}`);
      }
    }),

  /**
   * Get eligible users for a specific queue type
   * NEW: Supports the dual queue system
   */
  getEligibleUsersByQueueType: protectedProcedure
    .input(GetEligibleUsersByQueueTypeSchema)
    .query(async ({ input, ctx }) => {
      try {
        const result = await userService.getEligibleUsersByQueueType(input.queueType, {
          limit: input.limit,
          offset: input.offset
        });

        // Log queue access
        console.log(`Agent ${ctx.agent.id} retrieved ${result.users.length} eligible users from ${input.queueType} queue (page ${result.page})`);

        return {
          success: true,
          data: result.users,
          queueType: input.queueType,
          meta: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: Math.ceil(result.total / result.limit)
          },
          message: `Found ${result.total} eligible users in ${input.queueType} queue`
        };

      } catch (error: any) {
        console.error(`Failed to get eligible users for ${input.queueType}:`, error);
        throw new Error(`Failed to get eligible users for ${input.queueType}: ${error.message}`);
      }
    }),

  /**
   * Determine which queue type a user belongs to
   * NEW: Queue type classification logic
   */
  determineUserQueueType: protectedProcedure
    .input(DetermineQueueTypeSchema)
    .query(async ({ input, ctx }) => {
      try {
        const queueType = await userService.determineUserQueueType(input.userId);

        // Log queue type determination
        console.log(`Agent ${ctx.agent.id} determined user ${input.userId} belongs to queue: ${queueType || 'none'}`);

        return {
          success: true,
          data: {
            userId: input.userId,
            queueType,
            eligible: queueType !== null,
            determinedAt: new Date(),
            determinedBy: ctx.agent.id
          },
          message: queueType 
            ? `User ${input.userId} belongs to ${queueType} queue`
            : `User ${input.userId} is not eligible for any queue`
        };

      } catch (error: any) {
        console.error(`Failed to determine queue type for user ${input.userId}:`, error);
        throw new Error(`Failed to determine queue type: ${error.message}`);
      }
    }),

  /**
   * Check if a specific user is eligible for the call queue
   * Used for real-time queue updates
   */
  checkQueueEligibility: protectedProcedure
    .input(CheckQueueEligibilitySchema)
    .query(async ({ input, ctx }) => {
      try {
        const isEligible = await userService.checkQueueEligibility(input.userId);

        return {
          success: true,
          data: {
            userId: input.userId,
            isEligible,
            checkedAt: new Date(),
            checkedBy: ctx.agent.id
          },
          message: isEligible 
            ? `User ${input.userId} is eligible for calling`
            : `User ${input.userId} is not eligible for calling`
        };

      } catch (error: any) {
        console.error(`Failed to check queue eligibility for user ${input.userId}:`, error);
        throw new Error(`Failed to check eligibility: ${error.message}`);
      }
    }),

  /**
   * Invalidate user cache when data changes
   * Used by CDC processing and admin actions
   */
  invalidateUserCache: protectedProcedure
    .input(InvalidateUserCacheSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        await userService.invalidateUserCache(input.userId);

        // Log cache invalidation
        console.log(`Agent ${ctx.agent.id} invalidated cache for user ${input.userId}`);

        return {
          success: true,
          data: {
            userId: input.userId,
            invalidatedAt: new Date(),
            invalidatedBy: ctx.agent.id
          },
          message: `Cache invalidated for user ${input.userId}`
        };

      } catch (error: any) {
        console.error(`Failed to invalidate cache for user ${input.userId}:`, error);
        throw new Error(`Failed to invalidate cache: ${error.message}`);
      }
    }),

  /**
   * Get user statistics for analytics
   * Returns aggregated data about user activity
   */
  getUserStats: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // This would typically call userService.getUserStats()
        // For now, return basic stats structure
        
        return {
          success: true,
          data: {
            totalUsers: 0,
            eligibleUsers: 0,
            usersWithRequirements: 0,
            averageClaimsPerUser: 0,
            topClaimTypes: [],
            lastUpdated: new Date()
          },
          message: 'User statistics retrieved'
        };

      } catch (error: any) {
        console.error('Failed to get user stats:', error);
        throw new Error(`Failed to get user stats: ${error.message}`);
      }
    }),

  /**
   * Get specific test user (James Campbell ID 5777) 
   * For testing with real production data
   */
  getTestUser: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const testUserId = 5777; // James Campbell from the main system
        const context = await userService.getUserCallContext(testUserId);
        
        if (!context) {
          throw new Error(`Test user ${testUserId} not found in replica database`);
        }

        console.log(`Agent ${ctx.agent.id} accessed test user ${testUserId} context`);

        return {
          success: true,
          data: context,
          message: `Test user context retrieved for ${context.user.firstName} ${context.user.lastName}`
        };

      } catch (error: any) {
        console.error('Failed to get test user:', error);
        throw new Error(`Failed to get test user: ${error.message}`);
      }
    }),

  /**
   * Lookup user by phone number for inbound call identification
   * Returns basic user data if found
   */
  getUserByPhoneNumber: protectedProcedure
    .input(z.object({
      phoneNumber: z.string().min(1)
    }))
    .query(async ({ input, ctx }) => {
      try {
        console.log(`🔍 Looking up user by phone: ${input.phoneNumber}`);
        
        // Use the UserService method that handles phone number normalization
        const user = await userService.getUserByPhoneNumber(input.phoneNumber);
        
        if (!user) {
          console.log(`❓ No user found for phone: ${input.phoneNumber}`);
          return {
            success: false,
            data: null,
            message: `No user found for phone number ${input.phoneNumber}`
          };
        }

        // Log access for audit trail
        console.log(`Agent ${ctx.agent.id} looked up user ${Number(user.id)} by phone ${input.phoneNumber}`);

        // CRITICAL FIX: Convert BigInt to number for JSON serialization
        const userForSerialization = {
          ...user,
          id: Number(user.id), // Convert BigInt to number
          created_at: user.created_at?.toISOString() || null,
          last_login: user.last_login?.toISOString() || null,
          date_of_birth: user.date_of_birth?.toISOString() || null
        };

        return {
          success: true,
          data: userForSerialization,
          message: `User found: ${user.first_name} ${user.last_name}`
        };

      } catch (error: any) {
        console.error(`Failed to lookup user by phone ${input.phoneNumber}:`, error);
        throw new Error(`Failed to lookup user by phone: ${error.message}`);
      }
    })
});

export type UsersRouter = typeof usersRouter; 