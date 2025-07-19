// Users Module Exports
// Domain: User data management and call context building

// Services (main interface)
export { UserService, type CompleteUserDetails } from './services/user.service';

// Types (for other modules)
export type { 
  UserCallContext,
  ClaimContext,
  GetUserContextRequest,
  GetEligibleUsersRequest,
  GetEligibleUsersResponse,
  UserDataFromReplica,
  ClaimDataFromReplica,
  UserNotFoundError,
  DatabaseConnectionError,
  CacheError
} from './types/user.types';

// Note: Components, hooks, and utils will be added as they're implemented
// export { UserContextPanel } from './components/UserContextPanel'
// export { useUserContext } from './hooks/useUserContext'
// export { formatUserName } from './utils/user.utils'
