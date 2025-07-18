import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server';
import { UserService } from '@/modules/users/services/user.service';

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

const InvalidateUserCacheSchema = z.object({
  userId: z.number().int().positive()
});

const CheckQueueEligibilitySchema = z.object({
  userId: z.number().int().positive()
});

export const usersRouter = createTRPCRouter({
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
    })
});

export type UsersRouter = typeof usersRouter; 