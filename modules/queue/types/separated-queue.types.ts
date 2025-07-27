/**
 * Simplified Separated Queue Types
 * 
 * Essential type definitions for queue storage and retrieval operations only.
 * Business logic is handled by existing cron jobs and pre-call validation.
 */

import { QueueType } from './queue.types';

// ============================================================================
// BASIC QUEUE INTERFACES
// ============================================================================

export interface BaseQueueEntry {
  id: string;
  userId: bigint;
  claimId?: bigint | null;
  priorityScore: number;
  queuePosition?: number | null;
  status: QueueStatus;
  queueReason?: string | null;
  assignedToAgentId?: number | null;
  assignedAt?: Date | null;
  callbackId?: string | null;
  availableFrom?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type QueueStatus = 'pending' | 'assigned' | 'completed' | 'invalid';

// ============================================================================
// UNSIGNED USERS QUEUE (Simplified)
// ============================================================================

export interface UnsignedUsersQueueEntry extends BaseQueueEntry {
  // Minimal signature context (for queue identification only)
  signatureMissingSince?: Date | null;
  signatureType?: SignatureType | null;
}

export type SignatureType = 'initial' | 'update' | 'renewal' | 'correction';

export interface UnsignedQueueData {
  userId: bigint;
  claimId?: bigint;
  priorityScore?: number;
  signatureMissingSince?: Date;
  signatureType?: SignatureType;
  queueReason?: string;
  availableFrom?: Date;
}

// ============================================================================
// OUTSTANDING REQUESTS QUEUE (Simplified)
// ============================================================================

export interface OutstandingRequestsQueueEntry extends BaseQueueEntry {
  // Minimal requirements context (for queue identification only)
  requirementTypes: string[];
  totalRequirements: number;
  pendingRequirements: number;
  completedRequirements: number;
  oldestRequirementDate?: Date | null;
}

export interface OutstandingQueueData {
  userId: bigint;
  claimId?: bigint;
  priorityScore?: number;
  requirementTypes: string[];
  totalRequirements: number;
  pendingRequirements: number;
  oldestRequirementDate?: Date;
  queueReason?: string;
  availableFrom?: Date;
}

// ============================================================================
// QUEUE OPERATION RESULTS
// ============================================================================

export interface NextUserForCallResult {
  userId: number;
  userContext: any; // User context from existing system
  queuePosition: number;
  queueEntryId: string;
  queueType: QueueType;
  validationResult?: any;
}

export interface QueueStats {
  total: number;
  pending: number;
  assigned: number;
  completed: number;
  avgPriorityScore: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

// ============================================================================
// SERVICE INTERFACES (Simplified)
// ============================================================================

export interface QueueServiceDependencies {
  prisma: any; // PrismaClient type
  logger: any; // Logger interface
}

// Base queue service interface - simplified to essential operations
export interface BaseQueueService<TEntry, TData> {
  getNextUser(): Promise<TEntry | null>;
  addUserToQueue(data: TData): Promise<TEntry>;
  removeUserFromQueue(userId: bigint): Promise<boolean>;
  getUserQueueEntry(userId: bigint): Promise<TEntry | null>;
  getQueueStats(): Promise<QueueStats>;
}

// ============================================================================
// QUEUE ADAPTER INTERFACES (Simplified)
// ============================================================================

export interface QueueAdapterConfig {
  useNewQueues: boolean;
  fallbackToLegacy: boolean;
  validationEnabled: boolean;
}

// ============================================================================
// QUEUE HEALTH & MONITORING (Essential only)
// ============================================================================

export interface QueueHealthStatus {
  queueType: QueueType | 'all';
  isHealthy: boolean;
  totalUsers: number;
  pendingUsers: number;
  assignedUsers: number;
  avgWaitTime: number; // in minutes
  oldestPendingAge: number; // in hours
  issues: QueueHealthIssue[];
  lastUpdated: Date;
}

export interface QueueHealthIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  affectedUsers?: number;
  recommendedAction?: string;
}

// ============================================================================
// ERROR TYPES (Simplified)
// ============================================================================

export class QueueServiceError extends Error {
  constructor(
    message: string,
    public queueType: QueueType,
    public userId?: bigint,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'QueueServiceError';
  }
}

export class QueueValidationError extends QueueServiceError {
  constructor(message: string, queueType: QueueType, userId: bigint) {
    super(message, queueType, userId);
    this.name = 'QueueValidationError';
  }
}

// ============================================================================
// CALLBACK INTEGRATION TYPES
// ============================================================================

export interface CallbackUser {
  id: string;
  userId: bigint;
  scheduledFor: Date;
  callbackReason?: string;
  preferredAgentId?: number;
  originalCallSessionId: string;
}

// ============================================================================
// MIGRATION SUPPORT (Essential only)
// ============================================================================

export interface LegacyQueueEntry {
  id: string;
  userId: bigint;
  queueType: string;
  priorityScore: number;
  status: string;
  createdAt: Date;
} 