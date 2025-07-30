// Scoring Module Types
// Domain types for priority scoring and business rules

import type { QueueType } from '@/modules/queue/types/queue.types'

// Basic user information needed for scoring
export interface ScoringContext {
  userId: number
  userCreatedAt: Date
  currentTime: Date
  
  // Enhanced scoring system fields
  currentScore?: number
  lastResetDate?: Date
  currentQueueType?: string
  previousQueueType?: string
  lastOutcome?: string
  totalAttempts?: number
  requirementsChangedDate?: Date
  lastCallAt?: Date
  
  // NEW: To distinguish truly new users from existing users with null lastResetDate
  hasExistingRecord?: boolean
}

// Result of priority calculation
export interface PriorityScore {
  userId: number
  finalScore: number
  factors: ScoreFactor[]
  calculatedAt: Date
  queueType?: QueueType
}

// Individual scoring factor breakdown
export interface ScoreFactor {
  name: string
  value: number
  reason: string
}

// Service dependencies interface
export interface ScoringServiceDependencies {
  logger: {
    info: (message: string, meta?: any) => void
    error: (message: string, error?: any) => void
    warn: (message: string, meta?: any) => void
  }
}

// For debugging and explanation
export interface ScoreExplanation {
  userId: number
  totalScore: number
  breakdown: ScoreFactor[]
  calculationTime: Date
  rulesSummary: string[]
} 