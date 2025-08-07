import type { CallOutcomeType } from '@/modules/call-outcomes/types/call-outcome.types';

// Calls Module Types
// Call sessions, outcomes, Twilio integration, and call analytics

// Call session types
export interface CallSession {
  id: string;
  userId: bigint;
  agentId: number;
  status: 'initiated' | 'connecting' | 'ringing' | 'connected' | 'completed' | 'failed' | 'no_answer';
  twilioCallSid?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  recordingDuration?: number;
  recordingStatus?: 'in-progress' | 'completed' | 'absent' | 'failed';
  startedAt: Date;
  endedAt?: Date;
  lastOutcomeType?: CallOutcomeType; // Updated to use unified type
  lastOutcomeNotes?: string;
  lastOutcomeAgentId?: number;
  lastOutcomeAt?: Date;
  magicLinkSent: boolean;
  smsSent: boolean;
  callbackScheduled: boolean;
  followUpRequired: boolean;
  callOutcomes?: CallOutcome[];
  recordingTranscript?: string;
  transcriptStatus?: 'processing' | 'completed' | 'failed';
  sourceQueueType?: string;
  // New fields for enhanced call management
  pausedAt?: Date;
  pausedByAgentId?: number;
  resumedAt?: Date;
  transferredTo?: number;
  transferReason?: string;
  escalatedAt?: Date;
  escalationReason?: string;
  customerSatisfactionScore?: number;
  callQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallSessionOptions {
  userId: number;
  agentId: number;
  queueId?: string;
  direction?: 'outbound' | 'inbound';
  phoneNumber?: string;
  twilioCallSid?: string; // For matching existing webhook sessions
  callSource?: string; // 🎯 NEW: Explicit call source ('missed_call', 'queue', 'manual')
  missedCallId?: string; // 🎯 NEW: For tracking missed call callbacks
}

export interface CallUpdateOptions {
  status?: 'initiated' | 'connecting' | 'ringing' | 'connected' | 'completed' | 'failed' | 'no_answer';
  twilioCallSid?: string;
  connectedAt?: Date;
  endedAt?: Date;
  failureReason?: string;
}

export interface CallSessionWithContext extends CallSession {
  userContext: UserCallContext;
  agent: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// User context for calls
export interface UserCallContext {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: Date | null;
  createdAt?: Date | null;
  address?: {
    fullAddress: string;
    houseNumber?: string;
    street?: string;
    buildingName?: string;
    postCode: string;
    county: string;
    district?: string;
    postTown?: string;
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
      reason: string;
    }>;
    vehiclePackages?: Array<{
      registration: string;
      make: string;
      model: string;
      dealershipName: string;
      monthlyPayment?: number;
    }>;
  }>;
  callScore: {
    currentScore: number;
    lastOutcome?: string;
    totalAttempts: number;
    lastCallAt?: Date;
  };
}

// Call outcome types
export interface CallOutcome {
  id: string;
  callSessionId: string;
  outcomeType: CallOutcomeType; // Updated to use unified type
  outcomeNotes?: string;
  nextCallDelayHours: number;
  scoreAdjustment: number;
  magicLinkSent: boolean;
  smsSent: boolean;
  documentsRequested?: string[]; // JSON array of requested document types
  recordedByAgentId: number;
  createdAt: Date;
}

// Call outcome options for disposition
export interface CallOutcomeOptions {
  outcomeType: CallOutcomeType; // Updated to use unified type
  outcomeNotes?: string;
  magicLinkSent?: boolean;
  smsSent?: boolean;
  callbackScheduled?: boolean;
  nextCallDelayHours?: number;
  documentsRequested?: string[];
  followUpRequired?: boolean;
  scoreAdjustment?: number;
  
  // Callback-specific fields
  callbackDateTime?: Date;
  callbackReason?: string;
}

export interface CallOutcomeWithDetails extends CallOutcome {
  callSession: {
    id: string;
    userId: number;
    startedAt: Date;
    durationSeconds?: number;
  };
  recordedByAgent: {
    firstName: string;
    lastName: string;
  };
}

// Callback types
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

export interface CreateCallbackRequest {
  userId: number;
  scheduledFor: Date;
  callbackReason?: string;
  preferredAgentId?: number;
  originalCallSessionId: string;
}

// Query and filter types
export interface GetCallHistoryOptions {
  page?: number;
  limit?: number;
  agentId?: number;
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  outcome?: string;
  status?: string;
}

export interface CallHistoryResult {
  calls: CallSessionWithContext[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Call history entry for display tables
export interface CallHistoryEntry {
  id: string;
  userId: number;
  userName?: string;
  userPhone?: string;
  agentId: number;
  agentName?: string;
  direction?: 'inbound' | 'outbound'; // Added direction field
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  talkTimeSeconds?: number;
  outcome: string;
  outcomeNotes?: string;
  magicLinkSent?: boolean;
  smsSent?: boolean;
  callbackScheduled?: boolean; // Added to match tRPC response
  followUpRequired?: boolean; // Added to match tRPC response
  nextCallDelay?: number | null | undefined; // Fixed: allow null and undefined values
  documentsRequested?: string[];
  twilioCallSid?: string;
  recordingUrl?: string;
  recordingStatus?: 'in-progress' | 'completed' | 'absent' | 'failed';
  recordingDurationSeconds?: number;
  status?: string;
}

export interface GetCallbacksOptions {
  page?: number;
  limit?: number;
  agentId?: number;
  createdByAgentId?: number;
  status?: 'pending' | 'completed' | 'cancelled';
  scheduledFrom?: Date;
  scheduledTo?: Date;
}

export interface CallbacksResult {
  callbacks: Array<Callback & {
    user: {
      firstName: string;
      lastName: string;
      phoneNumber: string;
    };
    preferredAgent?: {
      firstName: string;
      lastName: string;
    };
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Analytics and reporting types
export interface CallAnalytics {
  totalCalls: number;
  completedCalls: number;
  successfulContacts: number;
  noAnswers: number;
  callbacks: number;
  notInterested: number;
  avgDurationMinutes: number;
  avgTalkTimeMinutes: number;
  contactRate: number; // Percentage
}

export interface CallAnalyticsFilters {
  agentId?: number;
  startDate?: Date;
  endDate?: Date;
  outcomeType?: string;
}

export interface AgentCallStats {
  agentId: number;
  agentName: string;
  totalCalls: number;
  successfulContacts: number;
  avgTalkTimeMinutes: number;
  contactRate: number;
  topOutcomes: Array<{
    outcome: string;
    count: number;
  }>;
}

export interface DailyCallMetrics {
  date: string;
  totalCalls: number;
  completedCalls: number;
  avgDuration: number;
  contactRate: number;
  peakHour: number;
}

// Twilio integration types
export interface TwilioCallStatus {
  callSid: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  duration?: string;
  startTime?: string;
  endTime?: string;
  price?: string;
  from: string;
  to: string;
}

export interface TwilioWebhookData {
  CallSid: string;
  CallStatus: string;
  Direction: string;
  From: string;
  To: string;
  Duration?: string;
  CallDuration?: string;
  RecordingUrl?: string;
  Digits?: string;
}

export interface InitiateCallRequest {
  userId: number;
  queueId?: string;
  phoneNumber?: string;
  agentId?: number; // Optional for manual override
}

export interface InitiateCallResponse {
  callSession: CallSession;
  twilioCallSid?: string;
  userContext: UserCallContext;
}

// Real-time call status
export interface LiveCallStatus {
  sessionId: string;
  status: string;
  duration: number; // Seconds since call started
  talkTime: number; // Seconds since connected
  userInfo: {
    name: string;
    phoneNumber: string;
    claimType: string;
    pendingRequirements: number;
  };
}

// Error types
export interface CallError {
  code: 'USER_NOT_FOUND' | 'AGENT_UNAVAILABLE' | 'TWILIO_ERROR' | 'INVALID_PHONE' | 'CALL_LIMIT_EXCEEDED';
  message: string;
  details?: any;
} 