// Users Module Exports
// Domain: User data management and call context building

// Services (main interface)
export { UserService, type CompleteUserDetails } from './services/user.service';

// Types (for other modules and tRPC)
export type {
  UserCallContext,
  ClaimContext,
  UserAddressContext,
  RequirementContext,
  VehiclePackageContext,
  CallScoreContext,
  GetUserContextRequest,
  GetEligibleUsersRequest,
  GetEligibleUsersResponse,
  UserDataFromReplica,
  ClaimDataFromReplica,
  UserAddressDataFromReplica,
  RequirementDataFromReplica,
  VehiclePackageDataFromReplica
} from './types/user.types';

// Error classes (for proper error handling)
export {
  UserNotFoundError,
  DatabaseConnectionError,
  CacheError
} from './types/user.types';

// Components will be added later as we build the UI
// export { UserContext } from './components/UserContext';
// export { ClaimsSummary } from './components/ClaimsSummary';
// export { RequirementsList } from './components/RequirementsList';

// Hooks will be added later for React integration
// export { useUserContext } from './hooks/useUserContext';
// export { useClaims } from './hooks/useClaims';

// Utils will be added as needed
// export { userUtils } from './utils/user.utils';
