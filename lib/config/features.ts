export interface FeatureFlags {
  GLOBAL_TWILIO: boolean;
  ENHANCED_QUEUE: boolean;
  FLOATING_STATUS: boolean;
  BACKGROUND_SESSIONS: boolean;
  KEYBOARD_SHORTCUTS: boolean;
  PERFORMANCE_MODE: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  GLOBAL_TWILIO: true,
  ENHANCED_QUEUE: true,
  FLOATING_STATUS: true,
  BACKGROUND_SESSIONS: true,
  KEYBOARD_SHORTCUTS: true,
  PERFORMANCE_MODE: true,
};

export const FeatureFlags: FeatureFlags = {
  GLOBAL_TWILIO: process.env.NEXT_PUBLIC_ENABLE_GLOBAL_TWILIO !== 'false',
  ENHANCED_QUEUE: process.env.NEXT_PUBLIC_ENABLE_ENHANCED_QUEUE !== 'false',
  FLOATING_STATUS: process.env.NEXT_PUBLIC_ENABLE_FLOATING_STATUS !== 'false',
  BACKGROUND_SESSIONS: process.env.NEXT_PUBLIC_ENABLE_BACKGROUND_SESSIONS !== 'false',
  KEYBOARD_SHORTCUTS: process.env.NEXT_PUBLIC_ENABLE_KEYBOARD_SHORTCUTS !== 'false',
  PERFORMANCE_MODE: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MODE !== 'false',
};

export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  return FeatureFlags[flag] ?? DEFAULT_FLAGS[flag];
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return FeatureFlags[flag] ?? DEFAULT_FLAGS[flag];
}

// Development helpers
export const DevFeatures = {
  enableAll: () => Object.keys(DEFAULT_FLAGS).reduce((acc, key) => ({ ...acc, [key]: true }), {} as FeatureFlags),
  disableAll: () => Object.keys(DEFAULT_FLAGS).reduce((acc, key) => ({ ...acc, [key]: false }), {} as FeatureFlags),
  log: () => {
    console.log('🚀 Feature Flags Status:', FeatureFlags);
  }
};

// Type-safe feature flag checking
export function withFeature<T>(flag: keyof FeatureFlags, component: T, fallback: T | null = null): T | null {
  return isFeatureEnabled(flag) ? component : fallback;
} 