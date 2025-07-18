// Auth Module Types
// Authentication, session management, and agent profile types

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    agent: AgentProfile;
    accessToken: string;
    refreshToken?: string;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Agent profile and account types
export interface AgentProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'agent' | 'supervisor' | 'admin';
  isActive: boolean;
  isAiAgent: boolean;
  twilioWorkerSid?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'agent' | 'supervisor' | 'admin';
  isAiAgent?: boolean;
}

// Session management types
export interface AgentSession {
  id: string;
  agentId: number;
  status: 'available' | 'on_call' | 'break' | 'offline';
  currentCallSessionId?: string;
  loginAt: Date;
  logoutAt?: Date;
  lastActivity: Date;
  callsCompletedToday: number;
  totalTalkTimeSeconds: number;
}

export interface AgentStatusUpdate {
  status: 'available' | 'on_call' | 'break' | 'offline';
  breakReason?: string;
}

export interface AgentSessionStats {
  agentId: number;
  loginTime: Date;
  totalCallsToday: number;
  totalTalkTimeSeconds: number;
  currentStatus: string;
  lastStatusChange: Date;
  agent?: {
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
}

// Performance analytics types
export interface AgentPerformanceMetrics {
  period: {
    startDate: Date;
    endDate: Date;
    totalDaysWorked: number;
  };
  callMetrics: {
    totalCalls: number;
    totalCallsFromSessions: number;
    successfulContacts: number;
    contactRate: number; // Percentage
    avgCallDurationMinutes: number;
    avgTalkTimeMinutes: number;
    totalTalkTimeHours: number;
  };
  outcomes: Record<string, number>; // outcome type -> count
  efficiency: {
    callsPerHour: number;
    talkTimeRatio: number; // Percentage of call time spent talking
  };
}

export interface AgentDashboardStats {
  todayStats: {
    callsCompleted: number;
    talkTimeMinutes: number;
    avgCallDuration: number;
    contactRate: number;
  };
  weekStats: {
    totalCalls: number;
    totalHours: number;
    bestDay: string;
    improvement: number; // Percentage change from previous week
  };
  currentSession: {
    loginTime: Date;
    status: string;
    timeOnline: number; // Minutes
    currentStreak: number; // Consecutive successful calls
  };
}

// Team/supervisor types
export interface TeamStats {
  totalAgents: number;
  agentsOnline: number;
  agentsOnCall: number;
  agentsOnBreak: number;
  totalCallsToday: number;
  avgContactRate: number;
  topPerformer: {
    agentId: number;
    name: string;
    callsCompleted: number;
  };
}

// Permission and role types
export interface AgentPermissions {
  canViewAllQueues: boolean;
  canAssignCalls: boolean;
  canViewReports: boolean;
  canManageAgents: boolean;
  canViewSupervisorDashboard: boolean;
  canModifyCallOutcomes: boolean;
}

export interface AuthContext {
  agent: AgentProfile;
  session: AgentSession;
  permissions: AgentPermissions;
}

// Error types
export interface AuthError {
  code: 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' | 'SESSION_EXPIRED' | 'INSUFFICIENT_PERMISSIONS';
  message: string;
  details?: any;
} 