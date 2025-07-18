// Queue Module Types
// Domain types for call queue management and user prioritization

export interface QueueOptions {
  limit?: number;
  status?: 'pending' | 'assigned' | 'completed';
  agentId?: number;
}

export interface UserEligibilityFactors {
  userId: number;
  claimId?: number;
  daysSinceLastContact: number;
  pendingRequirements: number;
  claimValue: number;
  lastOutcome?: string;
  totalAttempts: number;
  preferredCallTime?: [number, number]; // [startHour, endHour]
  lastCallAt?: Date;
  scheduledCallback?: Date;
}

export interface ScoredUser extends UserEligibilityFactors {
  score: number;
  reason: string;
  nextCallAfter: Date;
}

export interface QueueEntry {
  id: string;
  userId: number;
  claimId?: number;
  queueType: 'priority_call' | 'callback' | 'follow_up';
  priorityScore: number;
  queuePosition?: number;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  queueReason?: string;
  assignedToAgentId?: number;
  assignedAt?: Date;
  callbackId?: string;
  availableFrom?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueFilters {
  page?: number;
  limit?: number;
  status?: 'pending' | 'assigned' | 'completed';
  agentId?: number;
  queueType?: 'priority_call' | 'callback' | 'follow_up';
}

export interface QueueResult {
  entries: QueueEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface QueueRefreshResult {
  usersAdded: number;
  queueSize: number;
}

export interface PriorityScore {
  base: number;
  outcomePenalty: number;
  timePenalty: number;
  total: number;
  factors: string[];
}

// Queue assignment types
export interface QueueAssignment {
  queueId: string;
  agentId: number;
  assignedAt: Date;
}

export interface QueueStats {
  queue: {
    pending: number;
    assigned: number;
    completedToday: number;
  };
  lastRefresh: string;
  averageWaitTime: number;
  topPriorityScore: number;
} 