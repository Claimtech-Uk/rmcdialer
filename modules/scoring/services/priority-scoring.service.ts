// Priority Scoring Service
// Implements event-based scoring system with fresh starts and queue transitions

import type { ScoringContext, PriorityScore, ScoreFactor, ScoreExplanation } from '../types/scoring.types'
import type { PriorityScore as PS } from '@/modules/queue/types/queue.types'
import { CallOutcomeManager } from '@/modules/call-outcomes/services/call-outcome-manager.service'

// Dependencies interface for better testability
interface ScoringDependencies {
  logger: {
    info: (message: string, context: any) => void
    warn: (message: string, context: any) => void
    error: (message: string, context: any) => void
  }
}

export class PriorityScoringService {
  private outcomeManager: CallOutcomeManager

  constructor(private dependencies: ScoringDependencies) {
    this.outcomeManager = new CallOutcomeManager()
  }

  /**
   * Calculate priority score for a user using the event-based 0-200 system
   * - 0-10: RED HOT (call immediately)
   * - 11-50: WARM (good prospects) 
   * - 51-100: LUKEWARM (still worth calling)
   * - 101-199: COLD (low priority)
   * - 200+: FROZEN (stop calling)
   */
  async calculatePriority(context: ScoringContext): Promise<PriorityScore> {
    try {
      const factors: ScoreFactor[] = []
      let finalScore = 0

      // 1. Check if this is a fresh start (queue transition or new user)
      const freshStartCheck = this.checkForFreshStart(context)
      factors.push(freshStartCheck.factor)
      
      // 2. Set base score: 0 for fresh starts, current score for continuing users
      if (freshStartCheck.isFreshStart) {
        finalScore = 0 // Fresh starts get base score of 0
      } else {
        finalScore = context.currentScore || 0 // Continue with existing score
      }
      
      // 3. Apply outcome-based adjustments (for ALL users, including fresh starts)
      let outcomeFactor: ScoreFactor | null = null
      if (context.lastOutcome) {
        outcomeFactor = this.calculateOutcomeAdjustment(context.lastOutcome)
        factors.push(outcomeFactor)
        finalScore += outcomeFactor.value
      }

      // 4. Apply call attempt penalty (for ALL users, including fresh starts)
      const attemptFactor = this.calculateAttemptPenalty(context)
      factors.push(attemptFactor)
      finalScore += attemptFactor.value

      // 5. Enforce score bounds - conditional capping based on outcome type
      const handler = context.lastOutcome ? this.outcomeManager.getHandler(context.lastOutcome as any) : null
      const shouldTriggerConversion = handler?.scoringRules.shouldTriggerConversion || false
      
      if (shouldTriggerConversion) {
        // For conversion outcomes: Cap at 200 (user will be removed from queue anyway)
        finalScore = Math.max(0, Math.min(finalScore, 200))
        
        if (finalScore >= 200) {
          factors.push({
            name: 'score_cap',
            value: 0,
            reason: 'Score capped at 200 - user should be marked as conversion'
          })
        }
      } else {
        // For non-conversion outcomes: Only enforce floor at 0, allow scores above 200
        finalScore = Math.max(0, finalScore)
        
        if (finalScore >= 200) {
          factors.push({
            name: 'high_score_warning',
            value: 0,
            reason: `High score (${finalScore}) - user may need manual review`
          })
        }
      }

      this.dependencies.logger.info('Event-based priority score calculated', {
        userId: context.userId,
        score: finalScore,
        factors: factors.map(f => ({ name: f.name, value: f.value, reason: f.reason }))
      })

      return {
        userId: context.userId,
        finalScore,
        factors,
        calculatedAt: new Date()
      }
    } catch (error) {
      this.dependencies.logger.error('Error calculating priority score', {
        userId: context.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Check if this user needs a fresh start (score reset to 0)
   */
  private checkForFreshStart(context: ScoringContext): { isFreshStart: boolean; factor: ScoreFactor } {
    // Fresh start conditions:
    // 1. Truly new user (no user_call_score record at all)
    // 2. Queue type changed (moved from unsigned_users to outstanding_requests, etc.)  
    // 3. Completed everything and now has new requirements
    
    // FIXED: Only treat as new if they have no record at all, not just missing lastResetDate
    const isTrulyNewUser = context.hasExistingRecord === false
    const queueTypeChanged = context.currentQueueType !== context.previousQueueType
    const hasNewRequirements = context.requirementsChangedDate && 
      context.requirementsChangedDate > (context.lastResetDate || context.userCreatedAt)

    const isFreshStart = isTrulyNewUser || queueTypeChanged || hasNewRequirements || false;

    let reason = 'Continuing with existing score'
    if (isTrulyNewUser) reason = 'New user - starting fresh'
    else if (queueTypeChanged) reason = `Queue changed from ${context.previousQueueType} to ${context.currentQueueType}`
    else if (hasNewRequirements) reason = 'New requirements detected - fresh start'

    return {
      isFreshStart,
      factor: {
        name: 'fresh_start_check',
        value: isFreshStart ? 0 : 0,
        reason
      }
    }
  }

  /**
   * Calculate outcome-based score adjustments using CallOutcomeManager
   */
  private calculateOutcomeAdjustment(lastOutcome: string): ScoreFactor {
    // Get the score adjustment from the call outcome handler
    const scoreAdjustment = this.outcomeManager.getScoreAdjustment(lastOutcome as any)
    const handler = this.outcomeManager.getHandler(lastOutcome as any)
    
    if (handler) {
      return {
        name: 'outcome_adjustment',
        value: scoreAdjustment,
        reason: `${handler.displayName}: ${handler.scoringRules.description}`
      }
    }
    
    // Fallback for unknown outcomes
    this.dependencies.logger.warn('Unknown outcome type in scoring', { outcome: lastOutcome })
    return {
      name: 'outcome_adjustment',
      value: 0,
      reason: `Unknown outcome: ${lastOutcome} - no adjustment applied`
    }
  }

  /**
   * Calculate penalty based on number of attempts
   */
  private calculateAttemptPenalty(context: ScoringContext): ScoreFactor {
    const attempts = context.totalAttempts || 0
    let penalty = 0

    if (attempts > 10) {
      penalty = (attempts - 10) * 3 // 3 points per attempt after 10
    } else if (attempts > 5) {
      penalty = (attempts - 5) * 1 // 1 point per attempt after 5
    }

    return {
      name: 'attempt_penalty',
      value: penalty,
      reason: `${attempts} total attempts (penalty for excessive attempts)`
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
        'Event-based 0-200 scoring system:',
        '• Fresh starts (new user, queue change, new requirements) = Score 0',
        '• Outcome adjustments: -15 to +200 based on call results',
        '• Attempt penalty: +1 per attempt after 5, +3 per attempt after 10',
        '• Score 200+ = Remove from queues (conversion)',
        '• Callbacks prioritized within their respective queues'
      ]
    }
  }
} 