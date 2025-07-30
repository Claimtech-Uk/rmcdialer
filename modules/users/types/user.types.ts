// User Types for Dialler System
// Combines data from MySQL replica (main app) + PostgreSQL (dialler features)

export interface UserCallContext {
  user: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    email: string | null;
    status: string | null;
    isEnabled: boolean | null;
    introducer: string | null;
    solicitor: string | null;
    lastLogin: Date | null;
    dateOfBirth: Date | null;
    createdAt: Date | null;
    address: UserAddressContext | null;
  };
  claims: ClaimContext[];
  callScore: CallScoreContext | null;
}

export interface UserAddressContext {
  id: string;
  type: string | null;
  fullAddress: string | null;
  postCode: string | null;
  county: string | null;
}

export interface ClaimContext {
  id: number;
  type: string | null;
  status: string | null;
  lender: string | null;
  solicitor: string | null;
  lastUpdated: Date | null;
  requirements: RequirementContext[];
  vehiclePackages: VehiclePackageContext[];
}

export interface RequirementContext {
  id: string;
  type: string | null;
  status: string | null;
  reason: string | null;
  rejectionReason: string | null;
  createdAt: Date | null;
}

export interface VehiclePackageContext {
  id: string;
  registration: string | null;
  make: string | null;
  model: string | null;
  dealership: string | null;
  monthlyPayment: number | null;
  contractStartDate: Date | null;
  status: string | null;
}

export interface CallScoreContext {
  currentScore: number;
  totalAttempts: number;
  successfulCalls: number;
  lastOutcome: string | null;
  nextCallAfter: Date | null;
  lastCallAt: Date | null;
  baseScore: number;
  outcomePenaltyScore: number;
  timePenaltyScore: number;
}

// API Request/Response Types
export interface GetUserContextRequest {
  userId: number;
  includeCallHistory?: boolean;
}

export interface GetEligibleUsersRequest {
  limit?: number;
  offset?: number;
  filters?: {
    hasRequirements?: boolean;
    claimTypes?: string[];
    maxScore?: number;
    excludeRecentCalls?: boolean;
  };
}

export interface GetEligibleUsersResponse {
  users: UserCallContext[];
  total: number;
  page: number;
  limit: number;
}

// Database Query Types
export interface UserDataFromReplica {
  id: bigint;
  first_name: string | null;
  last_name: string | null;
  email_address: string | null;
  phone_number: string | null;
  date_of_birth: Date | null;
  status: string | null;
  is_enabled: boolean | null;
  introducer: string | null;
  solicitor: string | null;
  current_user_address_id: string | null;
  last_login: Date | null;
  created_at: Date | null;
  claims: ClaimDataFromReplica[];
  address: UserAddressDataFromReplica | null;
}

export interface ClaimDataFromReplica {
  id: bigint;
  user_id: bigint;
  type: string | null;
  status: string | null;
  lender: string | null;
  solicitor: string | null;
  client_last_updated_at: Date | null;
  created_at: Date | null;
  requirements: RequirementDataFromReplica[];
  vehiclePackages: VehiclePackageDataFromReplica[];
}

export interface UserAddressDataFromReplica {
  id: string;
  user_id: number;
  type: string | null;
  full_address: string | null;
  post_code: string | null;
  county: string | null;
  created_at: Date | null;
}

export interface RequirementDataFromReplica {
  id: string;
  claim_id: bigint;
  type: string | null;
  status: string | null;
  claim_requirement_reason: string | null;
  claim_requirement_rejection_reason: string | null;
  created_at: Date | null;
}

export interface VehiclePackageDataFromReplica {
  id: string;
  claim_id: bigint;
  vehicle_registration: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  dealership_name: string | null;
  monthly_payment: number | null;
  contract_start_date: Date | null;
  status: string | null;
}

// Cache Types
export interface CacheKeyPatterns {
  userContext: (userId: number) => string;
  userClaims: (userId: number) => string;
  eligibleUsers: (filters?: string) => string;
  userScore: (userId: number) => string;
}

export interface CacheTTLs {
  USER_CONTEXT: number;
  USER_CLAIMS: number;
  ELIGIBLE_USERS: number;
  USER_SCORE: number;
}

// Error Types
export class UserNotFoundError extends Error {
  constructor(userId: number) {
    super(`User with ID ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}

export class DatabaseConnectionError extends Error {
  constructor(database: 'mysql' | 'postgresql', originalError: Error) {
    super(`Failed to connect to ${database}: ${originalError.message}`);
    this.name = 'DatabaseConnectionError';
  }
}

export class CacheError extends Error {
  constructor(operation: string, originalError: Error) {
    super(`Cache ${operation} failed: ${originalError.message}`);
    this.name = 'CacheError';
  }
} 