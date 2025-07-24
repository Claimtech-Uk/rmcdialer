// Discovery Module Types
// Domain types for data discovery, ingestion, and change tracking

import type { QueueType } from '@/modules/queue/types/queue.types'

// Service dependencies (following pattern from other modules)
export interface DiscoveryServiceDependencies {
  logger: {
    info: (message: string, meta?: any) => void
    error: (message: string, error?: any) => void
    warn: (message: string, meta?: any) => void
  }
}

// Base discovery result interface
export interface BaseDiscoveryResult {
  timestamp: Date
  duration: number
  success: boolean
  errors: string[]
  summary: string
}

// Cron 1: New Users Discovery
export interface NewUsersDiscoveryResult extends BaseDiscoveryResult {
  usersChecked: number
  newUsersFound: number
  newUsersCreated: number
  skippedExisting: number
  unsigned: number
  signed: number
}

// Cron 2: Signature Conversion Cleanup
export interface SignatureConversionResult extends BaseDiscoveryResult {
  totalUnsignedUsers: number
  usersChecked: number
  conversionsFound: number
  usersUpdated: number
  batchesProcessed: number
  processingStrategy: string
  completed: boolean
  conversions: SignatureConversionData[]
}

// Cron 2: Unsigned Conversion Tracking (Legacy)
export interface UnsignedConversionResult extends BaseDiscoveryResult {
  usersChecked: number
  conversionsFound: number
  conversionsRecorded: number
  stillUnsigned: number
}

// Cron 3: Requirements Conversion Tracking  
export interface RequirementsConversionResult extends BaseDiscoveryResult {
  usersChecked: number
  conversionsFound: number
  conversionsRecorded: number
  stillPending: number
}

// Cron 4: New Requirements Discovery
export interface NewRequirementsDiscoveryResult extends BaseDiscoveryResult {
  requirementsChecked: number
  newRequirementsFound: number
  usersUpdated: number
  skippedUnsigned: number
  excludedTypes: number
}

// Shared data structures
export interface NewUserData {
  id: bigint
  queueType: QueueType | null
  hasSignature: boolean
}

export interface SignatureConversionData {
  userId: bigint
  signatureFileId: number
  convertedAt: Date
}

export interface ConversionData {
  userId: bigint
  oldStatus: string
  newStatus: string
  conversionType: 'signature' | 'requirements'
  detectedAt: Date
}

export interface NewRequirementData {
  requirementId: string
  userId: bigint
  claimId: number
  type: string
  status: string
  createdAt: Date
}

// Configuration types
export interface DiscoveryConfig {
  batchSize: number
  maxExecutionTime: number
  timeWindowHours: number
  excludedRequirementTypes: string[]
}

// Service options
export interface DiscoveryOptions {
  hoursBack?: number
  dryRun?: boolean
  forceRefresh?: boolean
  batchSize?: number
}

// =============================================================================
// ONE-OFF MIGRATION: Queue Type Backfill
// =============================================================================

// Types for the one-time migration to backfill currentQueueType for existing users

export interface QueueTypeMigrationResult extends BaseDiscoveryResult {
  totalUsersChecked: number
  usersWithNullQueue: number
  usersProcessed: number
  unsignedUsersUpdated: number
  signedUsersSkipped: number
  batchesProcessed: number
  progress: {
    processed: number
    total: number
    percentage: number
  }
}

export interface UserQueueMigrationData {
  userId: bigint
  currentQueueType: string | null
  shouldBeUnsigned: boolean
  hasSignature: boolean
  currentSignatureFileId: number | null
}

export interface MigrationOptions extends DiscoveryOptions {
  batchSize?: number
  maxUsers?: number
  offset?: number
}

// =============================================================================
// QUEUE TYPE MIGRATION: Requirements to Outstanding Requests
// =============================================================================

export interface RequirementsToOutstandingMigrationResult extends BaseDiscoveryResult {
  totalUsersChecked: number
  usersWithRequirementsQueue: number
  usersUpdated: number
  batchesProcessed: number
  progress: {
    processed: number
    total: number
    percentage: number
  }
}

export interface RequirementsMigrationOptions extends DiscoveryOptions {
  batchSize?: number
  maxUsers?: number
  offset?: number
}

// =============================================================================
// NULL Queue Backfill Migration Types
// =============================================================================

export interface NullQueueBackfillResult {
  timestamp: Date
  duration: number
  success: boolean
  errors: string[]
  summary: string
  
  // Analysis metrics
  totalNullUsers: number
  signedUsers: number
  unsignedUsers: number
  usersWithRequirements: number
  usersWithoutRequirements: number
  
  // Update results
  usersUpdatedToOutstandingRequests: number
  usersSkippedUnsigned: number
  usersSkippedNoRequirements: number
  
  // Performance
  batchesProcessed: number
  progress: {
    processed: number
    total: number
    percentage: number
  }
}

export interface NullQueueBackfillOptions {
  dryRun?: boolean
  batchSize?: number
  maxUsers?: number
  offset?: number
  timeoutSeconds?: number
} 