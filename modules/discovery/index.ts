// Discovery Module - Data Ingestion & Change Tracking
// This module handles data discovery, ingestion, and conversion tracking from MySQL to PostgreSQL

// Services (main business logic)
export { NewUsersDiscoveryService } from './services/new-users-discovery.service'
export { NewRequirementsDiscoveryService } from './services/new-requirements-discovery.service'
export { SignatureConversionCleanupService } from './services/signature-conversion-cleanup.service'
// TODO: Add remaining discovery services as they're implemented
// export { UnsignedConversionService } from './services/unsigned-conversion.service'
// export { RequirementsConversionService } from './services/requirements-conversion.service'

// Types (for other modules and tRPC)
export type {
  // Base types
  DiscoveryServiceDependencies,
  DiscoveryOptions,
  DiscoveryConfig,
  BaseDiscoveryResult,
  
  // Service-specific result types
  NewUsersDiscoveryResult,
  SignatureConversionResult,
  UnsignedConversionResult,
  RequirementsConversionResult,
  NewRequirementsDiscoveryResult,
  
  // Data structure types
  NewUserData,
  SignatureConversionData,
  ConversionData,
  NewRequirementData
} from './types/discovery.types'

export const DISCOVERY_MODULE_VERSION = '1.0.0' 