// Essential types moved from shared package to fix deployment
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    agent: {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      isActive: boolean;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export interface AgentProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isAiAgent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

export type CallOutcomeType = 
  | 'contacted'
  | 'not_interested' 
  | 'callback_requested'
  | 'no_answer'
  | 'wrong_number'
  | 'voicemail'
  | 'busy'
  | 'disconnected';

export type MagicLinkType = 
  | 'firstLogin'
  | 'claimPortal'
  | 'documentUpload'
  | 'claimCompletion'
  | 'verification'; 