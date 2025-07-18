// Auth Module - Authentication, Session Management & Agent Profiles
// This module handles authentication, authorization, session management, and agent analytics

// Services (main business logic)
export { AuthService } from './services/auth.service'

// Components (UI components)
export { LoginForm } from './components/LoginForm'
export { AuthProvider, useAuthContext } from './components/AuthProvider'

// Hooks (React hooks)
export { useAuth } from './hooks/useAuth'

// Utils (utility functions)
export { tokenUtils } from './utils/token.utils'

// Types (for other modules and tRPC)
export type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  JwtPayload,
  AgentProfile,
  CreateAgentRequest,
  AgentSession,
  AgentStatusUpdate,
  AgentSessionStats,
  AgentPerformanceMetrics,
  AgentDashboardStats,
  TeamStats,
  AgentPermissions,
  AuthContext,
  AuthError
} from './types/auth.types'
