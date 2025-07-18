// Core Module - Shared Infrastructure
// This module provides shared utilities, types, and components for all other modules

// Services (shared business logic)
// export { DatabaseService } from './services/database.service'
// export { CacheService } from './services/cache.service'
// export { LoggerService } from './services/logger.service'

// Types (core shared types)
// export type { ApiResponse, PaginationMeta } from './types/api.types'
// export type { BaseEntity, Timestamps } from './types/common.types'

// Components (shared UI components)
// export { Button } from './components/ui/button'
// export { Card } from './components/ui/card'
// export { Dialog } from './components/ui/dialog'

// Hooks (core React hooks)
// export { useLocalStorage } from './hooks/useLocalStorage'

// Utils (core utilities) - ACTIVE EXPORTS
export { logger } from './utils/logger.utils';
// export { cn } from './utils/styles.utils'
// export { formatDate } from './utils/date.utils'
// export { validateEmail } from './utils/validation.utils'

// Note: Uncomment exports as services, components, and utilities are implemented
export const CORE_MODULE_VERSION = '1.0.0';
