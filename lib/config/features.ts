/**
 * Feature Flags for Queue Separation Migration
 * 
 * This module provides type-safe feature flags for the gradual rollout
 * of separated queue tables (unsigned_users_queue & outstanding_requests_queue)
 */

// ============================================================================
// QUEUE MIGRATION FEATURE FLAGS
// ============================================================================

export const QUEUE_MIGRATION_FLAGS = {
  // Phase 1: Infrastructure flags
  USE_SEPARATED_QUEUES: process.env.USE_SEPARATED_QUEUES === 'true' || true, // Enable for testing
  DUAL_WRITE_QUEUES: process.env.DUAL_WRITE_QUEUES === 'true',
  MIGRATE_TO_NEW_QUEUES: process.env.MIGRATE_TO_NEW_QUEUES === 'true' || true, // Enable for testing
  
  // Phase 2: Service layer flags
  USE_NEW_QUEUE_SERVICES: process.env.USE_NEW_QUEUE_SERVICES === 'true' || true, // Enable for testing
  ENABLE_QUEUE_VALIDATION: process.env.ENABLE_QUEUE_VALIDATION === 'true' || true, // Enable for testing
  
  // Phase 3: Migration-specific flags
  MIGRATION_MODE: (process.env.MIGRATION_MODE as 'off' | 'dual-write' | 'dual-read' | 'new-only') || 'new-only', // Enable new-only for testing
  MIGRATION_BATCH_SIZE: parseInt(process.env.MIGRATION_BATCH_SIZE || '100'),
  MIGRATION_DRY_RUN: process.env.MIGRATION_DRY_RUN === 'true',
  
  // Phase 4: Monitoring and safety flags
  ENABLE_MIGRATION_MONITORING: process.env.ENABLE_MIGRATION_MONITORING === 'true' || true, // Enable for testing
  ENABLE_PERFORMANCE_TRACKING: process.env.ENABLE_PERFORMANCE_TRACKING === 'true',
  ENABLE_DATA_VALIDATION: process.env.ENABLE_DATA_VALIDATION === 'true',
  
  // Phase 5: Rollback and emergency flags
  EMERGENCY_ROLLBACK: process.env.EMERGENCY_ROLLBACK === 'true',
  DISABLE_NEW_QUEUES: process.env.DISABLE_NEW_QUEUES === 'true',
  
  // Development and testing flags
  SKIP_MIGRATION_CHECKS: process.env.NODE_ENV === 'development' && process.env.SKIP_MIGRATION_CHECKS === 'true',
  ENABLE_QUEUE_DEBUG: process.env.ENABLE_QUEUE_DEBUG === 'true' || true // Enable for testing
} as const;

// ============================================================================
// INBOUND CALL ENHANCEMENT FEATURE FLAGS
// ============================================================================

export const INBOUND_CALL_FLAGS = {
  // Phase 1: Enhanced Agent Availability
  ENHANCED_AGENT_HEARTBEAT: process.env.FEATURE_AGENT_HEARTBEAT === 'true',
  DEVICE_CONNECTIVITY_CHECK: process.env.FEATURE_DEVICE_CONNECTIVITY === 'true',
  ENHANCED_AGENT_DISCOVERY: process.env.FEATURE_ENHANCED_DISCOVERY === 'true',
  
  // Phase 2: Queue-Based Call Holding
  ENHANCED_INBOUND_QUEUE: process.env.FEATURE_ENHANCED_QUEUE === 'true',
  QUEUE_HOLD_MUSIC: process.env.FEATURE_QUEUE_HOLD_MUSIC === 'true',
  QUEUE_POSITION_UPDATES: process.env.FEATURE_QUEUE_POSITION === 'true',
  
  // Phase 3: Continuous Agent Discovery
  MULTI_AGENT_FALLBACK: process.env.FEATURE_MULTI_AGENT === 'true',
  CONTINUOUS_AGENT_POLLING: process.env.FEATURE_AGENT_POLLING === 'true',
  AGENT_FAILOVER: process.env.FEATURE_AGENT_FAILOVER === 'true',
  
  // Phase 4: Advanced Features
  PRIORITY_QUEUE_MANAGEMENT: process.env.FEATURE_PRIORITY_QUEUE === 'true',
  SMART_LOAD_BALANCING: process.env.FEATURE_LOAD_BALANCING === 'true',
  CALLBACK_REQUEST_SYSTEM: process.env.FEATURE_CALLBACK_SYSTEM === 'true',
  
  // Development and monitoring
  INBOUND_CALL_DEBUG: process.env.INBOUND_CALL_DEBUG === 'true',
  AGENT_HEARTBEAT_INTERVAL: parseInt(process.env.AGENT_HEARTBEAT_INTERVAL || '300'), // seconds (5 minutes - more reasonable timeout)
  QUEUE_POLLING_INTERVAL: parseInt(process.env.QUEUE_POLLING_INTERVAL || '10'), // seconds
  MAX_QUEUE_WAIT_TIME: parseInt(process.env.MAX_QUEUE_WAIT_TIME || '3600'), // seconds (1 hour - will be handled intelligently)
  
  // Agent validation thresholds
  AGENT_READINESS_THRESHOLD: parseInt(process.env.AGENT_READINESS_THRESHOLD || '70') // Minimum readiness score for agent availability
} as const;

// ============================================================================
// MIGRATION STATE MANAGEMENT
// ============================================================================

export type MigrationPhase = 
  | 'pre-migration'     // Before any changes
  | 'dual-write'        // Writing to both old and new tables
  | 'dual-read'         // Reading from new, writing to both
  | 'new-only'          // Only using new tables
  | 'cleanup'           // Removing old tables
  | 'emergency-rollback'; // Emergency fallback to old system

export function getCurrentMigrationPhase(): MigrationPhase {
  if (QUEUE_MIGRATION_FLAGS.EMERGENCY_ROLLBACK) {
    return 'emergency-rollback';
  }
  
  if (QUEUE_MIGRATION_FLAGS.DISABLE_NEW_QUEUES) {
    return 'pre-migration';
  }
  
  switch (QUEUE_MIGRATION_FLAGS.MIGRATION_MODE) {
    case 'dual-write':
      return 'dual-write';
    case 'dual-read':
      return 'dual-read';
    case 'new-only':
      return 'new-only';
    default:
      return 'pre-migration';
  }
}

export function shouldUseNewQueues(): boolean {
  const phase = getCurrentMigrationPhase();
  return phase === 'dual-read' || phase === 'new-only' || phase === 'cleanup' || QUEUE_MIGRATION_FLAGS.USE_SEPARATED_QUEUES; // Enable for testing
}

export function shouldDualWrite(): boolean {
  const phase = getCurrentMigrationPhase();
  return phase === 'dual-write' || phase === 'dual-read';
}

export function shouldUseLegacyQueues(): boolean {
  const phase = getCurrentMigrationPhase();
  return (phase === 'pre-migration' || phase === 'dual-write' || phase === 'emergency-rollback') && !QUEUE_MIGRATION_FLAGS.USE_SEPARATED_QUEUES; // Disable legacy if using separated
}

// ============================================================================
// FEATURE FLAG VALIDATION
// ============================================================================

export interface MigrationFlagValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateMigrationFlags(): MigrationFlagValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for conflicting flags
  if (QUEUE_MIGRATION_FLAGS.EMERGENCY_ROLLBACK && QUEUE_MIGRATION_FLAGS.USE_SEPARATED_QUEUES) {
    errors.push('Cannot enable emergency rollback and separated queues simultaneously');
  }
  
  if (QUEUE_MIGRATION_FLAGS.DUAL_WRITE_QUEUES && !QUEUE_MIGRATION_FLAGS.USE_SEPARATED_QUEUES) {
    warnings.push('Dual write enabled but separated queues disabled - dual write will be ignored');
  }
  
  // Check migration batch size
  if (QUEUE_MIGRATION_FLAGS.MIGRATION_BATCH_SIZE < 10 || QUEUE_MIGRATION_FLAGS.MIGRATION_BATCH_SIZE > 1000) {
    warnings.push(`Migration batch size ${QUEUE_MIGRATION_FLAGS.MIGRATION_BATCH_SIZE} may not be optimal (recommended: 50-200)`);
  }
  
  // Check environment-specific configurations
  if (process.env.NODE_ENV === 'production') {
    if (QUEUE_MIGRATION_FLAGS.MIGRATION_DRY_RUN) {
      warnings.push('Dry run mode enabled in production - migration will not execute');
    }
    
    if (QUEUE_MIGRATION_FLAGS.SKIP_MIGRATION_CHECKS) {
      errors.push('Cannot skip migration checks in production environment');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================================
// ENVIRONMENT CONFIGURATION HELPERS
// ============================================================================

export interface QueueEnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  migrationPhase: MigrationPhase;
  recommendedFlags: Record<string, string>;
  safetyChecks: string[];
}

export function getEnvironmentConfig(): QueueEnvironmentConfig {
  const env = process.env.NODE_ENV as 'development' | 'staging' | 'production' || 'development';
  const phase = getCurrentMigrationPhase();
  
  const baseFlags = {
    ENABLE_MIGRATION_MONITORING: 'true',
    ENABLE_DATA_VALIDATION: 'true',
    MIGRATION_BATCH_SIZE: '100'
  };
  
  const environmentConfigs = {
    development: {
      environment: env,
      migrationPhase: phase,
      recommendedFlags: {
        ...baseFlags,
        ENABLE_QUEUE_DEBUG: 'true',
        MIGRATION_DRY_RUN: 'true'
      },
      safetyChecks: [
        'Verify schema changes in development database',
        'Run migration scripts with dry-run enabled',
        'Test rollback procedures'
      ]
    },
    staging: {
      environment: env,
      migrationPhase: phase,
      recommendedFlags: {
        ...baseFlags,
        ENABLE_PERFORMANCE_TRACKING: 'true'
      },
      safetyChecks: [
        'Full data backup completed',
        'Migration scripts tested in development',
        'Rollback procedures verified',
        'Monitoring dashboards configured'
      ]
    },
    production: {
      environment: env,
      migrationPhase: phase,
      recommendedFlags: {
        ...baseFlags,
        ENABLE_PERFORMANCE_TRACKING: 'true',
        ENABLE_MIGRATION_MONITORING: 'true'
      },
      safetyChecks: [
        'Database backups verified and tested',
        'Migration tested in staging environment',
        'Emergency rollback procedures tested',
        'Team on standby during migration',
        'Communication plan activated',
        'Monitoring alerts configured'
      ]
    }
  };
  
  return environmentConfigs[env];
}

// ============================================================================
// FEATURE FLAG UTILITIES
// ============================================================================

export function logFeatureFlagStatus(): void {
  const validation = validateMigrationFlags();
  const phase = getCurrentMigrationPhase();
  const config = getEnvironmentConfig();
  
  console.log('🎯 Queue Migration Feature Flags Status:');
  console.log(`   📍 Environment: ${config.environment}`);
  console.log(`   📊 Migration Phase: ${phase}`);
  console.log(`   ✅ Flags Valid: ${validation.isValid}`);
  
  if (validation.errors.length > 0) {
    console.log('   ❌ Errors:');
    validation.errors.forEach(error => console.log(`      - ${error}`));
  }
  
  if (validation.warnings.length > 0) {
    console.log('   ⚠️  Warnings:');
    validation.warnings.forEach(warning => console.log(`      - ${warning}`));
  }
  
  console.log('   🔧 Active Flags:');
  Object.entries(QUEUE_MIGRATION_FLAGS)
    .filter(([_, value]) => value === true || (typeof value === 'string' && value !== 'off'))
    .forEach(([key, value]) => console.log(`      - ${key}: ${value}`));
}

// ============================================================================
// ORIGINAL FEATURE FLAGS (Preserved for Compatibility)
// ============================================================================

export interface OriginalFeatureFlags {
  GLOBAL_TWILIO: boolean;
  ENHANCED_QUEUE: boolean;
  FLOATING_STATUS: boolean;
  BACKGROUND_SESSIONS: boolean;
  KEYBOARD_SHORTCUTS: boolean;
  PERFORMANCE_MODE: boolean;
}

const ORIGINAL_FLAGS: OriginalFeatureFlags = {
  GLOBAL_TWILIO: process.env.NEXT_PUBLIC_ENABLE_GLOBAL_TWILIO !== 'false',
  ENHANCED_QUEUE: process.env.NEXT_PUBLIC_ENABLE_ENHANCED_QUEUE !== 'false',
  FLOATING_STATUS: process.env.NEXT_PUBLIC_ENABLE_FLOATING_STATUS !== 'false',
  BACKGROUND_SESSIONS: process.env.NEXT_PUBLIC_ENABLE_BACKGROUND_SESSIONS !== 'false',
  KEYBOARD_SHORTCUTS: process.env.NEXT_PUBLIC_ENABLE_KEYBOARD_SHORTCUTS !== 'false',
  PERFORMANCE_MODE: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MODE !== 'false',
};

// ============================================================================
// COMBINED FEATURE FLAGS EXPORT
// ============================================================================

// Combined feature flags including both original and migration flags
export const FEATURE_FLAGS = {
  ...ORIGINAL_FLAGS,
  ...QUEUE_MIGRATION_FLAGS,
  // AI agents
  ENABLE_AI_SMS_AGENT: process.env.ENABLE_AI_SMS_AGENT !== 'false' // Default enabled (opt-out)
} as const;

// ============================================================================
// BACKWARDS COMPATIBILITY FUNCTIONS
// ============================================================================

export function useFeatureFlag(flag: keyof OriginalFeatureFlags): boolean {
  return ORIGINAL_FLAGS[flag];
}

export function isFeatureEnabled(flag: keyof OriginalFeatureFlags): boolean {
  return ORIGINAL_FLAGS[flag];
}

// Development helpers (preserved)
export const DevFeatures = {
  enableAll: () => Object.keys(ORIGINAL_FLAGS).reduce((acc, key) => ({ ...acc, [key]: true }), {} as OriginalFeatureFlags),
  disableAll: () => Object.keys(ORIGINAL_FLAGS).reduce((acc, key) => ({ ...acc, [key]: false }), {} as OriginalFeatureFlags),
  log: () => {
    console.log('🚀 Original Feature Flags Status:', ORIGINAL_FLAGS);
    logFeatureFlagStatus(); // Also log migration flags
  }
};

// Type-safe feature flag checking (preserved)
export function withFeature<T>(flag: keyof OriginalFeatureFlags, component: T, fallback: T | null = null): T | null {
  return isFeatureEnabled(flag) ? component : fallback;
} 

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type QueueMigrationFlags = typeof QUEUE_MIGRATION_FLAGS;
export type CombinedFeatureFlags = typeof FEATURE_FLAGS; 