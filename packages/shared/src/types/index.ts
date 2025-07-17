// Core API Response Format
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Agent Types
export interface Agent {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'agent' | 'supervisor' | 'admin';
  isActive: boolean;
  isAiAgent: boolean;
  twilioWorkerSid?: string;
  createdAt: Date;
}

export interface AgentSession {
  id: string;
  agentId: number;
  status: 'available' | 'on_call' | 'break' | 'offline';
  currentCallSessionId?: string;
  loginAt: Date;
  logoutAt?: Date;
  callsCompletedToday: number;
  totalTalkTimeSeconds: number;
}

// User Types (from replica database)
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: string;
  isEnabled: boolean;
  introducer?: string;
  solicitor?: string;
  currentUserAddressId?: string;
  lastLogin?: Date;
  createdAt: Date;
}

export interface UserAddress {
  id: string;
  userId: number;
  type: 'address_now' | 'previous_address';
  fullAddress: string;
  postCode: string;
  county: string;
  createdAt: Date;
}

// Claim Types (from replica database)
export interface Claim {
  id: number;
  userId: number;
  type: 'VEHICLE' | 'BANK_FRAUD' | 'PERSONAL_LOAN' | 'CREDIT_CARD';
  status: 'incomplete' | 'documents_needed' | 'complete' | 'processing';
  lender: string;
  solicitor?: string;
  clientLastUpdatedAt?: Date;
  createdAt: Date;
}

export interface ClaimRequirement {
  id: string;
  claimId: number;
  type: 'ID_DOCUMENT' | 'BANK_STATEMENTS' | 'PROOF_OF_ADDRESS' | 'VEHICLE_REGISTRATION';
  status: 'PENDING' | 'UPLOADED' | 'APPROVED' | 'REJECTED';
  claimRequirementReason?: string;
  claimRequirementRejectionReason?: string;
  createdAt: Date;
}

export interface ClaimVehiclePackage {
  id: string;
  claimId: number;
  vehicleRegistration: string;
  vehicleMake: string;
  vehicleModel: string;
  dealershipName: string;
  monthlyPayment: number;
  contractStartDate: Date;
  status: 'ACTIVE' | 'SETTLED' | 'TERMINATED';
}

// Call Management Types
export interface UserCallScore {
  id: string;
  userId: number;
  currentScore: number;
  nextCallAfter?: Date;
  lastCallAt?: Date;
  totalAttempts: number;
  successfulCalls: number;
  lastOutcome?: CallOutcomeType;
  baseScore: number;
  outcomePenaltyScore: number;
  timePenaltyScore: number;
}

export interface CallQueue {
  id: string;
  userId: number;
  claimId: number;
  queueType: 'priority_call' | 'callback' | 'follow_up';
  priorityScore: number;
  queuePosition: number;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  queueReason: string;
  assignedToAgentId?: number;
  assignedAt?: Date;
  callbackId?: string;
  availableFrom?: Date;
  createdAt: Date;
}

export interface CallSession {
  id: string;
  userId: number;
  agentId: number;
  callQueueId: string;
  twilioCallSid?: string;
  status: 'initiated' | 'connecting' | 'connected' | 'completed' | 'failed';
  direction: 'outbound' | 'inbound';
  startedAt: Date;
  connectedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  talkTimeSeconds?: number;
  userClaimsContext?: any;
}

// Call Outcome Types
export type CallOutcomeType = 
  | 'contacted'
  | 'not_interested' 
  | 'callback_requested'
  | 'no_answer'
  | 'wrong_number'
  | 'voicemail'
  | 'busy'
  | 'disconnected';

export interface CallOutcome {
  id: string;
  callSessionId: string;
  outcomeType: CallOutcomeType;
  outcomeNotes?: string;
  nextCallDelayHours?: number;
  scoreAdjustment?: number;
  magicLinkSent: boolean;
  smsSent: boolean;
  documentsRequested?: string[];
  recordedByAgentId: number;
  createdAt: Date;
}

// Callback Types
export interface Callback {
  id: string;
  userId: number;
  scheduledFor: Date;
  callbackReason?: string;
  preferredAgentId?: number;
  originalCallSessionId: string;
  status: 'pending' | 'completed' | 'cancelled';
  completedCallSessionId?: string;
  createdAt: Date;
}

// Magic Link Types
export type MagicLinkType = 
  | 'firstLogin'
  | 'claimPortal'
  | 'documentUpload'
  | 'claimCompletion'
  | 'verification';

export interface MagicLinkActivity {
  id: string;
  userId: number;
  linkType: MagicLinkType;
  linkToken: string;
  sentVia: 'sms' | 'whatsapp' | 'email';
  sentByAgentId: number;
  sentAt: Date;
  accessedAt?: Date;
  callSessionId?: string;
  expiresAt?: Date;
  isActive: boolean;
  accessCount: number;
}

// SMS Types
export interface SmsConversation {
  id: string;
  userId?: number;
  phoneNumber: string;
  status: 'active' | 'closed' | 'opted_out';
  lastMessageAt: Date;
  assignedAgentId?: number;
  priority: 'normal' | 'high' | 'urgent';
  unreadCount: number;
}

export interface SmsMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  twilioMessageSid?: string;
  isAutoResponse: boolean;
  sentAt?: Date;
  receivedAt?: Date;
  createdAt: Date;
}

// Complete User Context for Calls
export interface UserCallContext {
  user: {
    id: number;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email: string;
    address?: {
      fullAddress: string;
      postCode: string;
      county: string;
    };
  };
  claims: Array<{
    id: number;
    type: string;
    status: string;
    lender: string;
    requirements: Array<{
      id: string;
      type: string;
      status: string;
      reason?: string;
    }>;
    vehiclePackages: Array<{
      registration: string;
      make: string;
      model: string;
      dealershipName: string;
      monthlyPayment: number;
    }>;
  }>;
  callScore: {
    currentScore: number;
    lastOutcome?: string;
    nextCallAfter?: Date;
    totalAttempts: number;
    successfulCalls: number;
  };
}

// JWT Payload
export interface JwtPayload {
  agentId: number;
  email: string;
  role: 'agent' | 'supervisor' | 'admin';
  iat: number;
  exp: number;
}

// Magic Link Result
export interface MagicLinkResult {
  id: string;
  url: string;
  token: string;
  expiresAt: Date;
  linkType: MagicLinkType;
}

// Magic Link Validation
export interface MagicLinkValidation {
  isValid: boolean;
  userId?: number;
  linkType?: MagicLinkType;
  agentId?: number;
  sessionId?: string;
  error?: string;
} 