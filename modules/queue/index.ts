// Queue Module - Call Queue Management & Priority Scoring
// This module handles intelligent call queue management, user prioritization, and queue assignment

// Services (main business logic)
export { QueueService } from './services/queue.service'

// Types (for other modules and tRPC)
export type {
  QueueOptions,
  UserEligibilityFactors,
  ScoredUser,
  QueueEntry,
  QueueFilters,
  QueueResult,
  QueueRefreshResult,
  PriorityScore,
  QueueAssignment,
  QueueStats
} from './types/queue.types'

// Components (will be added later)
// export { QueueDashboard } from './components/QueueDashboard'
// export { QueueTable } from './components/QueueTable'
// export { PriorityBadge } from './components/PriorityBadge'

// Hooks (will be added later)
// export { useQueue } from './hooks/useQueue'
// export { useQueueStats } from './hooks/useQueueStats'

// Utils (will be added later)
// export { calculatePriority } from './utils/scoring.utils'
