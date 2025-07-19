// Priority Scoring Service
// Calculates user priority scores based on business rules

import type { 
  ScoringContext, 
  PriorityScore, 
  ScoreFactor, 
  ScoringServiceDependencies,
  ScoreExplanation 
} from '../types/scoring.types'

export class PriorityScoringService {
  constructor(private dependencies: ScoringServiceDependencies) {}

  /**
   * Calculate priority score for a user
   * Currently implements only time-from-creation rule: 1 point per day since user.created_at
   */
  async calculatePriority(context: ScoringContext): Promise<PriorityScore> {
    try {
      const factors: ScoreFactor[] = []

      // Apply time-from-creation rule: 1 point per day
      const timeScore = this.calculateTimeFromCreation(context)
      factors.push(timeScore)

      // Calculate final score (sum of all factors)
      const finalScore = factors.reduce((sum, factor) => sum + factor.value, 0)

      this.dependencies.logger.info('Priority score calculated', {
        userId: context.userId,
        score: finalScore,
        factors: factors.map(f => ({ name: f.name, value: f.value }))
      })

      return {
        userId: context.userId,
        finalScore,
        factors,
        calculatedAt: context.currentTime
      }
    } catch (error) {
      this.dependencies.logger.error('Failed to calculate priority score', {
        userId: context.userId,
        error
      })
      
      // Return default score if calculation fails
      return {
        userId: context.userId,
        finalScore: 0,
        factors: [{
          name: 'error_fallback',
          value: 0,
          reason: 'Scoring calculation failed, using default'
        }],
        calculatedAt: context.currentTime
      }
    }
  }

  /**
   * Get detailed explanation of score calculation for debugging
   */
  async explainScore(context: ScoringContext): Promise<ScoreExplanation> {
    const score = await this.calculatePriority(context)
    
    return {
      userId: context.userId,
      totalScore: score.finalScore,
      breakdown: score.factors,
      calculationTime: score.calculatedAt,
      rulesSummary: [
        'Time-from-creation: 1 point per day since user.created_at',
        // Future rules will be added here
      ]
    }
  }

  /**
   * Calculate score based on time since user creation
   * Rule: 1 point per day since user.created_at
   */
  private calculateTimeFromCreation(context: ScoringContext): ScoreFactor {
    const daysSinceCreation = this.daysBetween(context.userCreatedAt, context.currentTime)
    const score = Math.floor(daysSinceCreation) // 1 point per full day
    
    return {
      name: 'time_from_creation',
      value: score,
      reason: `${daysSinceCreation.toFixed(1)} days since user creation (${context.userCreatedAt.toISOString().split('T')[0]})`
    }
  }

  /**
   * Calculate number of days between two dates
   */
  private daysBetween(startDate: Date, endDate: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000
    const timeDiff = endDate.getTime() - startDate.getTime()
    return timeDiff / msPerDay
  }
} 