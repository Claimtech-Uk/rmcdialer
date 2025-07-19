import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server'
import { PriorityScoringService } from '@/modules/scoring'
import type { ScoringContext } from '@/modules/scoring'

export const scoringRouter = createTRPCRouter({
  /**
   * Calculate priority score for a specific user
   * For testing the scoring algorithm
   */
  calculateScore: protectedProcedure
    .input(z.object({
      userId: z.number(),
      userCreatedAt: z.date().optional(), // Optional for testing
    }))
    .query(async ({ input, ctx }) => {
      // Create scoring service instance
      const scoringService = new PriorityScoringService({
        logger: {
          info: (message: string, meta?: any) => console.log(message, meta),
          error: (message: string, error?: any) => console.error(message, error),
          warn: (message: string, meta?: any) => console.warn(message, meta)
        }
      })

      // Create scoring context
      const scoringContext: ScoringContext = {
        userId: input.userId,
        userCreatedAt: input.userCreatedAt || new Date('2024-01-01'), // Default for testing
        currentTime: new Date()
      }

      // Calculate score
      const score = await scoringService.calculatePriority(scoringContext)
      
      return score
    }),

  /**
   * Get detailed explanation of score calculation
   * For debugging and understanding scoring decisions
   */
  explainScore: protectedProcedure
    .input(z.object({
      userId: z.number(),
      userCreatedAt: z.date().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Create scoring service instance
      const scoringService = new PriorityScoringService({
        logger: {
          info: (message: string, meta?: any) => console.log(message, meta),
          error: (message: string, error?: any) => console.error(message, error),
          warn: (message: string, meta?: any) => console.warn(message, meta)
        }
      })

      // Create scoring context
      const scoringContext: ScoringContext = {
        userId: input.userId,
        userCreatedAt: input.userCreatedAt || new Date('2024-01-01'), // Default for testing
        currentTime: new Date()
      }

      // Get explanation
      const explanation = await scoringService.explainScore(scoringContext)
      
      return explanation
    }),

  /**
   * Test scoring with different time periods
   * For testing that newer users get higher priority
   */
  testTimeScoring: protectedProcedure
    .input(z.object({
      testCases: z.array(z.object({
        userId: z.number(),
        daysAgo: z.number() // How many days ago the user was created
      }))
    }))
    .query(async ({ input, ctx }) => {
      // Create scoring service instance
      const scoringService = new PriorityScoringService({
        logger: {
          info: (message: string, meta?: any) => console.log(message, meta),
          error: (message: string, error?: any) => console.error(message, error),
          warn: (message: string, meta?: any) => console.warn(message, meta)
        }
      })

      const currentTime = new Date()
      const results = []

      for (const testCase of input.testCases) {
        // Calculate creation date based on days ago
        const userCreatedAt = new Date(currentTime.getTime() - (testCase.daysAgo * 24 * 60 * 60 * 1000))
        
        const scoringContext: ScoringContext = {
          userId: testCase.userId,
          userCreatedAt,
          currentTime
        }

        const score = await scoringService.calculatePriority(scoringContext)
        
        results.push({
          userId: testCase.userId,
          daysAgo: testCase.daysAgo,
          userCreatedAt,
          score: score.finalScore,
          explanation: score.factors[0]?.reason || 'No factors'
        })
      }

      // Sort by score to verify ordering (higher score = higher priority in queue)
      results.sort((a, b) => b.score - a.score)
      
      return {
        testResults: results,
        summary: `Tested ${results.length} users. Newest user (${Math.min(...results.map(r => r.daysAgo))} days ago) scored ${Math.max(...results.map(r => r.score))} points.`
      }
    })
}) 