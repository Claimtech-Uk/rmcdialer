// =============================================================================
// Queue Health Check Types - Health Module
// =============================================================================
// TypeScript interfaces for queue health check system

export type QueueType = 'unsigned_users' | 'outstanding_requests';

export interface HealthCheckOptions {
  batchSize?: number;
  offset?: number;
  maxUsers?: number;
  dryRun?: boolean;
}

export interface BatchResult {
  checked: number;
  updated: number;
  correctQueue: number;
  wrongQueue: number;
  issues: {
    notInUserCallScores: number;
    noQueueTypeAssigned: number;
    wrongQueueType: number;
    markedInactive: number;
    inCooldown: number;
    shouldBeInQueue: number;
    alreadyInQueue: number;
  };
  queueDistribution: {
    unsigned_users: number;
    outstanding_requests: number;
    none: number;
  };
  userChanges: UserChange[];  // Track individual user changes for audit
}

export interface QueueHealthStats {
  checked: number;
  updated: number;
  correctQueue: number;
  wrongQueue: number;
  queueDistribution: {
    unsigned_users: number;
    outstanding_requests: number;
    none: number;
  };
  issues: {
    notInUserCallScores: number;
    noQueueTypeAssigned: number;
    wrongQueueType: number;
    markedInactive: number;
    inCooldown: number;
    shouldBeInQueue: number;
    alreadyInQueue: number;
  };
}

export interface ProgressInfo {
  total: number;
  processed: number;
  percentage: number;
}

export interface UserChange {
  userId: string;
  userName?: string;
  phoneNumber?: string;
  previousQueueType: string | null;
  newQueueType: string | null;
  changeReason: string;
  hasSignature: boolean;
  activeClaims: number;
  pendingRequirements: number;
  timestamp: Date;
}

export interface QueueHealthResult {
  success: boolean;
  timestamp: Date;
  duration: number;
  timeoutHit: boolean;
  batchesProcessed: number;
  progress: ProgressInfo;
  stats: QueueHealthStats;
  summary: string;
  recommendations?: HealthRecommendation[];
  userChanges?: UserChange[];  // Detailed change log for spot checking
}

export interface HealthRecommendation {
  issue: string;
  count: number;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

// User data interface (from replica DB)
export interface UserWithClaims {
  id: bigint;
  status: string | null;
  current_signature_file_id: string | null;
  claims: ClaimWithRequirements[];
}

export interface ClaimWithRequirements {
  id: bigint;
  status: string;
  requirements: RequirementData[];
}

export interface RequirementData {
  id: string;
  type: string | null;
  status: string;
  claim_requirement_reason: string | null;
}

// Database record interfaces
export interface UserCallScoreData {
  userId: bigint;
  currentQueueType: string | null;
  currentScore: number;
  isActive: boolean;
  nextCallAfter: Date | null;
  createdAt: Date;
}

export interface HealthCheckHistoryRecord {
  id: string;
  executed_at: Date;
  duration_ms: number;
  success: boolean;
  timeout_hit: boolean;
  total_checked: number;
  total_updated: number;
  unsigned_users_count: number;
  outstanding_requests_count: number;
  no_queue_count: number;
  summary_message: string | null;
  can_resume: boolean;
  next_offset: number | null;
}

export interface HealthCheckHistoryResponse {
  success: boolean;
  period: string;
  summary: {
    total_runs: number;
    successful_runs: number;
    timeout_runs: number;
    avg_duration_ms: number;
    total_users_checked: number;
    total_users_updated: number;
    avg_update_percentage: number;
  };
  results: Array<HealthCheckHistoryRecord & {
    update_percentage: string;
  }>;
}

// API Response types
export interface HealthCheckApiResponse extends QueueHealthResult {
  continuation?: {
    nextOffset: number;
    command: string;
  } | null;
}

// Service dependencies interface (following established pattern)
export interface HealthServiceDependencies {
  logger?: any;
  prisma?: any;
  replicaDb?: any;
}
