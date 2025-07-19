// Scoring Module - Priority Scoring & Business Rules
// This module handles intelligent priority scoring for queue management

// Services (main business logic)
export { PriorityScoringService } from './services/priority-scoring.service'

// Types (for other modules and tRPC)
export type {
  ScoringContext,
  PriorityScore,
  ScoreFactor,
  ScoringServiceDependencies,
  ScoreExplanation
} from './types/scoring.types' 