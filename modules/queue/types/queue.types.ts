// Queue Module Types
// Domain types for call queue management and user prioritization

export interface QueueOptions {
  limit?: number;
  status?: 'pending' | 'assigned' | 'completed';
  agentId?: number;
  queueType?: QueueType; // Add queue type filtering
}

// Queue type definitions for the two main business cases + callbacks
export type QueueType = 
  | 'unsigned_users'      // Users missing signatures (current_signature_file_id IS NULL)
  | 'outstanding_requests' // Users with pending requirements BUT have signatures
  | 'callback';           // Users who requested to be called back from previous calls

export interface UserEligibilityFactors {
  userId: bigint;
  claimId?: bigint;
  daysSinceLastContact: number;
  pendingRequirements: number;
  claimValue: number;
  lastOutcome?: string;
  totalAttempts: number;
  preferredCallTime?: [number, number]; // [startHour, endHour]
  lastCallAt?: Date;
  scheduledCallback?: Date;
  // New fields for queue determination
  hasSignature: boolean;   // Whether current_signature_file_id exists
  signatureMissingSince?: Date; // When signature requirement was identified
}

export interface ScoredUser extends UserEligibilityFactors {
  score: number;
  reason: string;
  nextCallAfter: Date;
  queueType: QueueType; // Which queue this user belongs in
}

export interface QueueEntry {
  id: string;
  userId: bigint;
  claimId?: bigint | null;
  queueType: QueueType;
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
  queueType?: QueueType;
}

// Configuration for each queue type
export interface QueueTypeConfig {
  type: QueueType;
  displayName: string;
  description: string;
  eligibilityCriteria: string;
  priority: number; // 1 = highest priority
  maxDailyAttempts?: number;
  cooldownHours?: number;
}

export interface QueueResult {
  entries: QueueEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  queueType: QueueType;
}

export interface QueueRefreshResult {
  usersAdded: number;
  queueSize: number;
  queueType: QueueType;
}

// Stats broken down by queue type
export interface QueueStats {
  unsignedUsers: {
    pending: number;
    assigned: number;
    completedToday: number;
  };
  outstandingRequests: {
    pending: number;
    assigned: number;
    completedToday: number;
  };
  callbacks: {
    pending: number;
    assigned: number;
    completedToday: number;
  };
  lastRefresh: string;
  totalAgents: number;
  activeAgents: number;
  averageWaitTime: number;
  topPriorityScore: number;
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

// Queue configuration constants
export const QUEUE_CONFIGS: Record<QueueType, QueueTypeConfig> = {
  unsigned_users: {
    type: 'unsigned_users',
    displayName: 'Unsigned Users',
    description: 'Users who need to provide their signature',
    eligibilityCriteria: 'current_signature_file_id IS NULL',
    priority: 1, // Highest priority - blocks claim progress
    maxDailyAttempts: 3,
    cooldownHours: 4
  },
  outstanding_requests: {
    type: 'outstanding_requests',
    displayName: 'Outstanding Requests', 
    description: 'Users with pending document requirements (have signatures)',
    eligibilityCriteria: 'requirements.status = PENDING AND current_signature_file_id IS NOT NULL',
    priority: 2, // Medium priority - claim can progress but needs documents
    maxDailyAttempts: 2,
    cooldownHours: 6
  },
  callback: {
    type: 'callback',
    displayName: 'Scheduled Callbacks',
    description: 'Users who requested to be called back from previous calls',
    eligibilityCriteria: 'scheduled_callback_date <= NOW()',
    priority: 1, // High priority - user expectation set
    maxDailyAttempts: 2,
    cooldownHours: 24
  }
}; 