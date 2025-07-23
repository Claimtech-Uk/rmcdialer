// Priority Scoring Service
// Implements event-based scoring system with fresh starts and queue transitions

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
      if (freshStartCheck.isFreshStart) {
        factors.push(freshStartCheck.factor)
        finalScore = 0 // Fresh starts always get score 0
      } else {
        // 2. Start with current score and apply event-based adjustments
        finalScore = context.currentScore || 0
        
        // 3. Apply outcome-based adjustments (main scoring mechanism)
        if (context.lastOutcome) {
          const outcomeFactor = this.calculateOutcomeAdjustment(context.lastOutcome)
          factors.push(outcomeFactor)
          finalScore += outcomeFactor.value
        }

        // 4. Apply call attempt penalty
        const attemptFactor = this.calculateAttemptPenalty(context)
        factors.push(attemptFactor)
        finalScore += attemptFactor.value
      }

      // 5. Enforce score bounds (0-200)
      finalScore = Math.max(0, Math.min(finalScore, 200))

      // 6. Add capping explanation if needed
      if (finalScore >= 200) {
        factors.push({
          name: 'score_cap',
          value: 0,
          reason: 'Score capped at 200 - user should be marked as conversion'
        })
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
        finalScore: 50, // Middle-range default
        factors: [{
          name: 'error_fallback',
          value: 50,
          reason: 'Scoring calculation failed, using default score'
        }],
        calculatedAt: context.currentTime
      }
    }
  }

  /**
   * Check if this user needs a fresh start (score reset to 0)
   */
  private checkForFreshStart(context: ScoringContext): { isFreshStart: boolean; factor: ScoreFactor } {
    // Fresh start conditions:
    // 1. New user (no previous scoring record)
    // 2. Queue type changed (moved from unsigned_users to outstanding_requests, etc.)
    // 3. Completed everything and now has new requirements
    
    const isNewUser = !context.lastResetDate
    const queueTypeChanged = context.currentQueueType !== context.previousQueueType
    const hasNewRequirements = context.requirementsChangedDate && 
      context.requirementsChangedDate > (context.lastResetDate || context.userCreatedAt)

    const isFreshStart = isNewUser || queueTypeChanged || hasNewRequirements || false;

    let reason = 'Continuing with existing score'
    if (isNewUser) reason = 'New user - starting fresh'
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
   * Calculate outcome-based score adjustments per specification
   */
  private calculateOutcomeAdjustment(lastOutcome: string): ScoreFactor {
    const outcomeAdjustments: Record<string, { value: number; description: string }> = {
      // GOOD OUTCOMES (Lower score = Higher priority)
      'callback_requested': { value: -10, description: 'User wants to talk!' },
      'interested_but_busy': { value: -5, description: 'Showed interest' },
      'making_progress': { value: -5, description: 'Making progress in conversation' },
      'partial_completion': { value: -15, description: 'Started completing requirements' },
      'contacted': { value: -5, description: 'Successfully contacted' },

      // NEUTRAL/MINOR OUTCOMES
      'answered_but_busy': { value: 2, description: 'Minor bump - try again soon' },
      'left_voicemail': { value: 5, description: 'Left message' },

      // BAD OUTCOMES (Higher score = Lower priority)
      'no_answer': { value: 10, description: 'Harder to reach' },
      'busy': { value: 10, description: 'Line was busy' },
      'wrong_number': { value: 50, description: 'Big problem - incorrect contact info' },
      'not_interested': { value: 100, description: 'Very low priority' },
      'hostile_aggressive': { value: 150, description: 'Remove from queue soon' },
      'opted_out': { value: 200, description: 'Should be converted/removed' },

      // COMPLETION OUTCOMES (should trigger conversion)
      'requirements_completed': { value: 200, description: 'Success - should be converted' },
      'already_completed': { value: 200, description: 'Data sync issue - should be converted' }
    }

    const adjustment = outcomeAdjustments[lastOutcome] || { value: 0, description: 'Unknown outcome' }

    return {
      name: 'outcome_adjustment',
      value: adjustment.value,
      reason: `Last outcome: ${lastOutcome} - ${adjustment.description}`
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