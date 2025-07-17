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

import { Request } from 'express';

export interface JwtPayload {
  agentId: number;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  agent?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
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