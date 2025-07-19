// Calls Module Types
// Call sessions, outcomes, Twilio integration, and call analytics

// Call session types
export interface CallSession {
  id: string;
  userId: number;
  agentId: number;
  callQueueId: string;
  twilioCallSid?: string;
  status: 'initiated' | 'connecting' | 'ringing' | 'connected' | 'completed' | 'failed' | 'no_answer';
  direction: 'outbound' | 'inbound';
  startedAt: Date;
  connectedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  talkTimeSeconds?: number;
  userClaimsContext?: any; // JSON snapshot of user's claims at call time
  createdAt: Date;
}

export interface CallSessionOptions {
  userId: number;
  agentId: number;
  queueId?: string;
  direction?: 'outbound' | 'inbound';
  phoneNumber?: string;
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
  address?: {
    fullAddress: string;
    postCode: string;
    county: string;
  };
  claims: Array<{
    id: number;
    type: string;
    status: string;
    lender: string;
    value?: number;
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
  outcomeType: 'contacted' | 'no_answer' | 'busy' | 'wrong_number' | 'not_interested' | 'callback_requested' | 'left_voicemail' | 'failed';
  outcomeNotes?: string;
  nextCallDelayHours: number;
  scoreAdjustment: number;
  magicLinkSent: boolean;
  smsSent: boolean;
  documentsRequested?: string[]; // JSON array of requested document types
  recordedByAgentId: number;
  createdAt: Date;
}

export interface CallOutcomeOptions {
  outcomeType: 'contacted' | 'no_answer' | 'busy' | 'wrong_number' | 'not_interested' | 'callback_requested' | 'left_voicemail' | 'failed';
  outcomeNotes?: string;
  nextCallDelayHours?: number;
  magicLinkSent?: boolean;
  smsSent?: boolean;
  documentsRequested?: string[];
  callbackDateTime?: Date;
  callbackReason?: string;
  scoreAdjustment?: number;
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
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  talkTimeSeconds?: number;
  outcome: string;
  outcomeNotes?: string;
  magicLinkSent?: boolean;
  smsSent?: boolean;
  nextCallDelay?: number;
  documentsRequested?: string[];
  twilioCallSid?: string;
}

export interface GetCallbacksOptions {
  page?: number;
  limit?: number;
  agentId?: number;
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