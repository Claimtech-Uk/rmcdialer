// Scoring Module Types
// Domain types for priority scoring and business rules

import type { QueueType } from '@/modules/queue/types/queue.types'

// Basic user information needed for scoring
export interface ScoringContext {
  userId: number
  userCreatedAt: Date
  currentTime: Date
  // Will be extended with more fields as we add rules
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