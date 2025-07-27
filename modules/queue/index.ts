// Queue Module - Call Queue Management & Priority Scoring
// This module handles intelligent call queue management, user prioritization, and queue assignment

// Core queue services
export { QueueAdapterService as QueueService } from './services/queue-adapter.service';
export { UnsignedUsersQueueService } from './services/unsigned-users-queue.service';
export { OutstandingRequestsQueueService } from './services/outstanding-requests-queue.service';

// New separated queue generation services  
export { UnsignedUsersQueueGenerationService } from './services/unsigned-users-queue-generation.service';
export { OutstandingRequestsQueueGenerationService } from './services/outstanding-requests-queue-generation.service';
export { SeparatedQueuePopulationService } from './services/separated-queue-population.service';

// Legacy services - marked for removal
export { QueueGenerationService } from './services/queue-generation.service'; // @deprecated - Remove in Phase 3
export { PreCallValidationService } from './services/pre-call-validation.service'; // @deprecated - Remove in Phase 3

// Other queue services
export { LeadScoringService } from './services/lead-scoring.service';
export { DailyAgingService } from './services/daily-aging.service';
export { LeadDiscoveryOptimizedService } from './services/lead-discovery-optimized.service';

// Types (avoiding duplicate QueueStats export)
export type { QueueOptions, UserEligibilityFactors, ScoredUser, QueueEntry, QueueFilters, QueueResult, QueueRefreshResult, PriorityScore, QueueAssignment } from './types/queue.types';
export type { QueueServiceDependencies, NextUserForCallResult, QueueHealthStatus, UnsignedUsersQueueEntry, OutstandingRequestsQueueEntry, QueueStats as SeparatedQueueStats } from './types/separated-queue.types';

// Factory for organized service creation
export { QueueServiceFactory, createQueueAdapter, createQueueServiceFactory } from './services/index'

// Components (will be added later)
// export { QueueDashboard } from './components/QueueDashboard'
// export { QueueTable } from './components/QueueTable'
// export { PriorityBadge } from './components/PriorityBadge'

// Hooks (will be added later)
// export { useQueue } from './hooks/useQueue'
// export { useQueueStats } from './hooks/useQueueStats'

// Utils (will be added later)
// export { calculatePriority } from './utils/scoring.utils'
