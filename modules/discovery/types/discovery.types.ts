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

// Cron 2: Unsigned Conversion Tracking
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
} 