# Dialler System - Detailed 4-Week Build Plan

## Pre-Development Setup (Day 0)

### Environment Setup
```bash
# Repository initialization
mkdir dialler-system && cd dialler-system
git init
npm init -y

# Monorepo setup with npm workspaces
npm install -D typescript @types/node turbo

# Create workspace structure
mkdir -p apps/api apps/web packages/shared
mkdir -p infrastructure/docker infrastructure/scripts
```

### Initial Configuration Files
```json
// package.json (root)
{
  "name": "dialler-system",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:integration": "turbo run test:integration",
    "test:e2e": "turbo run test:e2e"
  }
}
```

### Pre-Development Checklist
- [ ] Twilio account setup and phone number provisioning
- [ ] Database access credentials (replica + PostgreSQL)
- [ ] Redis instance provisioned
- [ ] Environment variables documented
- [ ] Development domains configured (localhost variants)

---

## Week 1: Foundation & Core Schema

### Day 1-2: Database Infrastructure

#### Morning Day 1: Database Setup
```sql
-- 1. Create Read Replica Connection Config
-- infrastructure/database/replica-config.sql
CREATE USER 'dialler_read'@'%' IDENTIFIED BY 'secure_password';
GRANT SELECT ON main_database.* TO 'dialler_read'@'%';

-- 2. Create Dialler Features Database (PostgreSQL)
CREATE DATABASE dialler_features;

-- 3. Create materialized views for read data
CREATE MATERIALIZED VIEW dialler_users AS
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.phone_number,
  u.created_at,
  ua.post_code,
  ua.county,
  ua.full_address
FROM users u
LEFT JOIN user_addresses ua ON u.current_user_address_id = ua.id
WHERE u.is_enabled = 1;

CREATE INDEX idx_dialler_users_phone ON dialler_users(phone_number);
CREATE INDEX idx_dialler_users_email ON dialler_users(email);
```

#### Afternoon Day 1: Core Tables Creation
```sql
-- apps/api/prisma/migrations/001_initial_schema.sql

-- Agents table
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'agent',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent sessions
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id INTEGER REFERENCES agents(id),
  status VARCHAR(20) DEFAULT 'offline',
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  logout_at TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User call scores
CREATE TABLE user_call_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  score INTEGER DEFAULT 0,
  last_call_at TIMESTAMP,
  total_attempts INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  next_call_after TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_scores_next_call ON user_call_scores(next_call_after, score);
```

#### Day 2: Queue and Call Tables + Integration Checkpoint
```sql
-- Call queue management
CREATE TABLE call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  claim_id BIGINT,
  priority_score INTEGER DEFAULT 0,
  queue_position INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  queue_reason VARCHAR(255),
  assigned_to_agent_id INTEGER REFERENCES agents(id),
  assigned_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call sessions
CREATE TABLE call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  agent_id INTEGER REFERENCES agents(id),
  queue_id UUID REFERENCES call_queue(id),
  twilio_call_sid VARCHAR(255),
  status VARCHAR(20) DEFAULT 'initiated',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  connected_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call outcomes
CREATE TABLE call_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID REFERENCES call_sessions(id),
  outcome_type VARCHAR(50) NOT NULL,
  notes TEXT,
  callback_scheduled BOOLEAN DEFAULT false,
  callback_date TIMESTAMP,
  magic_link_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Day 2 Afternoon: Integration Checkpoint
**Critical Validation Tasks:**
```typescript
// Test replica connection and data sync
const testReplicaConnection = async () => {
  // Verify we can read user data from replica
  const users = await replicaDb.query('SELECT COUNT(*) FROM users');
  console.log('Replica connection OK:', users);
  
  // Test phone number format validation
  const phoneRegex = /^\+44[0-9]{10}$/;
  // Validate sample phone numbers match expected format
};

// Test PostgreSQL connection
const testPostgresConnection = async () => {
  await prisma.agent.findMany({ take: 1 });
  console.log('PostgreSQL connection OK');
};
```

### Day 3-4: Node.js API Foundation + Enhanced Error Handling

#### Day 3 Morning: Express Setup with Production Patterns
```typescript
// apps/api/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import winston from 'winston';
import { errorHandler, AppError } from './middleware/error.middleware';
import rateLimit from 'express-rate-limit';

// Initialize services with error handling
export const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
  errorFormat: 'pretty'
});

export const redis = createClient({ 
  url: process.env.REDIS_URL,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis server refused connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Express app with enhanced security
const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "*.twilio.com"],
      connectSrc: ["'self'", "*.twilio.com", "wss://eventgw.twilio.com"]
    }
  }
}));

app.use(cors({ 
  origin: process.env.FRONTEND_URL,
  credentials: true 
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

app.use(express.json());

// Health check with detailed status
app.get('/health', async (req, res) => {
  const checks = {
    api: 'ok',
    database: 'checking',
    redis: 'checking',
    timestamp: new Date().toISOString()
  };
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (error) {
    checks.database = 'error';
    logger.error('Database health check failed:', error);
  }
  
  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch (error) {
    checks.redis = 'error';
    logger.error('Redis health check failed:', error);
  }
  
  const allOk = Object.values(checks).every(status => status === 'ok' || status === 'checking');
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'healthy' : 'degraded', checks });
});

// Error handling middleware
app.use(errorHandler);

export default app;
```

#### Day 3 Afternoon: Enhanced Database Services with Circuit Breaker
```typescript
// apps/api/src/services/database.service.ts
import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';
import CircuitBreaker from 'opossum';

class DatabaseService {
  private prisma: PrismaClient;
  private replicaPool: mysql.Pool;
  private replicaCircuitBreaker: CircuitBreaker;

  constructor() {
    this.prisma = new PrismaClient();
    this.replicaPool = mysql.createPool({
      uri: process.env.REPLICA_DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      acquireTimeout: 60000,
      timeout: 60000
    });
    
    // Circuit breaker for replica queries
    this.replicaCircuitBreaker = new CircuitBreaker(this.executeReplicaQuery.bind(this), {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });
    
    this.replicaCircuitBreaker.on('open', () => {
      logger.warn('Replica circuit breaker opened - falling back to cached data');
    });
  }

  private async executeReplicaQuery(query: string, params: any[] = []) {
    const [rows] = await this.replicaPool.execute(query, params);
    return rows;
  }

  // Read from replica with fallback
  async getUserData(userId: number) {
    try {
      const rows = await this.replicaCircuitBreaker.fire(
        `SELECT u.*, 
                c.id as claim_id, c.status as claim_status, c.lender,
                cr.type as requirement_type, cr.status as requirement_status
         FROM users u
         LEFT JOIN claims c ON u.id = c.user_id
         LEFT JOIN claim_requirements cr ON c.id = cr.claim_id
         WHERE u.id = ? AND cr.status = 'PENDING'`,
        [userId]
      );
      return rows;
    } catch (error) {
      logger.error('Replica query failed, checking cache:', error);
      // Fallback to cached data
      const cached = await redis.get(`user:${userId}`);
      if (cached) return JSON.parse(cached);
      throw new AppError(503, 'DATA_UNAVAILABLE', 'User data temporarily unavailable');
    }
  }

  // Write to dialler database with retry logic
  async createCallSession(data: any) {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        return await this.prisma.callSession.create({ data });
      } catch (error) {
        attempt++;
        if (attempt === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}
```

#### Day 4: Authentication & Enhanced CRUD with Validation
```typescript
// apps/api/src/middleware/auth.middleware.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export interface AuthRequest extends Request {
  agent?: {
    id: number;
    email: string;
    role: string;
  };
}

const TokenSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: z.enum(['agent', 'supervisor', 'admin']),
  iat: z.number(),
  exp: z.number()
});

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'MISSING_TOKEN', 'Authorization header required');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Validate token structure
    const validatedToken = TokenSchema.parse(decoded);
    
    // Check if agent is still active
    const agent = await prisma.agent.findFirst({
      where: { id: validatedToken.id, isActive: true }
    });
    
    if (!agent) {
      throw new AppError(401, 'AGENT_INACTIVE', 'Agent account is inactive');
    }
    
    req.agent = validatedToken;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        success: false, 
        error: { code: 'INVALID_TOKEN', message: 'Invalid token' } 
      });
    }
    next(error);
  }
};

// Enhanced login controller with rate limiting per user
// apps/api/src/controllers/auth.controller.ts
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    
    // Check rate limiting
    const attemptKey = `login_attempts:${email}`;
    const attempts = await redis.get(attemptKey);
    if (attempts && parseInt(attempts) >= 5) {
      throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many login attempts. Try again later.');
    }
    
    // Validate credentials
    const agent = await prisma.agent.findUnique({ 
      where: { email, isActive: true } 
    });
    
    if (!agent || !bcrypt.compareSync(password, agent.passwordHash)) {
      // Increment failed attempts
      await redis.incr(attemptKey);
      await redis.expire(attemptKey, 900); // 15 minutes
      
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    
    // Clear failed attempts on success
    await redis.del(attemptKey);
    
    // Create/update session
    const session = await prisma.agentSession.upsert({
      where: { agentId: agent.id },
      update: { 
        status: 'available', 
        loginAt: new Date(),
        lastActivity: new Date()
      },
      create: { 
        agentId: agent.id, 
        status: 'available',
        loginAt: new Date()
      }
    });
    
    // Generate token
    const token = jwt.sign(
      { id: agent.id, email: agent.email, role: agent.role },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    );
    
    logger.info('Agent login successful', { agentId: agent.id, email: agent.email });
    
    res.json({ 
      success: true, 
      data: { 
        token, 
        agent: {
          id: agent.id,
          email: agent.email,
          firstName: agent.firstName,
          lastName: agent.lastName,
          role: agent.role
        },
        session: session.id
      } 
    });
  } catch (error) {
    next(error);
  }
};
```

### Day 5: React Foundation + Enhanced Testing Setup

#### React App Setup with Testing Infrastructure
```bash
# Create Vite React app
cd apps/web
npm create vite@latest . -- --template react-ts
npm install

# Add testing dependencies
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D vitest jsdom @vitejs/plugin-react
npm install -D playwright @playwright/test

# Add additional dependencies
npm install @tanstack/react-query @tanstack/react-table
npm install zustand react-hook-form @hookform/resolvers
npm install zod tailwindcss @radix-ui/react-dialog @radix-ui/react-select
npm install socket.io-client @twilio/voice-sdk
```

#### Enhanced API Client with Error Handling
```typescript
// apps/web/src/lib/api.ts
import { z } from 'zod';

const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  meta: z.object({
    page: z.number().optional(),
    limit: z.number().optional(),
    total: z.number().optional(),
    totalPages: z.number().optional()
  }).optional()
});

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private token: string | null = null;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    this.token = localStorage.getItem('token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token && { Authorization: `Bearer ${this.token}` }),
          ...options?.headers
        }
      });

      const rawData = await response.json();
      const data = ApiResponseSchema.parse(rawData);
      
      if (!data.success) {
        throw new ApiError(
          data.error?.code || 'UNKNOWN_ERROR',
          data.error?.message || 'Request failed',
          data.error?.details
        );
      }
      
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof SyntaxError) {
        throw new ApiError('PARSE_ERROR', 'Invalid response format');
      }
      throw new ApiError('NETWORK_ERROR', 'Network request failed');
    }
  }

  // Convenience methods
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
```

#### Testing Setup
```typescript
// apps/web/src/test/setup.ts
import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// Mock API responses
beforeEach(() => {
  vi.clearAllMocks();
});

// Mock Twilio Device
vi.mock('@twilio/voice-sdk', () => ({
  Device: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    register: vi.fn(),
    on: vi.fn()
  }))
}));

// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts']
  }
});
```

---

## Week 2: Core Dialler Features + Enhanced SMS

### Day 6-7: Queue Management System

#### Queue Service Implementation
```typescript
// apps/api/src/services/queue.service.ts
export class QueueService {
  async refreshQueue() {
    // Get users eligible for calling
    const eligibleUsers = await this.getEligibleUsers();
    
    // Calculate priority scores
    const scoredUsers = await Promise.all(
      eligibleUsers.map(user => this.calculatePriority(user))
    );
    
    // Add to queue
    const queueEntries = scoredUsers.map((user, index) => ({
      userId: user.id,
      claimId: user.claimId,
      priorityScore: user.score,
      queuePosition: index + 1,
      queueReason: user.reason,
      status: 'pending'
    }));
    
    await prisma.callQueue.createMany({ data: queueEntries });
  }
  
  private async calculatePriority(user: any) {
    let score = 0;
    const reasons = [];
    
    // Base score from user_call_scores
    const callScore = await prisma.userCallScore.findUnique({
      where: { userId: user.id }
    });
    score += callScore?.score || 0;
    
    // Boost for pending requirements
    if (user.pendingRequirements > 0) {
      score -= 10 * user.pendingRequirements;
      reasons.push('pending_requirements');
    }
    
    // Time-based decay
    const daysSinceLastCall = callScore?.lastCallAt 
      ? Math.floor((Date.now() - callScore.lastCallAt.getTime()) / 86400000)
      : 30;
    score -= Math.min(daysSinceLastCall, 30);
    
    return { ...user, score, reason: reasons.join(',') };
  }
}
```

#### Queue API Endpoints
```typescript
// apps/api/src/controllers/queue.controller.ts
export const getQueue = async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, status = 'pending' } = req.query;
  
  const queue = await prisma.callQueue.findMany({
    where: { status: status as string },
    include: {
      user: true,
      assignedAgent: true
    },
    orderBy: [
      { priorityScore: 'asc' },
      { createdAt: 'asc' }
    ],
    skip: (Number(page) - 1) * Number(limit),
    take: Number(limit)
  });
  
  const total = await prisma.callQueue.count({ where: { status: status as string } });
  
  res.json({
    success: true,
    data: queue,
    meta: { page: Number(page), limit: Number(limit), total }
  });
};

export const assignCall = async (req: AuthRequest, res: Response) => {
  const { queueId } = req.params;
  
  // Check if agent is available
  const agentSession = await prisma.agentSession.findFirst({
    where: { agentId: req.agent!.id, status: 'available' }
  });
  
  if (!agentSession) {
    return res.status(400).json({
      success: false,
      error: { code: 'AGENT_NOT_AVAILABLE' }
    });
  }
  
  // Assign the call
  const queueEntry = await prisma.callQueue.update({
    where: { id: queueId },
    data: {
      status: 'assigned',
      assignedToAgentId: req.agent!.id,
      assignedAt: new Date()
    }
  });
  
  res.json({ success: true, data: queueEntry });
};
```

### Day 8-9: Call Session Management

#### Call Service with State Management
```typescript
// apps/api/src/services/call.service.ts
export class CallService {
  private activeCalls = new Map<string, any>();
  
  async initiateCall(queueId: string, agentId: number) {
    // Get queue entry with user data
    const queueEntry = await prisma.callQueue.findUnique({
      where: { id: queueId },
      include: { user: true }
    });
    
    if (!queueEntry) throw new Error('Queue entry not found');
    
    // Create call session
    const session = await prisma.callSession.create({
      data: {
        userId: queueEntry.userId,
        agentId,
        queueId,
        status: 'initiated'
      }
    });
    
    // Update agent status
    await prisma.agentSession.update({
      where: { agentId },
      data: { status: 'on_call' }
    });
    
    // Store in active calls
    this.activeCalls.set(session.id, {
      session,
      queueEntry,
      startTime: Date.now()
    });
    
    return session;
  }
  
  async updateCallStatus(sessionId: string, status: string, twilioSid?: string) {
    const session = await prisma.callSession.update({
      where: { id: sessionId },
      data: {
        status,
        ...(twilioSid && { twilioCallSid: twilioSid }),
        ...(status === 'connected' && { connectedAt: new Date() }),
        ...(status === 'completed' && { endedAt: new Date() })
      }
    });
    
    // Calculate duration if completed
    if (status === 'completed' && session.connectedAt) {
      const duration = Math.floor(
        (session.endedAt!.getTime() - session.connectedAt.getTime()) / 1000
      );
      await prisma.callSession.update({
        where: { id: sessionId },
        data: { durationSeconds: duration }
      });
    }
    
    return session;
  }
}
```

### Day 10: Enhanced SMS Integration + Two-Way Messaging

#### Comprehensive SMS Service
```typescript
// apps/api/src/services/sms.service.ts
import { TwilioService } from './twilio.service';

export class SMSService extends TwilioService {
  async sendMagicLink(
    userId: number, 
    phoneNumber: string, 
    linkType: string,
    agentId: number,
    sessionId?: string
  ) {
    // Generate magic link
    const mlid = Buffer.from(userId.toString()).toString('base64');
    const baseUrl = process.env.MAIN_APP_URL;
    
    const routes: Record<string, string> = {
      firstLogin: `/first-login?base64_user_id=${mlid}`,
      claimPortal: `/claims?mlid=${mlid}`,
      documentUpload: `/claim/requirements?mlid=${mlid}`,
      claimCompletion: `/claim/incomplete-redirect?mlid=${mlid}`
    };
    
    const link = `${baseUrl}${routes[linkType]}`;
    
    // Get user name for personalization
    const user = await this.getUserData(userId);
    const firstName = user?.first_name || 'there';
    
    const message = this.generateSMSMessage(linkType, firstName, link);
    
    // Send SMS
    const twilioResponse = await this.sendSMS(phoneNumber, message);
    
    // Track activity
    await prisma.magicLinkActivity.create({
      data: {
        userId,
        linkType,
        linkToken: mlid,
        sentVia: 'sms',
        sentByAgentId: agentId,
        callSessionId: sessionId,
        sentAt: new Date(),
        twilioMessageSid: twilioResponse.sid
      }
    });
    
    return { success: true, messageSid: twilioResponse.sid, link };
  }
  
  async handleIncomingMessage(from: string, body: string, messageSid: string) {
    // Normalize phone number
    const normalizedPhone = this.normalizePhoneNumber(from);
    
    // Find or create SMS conversation
    let conversation = await prisma.smsConversation.findFirst({
      where: { phoneNumber: normalizedPhone, status: 'active' }
    });
    
    if (!conversation) {
      // Try to find user by phone number
      const user = await this.findUserByPhone(normalizedPhone);
      
      conversation = await prisma.smsConversation.create({
        data: {
          userId: user?.id,
          phoneNumber: normalizedPhone,
          status: 'active',
          lastMessageAt: new Date()
        }
      });
    }
    
    // Store incoming message
    await prisma.smsMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        body,
        twilioMessageSid: messageSid,
        receivedAt: new Date()
      }
    });
    
    // Process message for intent
    const intent = this.parseMessageIntent(body);
    
    // Auto-respond or route to agent
    if (intent.autoRespond) {
      await this.sendAutoResponse(conversation.id, intent.responseType);
    } else {
      await this.routeToAgent(conversation.id, intent);
    }
    
    return { conversationId: conversation.id, intent };
  }
  
  private parseMessageIntent(body: string) {
    const lowerBody = body.toLowerCase().trim();
    
    // Auto-respond patterns
    if (['stop', 'unsubscribe', 'opt out'].some(word => lowerBody.includes(word))) {
      return { autoRespond: true, responseType: 'opt_out' };
    }
    
    if (['yes', 'y', 'ok', 'okay', 'sure'].includes(lowerBody)) {
      return { autoRespond: true, responseType: 'confirmation' };
    }
    
    if (['help', '?', 'info', 'information'].some(word => lowerBody.includes(word))) {
      return { autoRespond: true, responseType: 'help' };
    }
    
    // Route to agent patterns
    if (lowerBody.length > 50 || lowerBody.includes('callback') || lowerBody.includes('call me')) {
      return { autoRespond: false, priority: 'high', reason: 'callback_request' };
    }
    
    return { autoRespond: false, priority: 'normal', reason: 'general_inquiry' };
  }
  
  private async sendAutoResponse(conversationId: string, responseType: string) {
    const responses = {
      opt_out: "You've been removed from our SMS list. If you need assistance, please call us at [PHONE].",
      confirmation: "Thank you for confirming! We'll be in touch soon.",
      help: "For immediate assistance, call [PHONE] or reply with your question and we'll get back to you."
    };
    
    const conversation = await prisma.smsConversation.findUnique({
      where: { id: conversationId }
    });
    
    if (!conversation) return;
    
    const message = responses[responseType]?.replace('[PHONE]', process.env.COMPANY_PHONE || '');
    
    if (message) {
      const twilioResponse = await this.sendSMS(conversation.phoneNumber, message);
      
      await prisma.smsMessage.create({
        data: {
          conversationId,
          direction: 'outbound',
          body: message,
          twilioMessageSid: twilioResponse.sid,
          sentAt: new Date(),
          isAutoResponse: true
        }
      });
      
      // Handle opt-out
      if (responseType === 'opt_out') {
        await prisma.smsConversation.update({
          where: { id: conversationId },
          data: { status: 'opted_out' }
        });
      }
    }
  }
  
  private generateSMSMessage(linkType: string, firstName: string, link: string): string {
    const messages = {
      firstLogin: `Hi ${firstName}! Welcome to Resolve My Claim. Access your account here: ${link}`,
      claimPortal: `Hi ${firstName}, you can view your claim status here: ${link}`,
      documentUpload: `Hi ${firstName}, please upload your required documents here: ${link}`,
      claimCompletion: `Hi ${firstName}, complete your claim application here: ${link}`
    };
    
    return messages[linkType] || `Hi ${firstName}, here's your secure link: ${link}`;
  }
  
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Handle UK numbers
    if (digits.startsWith('44')) {
      return `+${digits}`;
    }
    if (digits.startsWith('0')) {
      return `+44${digits.slice(1)}`;
    }
    if (digits.length === 10) {
      return `+44${digits}`;
    }
    
    return `+${digits}`;
  }
}

// SMS Schema additions
// apps/api/prisma/migrations/002_sms_tables.sql
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES sms_conversations(id),
  direction VARCHAR(10) NOT NULL, -- 'inbound' | 'outbound'
  body TEXT NOT NULL,
  twilio_message_sid VARCHAR(255),
  is_auto_response BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  received_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced SMS conversations
ALTER TABLE sms_conversations ADD COLUMN user_id BIGINT;
ALTER TABLE sms_conversations ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';
ALTER TABLE sms_conversations ADD COLUMN last_agent_response TIMESTAMP;
ALTER TABLE sms_conversations ADD COLUMN unread_count INTEGER DEFAULT 0;

CREATE INDEX idx_sms_messages_conversation ON sms_messages(conversation_id, created_at);
CREATE INDEX idx_sms_conversations_status ON sms_conversations(status, last_message_at);
```

#### SMS Management UI Components
```tsx
// apps/web/src/features/sms/components/SMSConversations.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';

interface SMSConversation {
  id: string;
  phoneNumber: string;
  user?: {
    firstName: string;
    lastName: string;
  };
  status: 'active' | 'closed' | 'opted_out';
  unreadCount: number;
  lastMessageAt: string;
  lastMessage: {
    body: string;
    direction: 'inbound' | 'outbound';
  };
}

export function SMSConversations() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['sms-conversations'],
    queryFn: () => api.get<SMSConversation[]>('/sms/conversations'),
    refetchInterval: 5000 // Real-time updates
  });
  
  const { data: messages } = useQuery({
    queryKey: ['sms-messages', selectedConversation],
    queryFn: () => selectedConversation 
      ? api.get(`/sms/conversations/${selectedConversation}/messages`)
      : null,
    enabled: !!selectedConversation
  });
  
  const sendMessageMutation = useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      api.post(`/sms/conversations/${conversationId}/messages`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries(['sms-messages', selectedConversation]);
      queryClient.invalidateQueries(['sms-conversations']);
    }
  });
  
  return (
    <div className="flex h-full">
      {/* Conversations List */}
      <div className="w-1/3 border-r bg-gray-50">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">SMS Conversations</h2>
        </div>
        <div className="overflow-y-auto">
          {conversations?.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation.id)}
              className={`p-4 border-b cursor-pointer hover:bg-gray-100 ${
                selectedConversation === conversation.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">
                    {conversation.user 
                      ? `${conversation.user.firstName} ${conversation.user.lastName}`
                      : conversation.phoneNumber
                    }
                  </div>
                  <div className="text-sm text-gray-500">
                    {conversation.phoneNumber}
                  </div>
                  <div className="text-sm text-gray-600 mt-1 truncate">
                    {conversation.lastMessage.body}
                  </div>
                </div>
                <div className="text-right">
                  {conversation.unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      {conversation.unreadCount}
                    </span>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(conversation.lastMessageAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Messages */}
      {selectedConversation && (
        <SMSConversationView 
          conversationId={selectedConversation}
          messages={messages}
          onSendMessage={(body) => sendMessageMutation.mutate({ conversationId: selectedConversation, body })}
        />
      )}
    </div>
  );
}
```

### Day 11: Magic Link Deep Dive + Analytics

#### Enhanced Magic Link System
```typescript
// apps/api/src/services/magic-link.service.ts
export class MagicLinkService {
  private readonly baseUrl: string;
  private readonly linkExpiry = 24 * 60 * 60 * 1000; // 24 hours
  
  constructor() {
    this.baseUrl = process.env.MAIN_APP_URL!;
  }
  
  async generateMagicLink(
    userId: number, 
    linkType: MagicLinkType,
    agentId: number,
    sessionId?: string,
    customExpiry?: number
  ): Promise<MagicLinkResult> {
    // Create token with additional security
    const tokenData = {
      userId,
      linkType,
      agentId,
      sessionId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    };
    
    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64url');
    
    // Store in database for tracking and validation
    const linkRecord = await prisma.magicLinkActivity.create({
      data: {
        userId,
        linkType,
        linkToken: token,
        sentByAgentId: agentId,
        callSessionId: sessionId,
        expiresAt: new Date(Date.now() + (customExpiry || this.linkExpiry)),
        sentAt: new Date(),
        isActive: true
      }
    });
    
    const routes: Record<MagicLinkType, string> = {
      firstLogin: `/first-login?token=${token}`,
      claimPortal: `/claims?token=${token}`,
      documentUpload: `/claim/requirements?token=${token}`,
      claimCompletion: `/claim/incomplete-redirect?token=${token}`,
      verification: `/verify?token=${token}`
    };
    
    const fullUrl = `${this.baseUrl}${routes[linkType]}`;
    
    return {
      id: linkRecord.id,
      url: fullUrl,
      token,
      expiresAt: linkRecord.expiresAt,
      linkType
    };
  }
  
  async validateMagicLink(token: string): Promise<MagicLinkValidation> {
    try {
      // Decode token
      const tokenData = JSON.parse(Buffer.from(token, 'base64url').toString());
      
      // Find link record
      const linkRecord = await prisma.magicLinkActivity.findFirst({
        where: {
          linkToken: token,
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      });
      
      if (!linkRecord) {
        return { isValid: false, error: 'LINK_EXPIRED_OR_INVALID' };
      }
      
      // Update access tracking
      await prisma.magicLinkActivity.update({
        where: { id: linkRecord.id },
        data: {
          accessedAt: new Date(),
          accessCount: { increment: 1 }
        }
      });
      
      return {
        isValid: true,
        userId: linkRecord.userId,
        linkType: linkRecord.linkType,
        agentId: linkRecord.sentByAgentId,
        sessionId: linkRecord.callSessionId
      };
    } catch (error) {
      return { isValid: false, error: 'INVALID_TOKEN_FORMAT' };
    }
  }
  
  async getMagicLinkAnalytics(agentId?: number, dateRange?: { start: Date; end: Date }) {
    const where: any = {};
    
    if (agentId) where.sentByAgentId = agentId;
    if (dateRange) {
      where.sentAt = {
        gte: dateRange.start,
        lte: dateRange.end
      };
    }
    
    const [totalSent, accessed, byType, byAgent] = await Promise.all([
      // Total links sent
      prisma.magicLinkActivity.count({ where }),
      
      // Links accessed
      prisma.magicLinkActivity.count({
        where: { ...where, accessedAt: { not: null } }
      }),
      
      // By link type
      prisma.magicLinkActivity.groupBy({
        by: ['linkType'],
        where,
        _count: { id: true },
        _sum: { accessCount: true }
      }),
      
      // By agent
      prisma.magicLinkActivity.groupBy({
        by: ['sentByAgentId'],
        where,
        _count: { id: true },
        _sum: { accessCount: true },
        orderBy: { _count: { id: 'desc' } }
      })
    ]);
    
    return {
      summary: {
        totalSent,
        totalAccessed: accessed,
        accessRate: totalSent > 0 ? (accessed / totalSent * 100).toFixed(1) : '0.0'
      },
      byType: byType.map(item => ({
        linkType: item.linkType,
        sent: item._count.id,
        totalAccesses: item._sum.accessCount || 0
      })),
      byAgent: byAgent.map(item => ({
        agentId: item.sentByAgentId,
        sent: item._count.id,
        totalAccesses: item._sum.accessCount || 0
      }))
    };
  }
  
  async expireMagicLink(linkId: string, reason?: string) {
    await prisma.magicLinkActivity.update({
      where: { id: linkId },
      data: {
        isActive: false,
        expiredAt: new Date(),
        expiredReason: reason
      }
    });
  }
}

// Enhanced magic link schema
// apps/api/prisma/migrations/003_enhanced_magic_links.sql
ALTER TABLE magic_link_activities ADD COLUMN expires_at TIMESTAMP;
ALTER TABLE magic_link_activities ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE magic_link_activities ADD COLUMN access_count INTEGER DEFAULT 0;
ALTER TABLE magic_link_activities ADD COLUMN expired_at TIMESTAMP;
ALTER TABLE magic_link_activities ADD COLUMN expired_reason VARCHAR(255);
ALTER TABLE magic_link_activities ADD COLUMN user_agent TEXT;
ALTER TABLE magic_link_activities ADD COLUMN ip_address INET;

CREATE INDEX idx_magic_links_token ON magic_link_activities(link_token);
CREATE INDEX idx_magic_links_active ON magic_link_activities(is_active, expires_at);
```

---

## Week 3: Advanced Features + Supervisor Dashboard

### Day 12-13: Twilio SDK Integration

#### Twilio Service Setup
```typescript
// apps/api/src/services/twilio.service.ts
import twilio from 'twilio';
import { Device } from '@twilio/voice-sdk';

export class TwilioService {
  private client: twilio.Twilio;
  private twimlApp: string;
  
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.twimlApp = process.env.TWILIO_TWIML_APP_SID!;
  }
  
  // Generate capability token for browser
  async generateToken(agentId: number) {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;
    
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      { identity: `agent_${agentId}` }
    );
    
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: this.twimlApp,
      incomingAllow: true
    });
    
    token.addGrant(voiceGrant);
    return token.toJwt();
  }
  
  // TwiML endpoint for outgoing calls
  async handleOutgoingCall(to: string, callbackUrl: string) {
    const response = new twilio.twiml.VoiceResponse();
    
    const dial = response.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER,
      record: 'record-from-answer',
      recordingStatusCallback: `${callbackUrl}/recording-complete`
    });
    
    dial.number(to);
    
    return response.toString();
  }
  
  // Send SMS with magic link
  async sendSMS(to: string, message: string) {
    return this.client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    });
  }
}

// apps/api/src/controllers/twilio.controller.ts
export const getTwilioToken = async (req: AuthRequest, res: Response) => {
  const token = await twilioService.generateToken(req.agent!.id);
  res.json({ success: true, data: { token } });
};

export const handleTwiML = async (req: Request, res: Response) => {
  const { To, CallbackUrl } = req.body;
  const twiml = await twilioService.handleOutgoingCall(To, CallbackUrl);
  res.type('text/xml').send(twiml);
};

export const handleCallStatus = async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  
  // Update call session
  await callService.updateCallStatus(CallSid, CallStatus, {
    duration: parseInt(CallDuration)
  });
  
  res.status(200).send('OK');
};
```

#### Frontend Twilio Integration
```typescript
// apps/web/src/hooks/useTwilio.ts
import { useEffect, useState } from 'react';
import { Device } from '@twilio/voice-sdk';
import { api } from '@/lib/api';

export function useTwilio() {
  const [device, setDevice] = useState<Device | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeCall, setActiveCall] = useState<any>(null);
  
  useEffect(() => {
    initializeDevice();
  }, []);
  
  const initializeDevice = async () => {
    try {
      // Get token from API
      const { token } = await api.request<{ token: string }>('/twilio/token');
      
      // Create device
      const newDevice = new Device(token, {
        codecPreferences: ['opus', 'pcmu'],
        fakeLocalDTMF: true,
        enableRingingState: true
      });
      
      // Set up event handlers
      newDevice.on('ready', () => {
        console.log('Twilio Device ready');
        setIsReady(true);
      });
      
      newDevice.on('error', (error) => {
        console.error('Twilio Device error:', error);
      });
      
      newDevice.on('incoming', (call) => {
        console.log('Incoming call', call);
        call.accept();
        setActiveCall(call);
      });
      
      await newDevice.register();
      setDevice(newDevice);
    } catch (error) {
      console.error('Failed to initialize Twilio:', error);
    }
  };
  
  const makeCall = async (to: string, sessionId: string) => {
    if (!device || !isReady) {
      throw new Error('Device not ready');
    }
    
    const call = await device.connect({
      params: {
        To: to,
        SessionId: sessionId
      }
    });
    
    setActiveCall(call);
    return call;
  };
  
  const endCall = () => {
    if (activeCall) {
      activeCall.disconnect();
      setActiveCall(null);
    }
  };
  
  return {
    isReady,
    activeCall,
    makeCall,
    endCall
  };
}
```

### Day 14: Supervisor Dashboard + Analytics

#### Supervisor Dashboard Backend
```typescript
// apps/api/src/services/analytics.service.ts
export class AnalyticsService {
  async getDashboardMetrics(dateRange: { start: Date; end: Date }, agentId?: number) {
    const where: any = {
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    };
    
    if (agentId) where.agentId = agentId;
    
    const [
      totalCalls,
      completedCalls,
      totalTalkTime,
      outcomeBreakdown,
      hourlyDistribution,
      agentPerformance
    ] = await Promise.all([
      // Total calls initiated
      prisma.callSession.count({ where }),
      
      // Completed calls
      prisma.callSession.count({
        where: { ...where, status: 'completed' }
      }),
      
      // Total talk time
      prisma.callSession.aggregate({
        where: { ...where, status: 'completed' },
        _sum: { durationSeconds: true }
      }),
      
      // Outcome breakdown
      prisma.callOutcome.groupBy({
        by: ['outcomeType'],
        where: {
          callSession: { ...where }
        },
        _count: { id: true }
      }),
      
      // Hourly call distribution
      prisma.$queryRaw`
        SELECT 
          EXTRACT(hour FROM created_at) as hour,
          COUNT(*) as call_count,
          AVG(duration_seconds) as avg_duration
        FROM call_sessions 
        WHERE created_at >= ${dateRange.start} 
          AND created_at <= ${dateRange.end}
          AND status = 'completed'
        GROUP BY EXTRACT(hour FROM created_at)
        ORDER BY hour
      `,
      
      // Agent performance
      !agentId ? prisma.callSession.groupBy({
        by: ['agentId'],
        where,
        _count: { id: true },
        _avg: { durationSeconds: true }
      }) : null
    ]);
    
    return {
      summary: {
        totalCalls,
        completedCalls,
        completionRate: totalCalls > 0 ? (completedCalls / totalCalls * 100).toFixed(1) : '0',
        totalTalkTime: totalTalkTime._sum.durationSeconds || 0,
        avgCallDuration: totalCalls > 0 
          ? Math.round((totalTalkTime._sum.durationSeconds || 0) / totalCalls) 
          : 0
      },
      outcomes: outcomeBreakdown.map(item => ({
        outcome: item.outcomeType,
        count: item._count.id
      })),
      hourlyDistribution,
      agentPerformance: agentPerformance?.map(item => ({
        agentId: item.agentId,
        callCount: item._count.id,
        avgDuration: Math.round(item._avg.durationSeconds || 0)
      })) || []
    };
  }
  
  async getQueueMetrics() {
    const [currentQueue, avgWaitTime, assignmentRate] = await Promise.all([
      // Current queue status
      prisma.callQueue.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      
      // Average wait time for assigned calls today
      prisma.$queryRaw`
        SELECT AVG(
          EXTRACT(EPOCH FROM (assigned_at - created_at))
        ) as avg_wait_seconds
        FROM call_queue 
        WHERE assigned_at IS NOT NULL 
          AND created_at >= CURRENT_DATE
      `,
      
      // Assignment rate over last hour
      prisma.$queryRaw`
        SELECT 
          COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned,
          COUNT(*) as total
        FROM call_queue 
        WHERE created_at >= NOW() - INTERVAL '1 hour'
      `
    ]);
    
    return {
      currentQueue: currentQueue.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      avgWaitTime: avgWaitTime[0]?.avg_wait_seconds || 0,
      assignmentRate: assignmentRate[0]?.total > 0 
        ? (assignmentRate[0].assigned / assignmentRate[0].total * 100).toFixed(1)
        : '0'
    };
  }
  
  async getAgentStatus() {
    return prisma.agentSession.findMany({
      where: {
        status: { not: 'offline' }
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { lastActivity: 'desc' }
    });
  }
}

// apps/api/src/controllers/analytics.controller.ts
export const getDashboard = async (req: AuthRequest, res: Response) => {
  const { startDate, endDate, agentId } = req.query;
  
  const dateRange = {
    start: startDate ? new Date(startDate as string) : new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: endDate ? new Date(endDate as string) : new Date()
  };
  
  const [metrics, queueMetrics, agentStatus] = await Promise.all([
    analyticsService.getDashboardMetrics(dateRange, agentId ? Number(agentId) : undefined),
    analyticsService.getQueueMetrics(),
    analyticsService.getAgentStatus()
  ]);
  
  res.json({
    success: true,
    data: {
      metrics,
      queue: queueMetrics,
      agents: agentStatus
    }
  });
};
```

#### Supervisor Dashboard UI
```tsx
// apps/web/src/features/supervisor/components/SupervisorDashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { MetricsCard } from './MetricsCard';
import { CallOutcomeChart } from './CallOutcomeChart';
import { AgentStatusList } from './AgentStatusList';
import { QueueMetrics } from './QueueMetrics';

export function SupervisorDashboard() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', dateRange],
    queryFn: () => api.get(`/analytics/dashboard?startDate=${dateRange.start}&endDate=${dateRange.end}`),
    refetchInterval: 30000 // Refresh every 30 seconds
  });
  
  if (isLoading) {
    return <div className="p-6">Loading dashboard...</div>;
  }
  
  const { metrics, queue, agents } = dashboardData;
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Supervisor Dashboard</h1>
        <div className="flex gap-4">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-3 py-2 border rounded"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-3 py-2 border rounded"
          />
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricsCard
          title="Total Calls"
          value={metrics.summary.totalCalls}
          change="+12%"
          trend="up"
        />
        <MetricsCard
          title="Completion Rate"
          value={`${metrics.summary.completionRate}%`}
          change="+5%"
          trend="up"
        />
        <MetricsCard
          title="Avg Call Duration"
          value={`${Math.floor(metrics.summary.avgCallDuration / 60)}:${(metrics.summary.avgCallDuration % 60).toString().padStart(2, '0')}`}
          change="-30s"
          trend="down"
        />
        <MetricsCard
          title="Total Talk Time"
          value={`${Math.floor(metrics.summary.totalTalkTime / 3600)}h ${Math.floor((metrics.summary.totalTalkTime % 3600) / 60)}m`}
          change="+2h"
          trend="up"
        />
      </div>
      
      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Outcomes */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Call Outcomes</h2>
          <CallOutcomeChart data={metrics.outcomes} />
        </div>
        
        {/* Queue Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Queue Status</h2>
          <QueueMetrics data={queue} />
        </div>
      </div>
      
      {/* Agent Status */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Agent Status</h2>
        </div>
        <AgentStatusList agents={agents} />
      </div>
      
      {/* Agent Performance Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Agent Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Calls</th>
                <th className="px-4 py-3 text-left">Avg Duration</th>
                <th className="px-4 py-3 text-left">Success Rate</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics.agentPerformance.map((agent: any) => (
                <tr key={agent.agentId} className="border-t">
                  <td className="px-4 py-3">Agent {agent.agentId}</td>
                  <td className="px-4 py-3">{agent.callCount}</td>
                  <td className="px-4 py-3">
                    {Math.floor(agent.avgDuration / 60)}:{(agent.avgDuration % 60).toString().padStart(2, '0')}
                  </td>
                  <td className="px-4 py-3">85%</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      Available
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

### Day 15: Enhanced Queue Features + Performance Optimization

#### Smart Prioritization System
```typescript
// apps/api/src/services/scoring.service.ts
export class ScoringService {
  async calculateUserScore(userId: number) {
    const factors = await this.gatherScoringFactors(userId);
    let score = 0;
    
    // Time since last contact (decay function)
    const daysSinceContact = factors.daysSinceLastContact || 30;
    score += Math.min(daysSinceContact * 2, 60);
    
    // Pending requirements boost
    score -= factors.pendingRequirements * 15;
    
    // Previous call outcomes
    if (factors.lastOutcome === 'not_interested') score += 50;
    if (factors.lastOutcome === 'no_answer') score += 10;
    if (factors.lastOutcome === 'callback_requested') score -= 20;
    
    // Claim value factor
    if (factors.claimValue > 5000) score -= 10;
    if (factors.claimValue > 10000) score -= 20;
    
    // Time of day preference
    const hour = new Date().getHours();
    if (factors.preferredCallTime) {
      const [start, end] = factors.preferredCallTime;
      if (hour >= start && hour <= end) score -= 5;
    }
    
    return {
      userId,
      score,
      factors,
      nextCallAfter: this.calculateNextCallTime(factors)
    };
  }
  
  private calculateNextCallTime(factors: any) {
    const now = new Date();
    
    // No calls for 48 hours after "not interested"
    if (factors.lastOutcome === 'not_interested') {
      return new Date(now.getTime() + 48 * 60 * 60 * 1000);
    }
    
    // Respect callback times
    if (factors.scheduledCallback) {
      return factors.scheduledCallback;
    }
    
    // Default: eligible immediately
    return now;
  }
}

// Callback Scheduling
// apps/api/src/controllers/callback.controller.ts
export const scheduleCallback = async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;
  const { date, time, notes } = req.body;
  
  // Get call session
  const session = await prisma.callSession.findUnique({
    where: { id: sessionId }
  });
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND' }
    });
  }
  
  // Create callback entry
  const callback = await prisma.callback.create({
    data: {
      userId: session.userId,
      agentId: req.agent!.id,
      scheduledFor: new Date(`${date}T${time}`),
      notes,
      originalSessionId: sessionId
    }
  });
  
  // Update user score to prevent immediate re-queue
  await prisma.userCallScore.update({
    where: { userId: session.userId },
    data: { nextCallAfter: callback.scheduledFor }
  });
  
  res.json({ success: true, data: callback });
};
```

#### Redis Caching Layer
```typescript
// apps/api/src/services/cache.service.ts
export class CacheService {
  private redis: RedisClient;
  private ttl = {
    user: 900, // 15 minutes
    queue: 60, // 1 minute
    claims: 1800 // 30 minutes
  };
  
  async getUserData(userId: number) {
    const key = `user:${userId}`;
    
    // Try cache first
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);
    
    // Fetch from database
    const data = await databaseService.getUserData(userId);
    
    // Cache for next time
    await this.redis.setex(key, this.ttl.user, JSON.stringify(data));
    
    return data;
  }
  
  async invalidateUser(userId: number) {
    const keys = [
      `user:${userId}`,
      `user:${userId}:claims`,
      `user:${userId}:requirements`
    ];
    
    await this.redis.del(...keys);
  }
  
  // Queue caching with automatic refresh
  async getQueueData(status: string, page: number) {
    const key = `queue:${status}:${page}`;
    const cached = await this.redis.get(key);
    
    if (cached) {
      // Return cached data but trigger background refresh
      this.refreshQueueInBackground(status, page);
      return JSON.parse(cached);
    }
    
    return this.refreshQueue(status, page);
  }
  
  private async refreshQueueInBackground(status: string, page: number) {
    setTimeout(() => {
      this.refreshQueue(status, page);
    }, 0);
  }
}

// Database indexing optimization
// apps/api/prisma/migrations/002_performance_indexes.sql
CREATE INDEX idx_call_sessions_date ON call_sessions(created_at DESC);
CREATE INDEX idx_call_outcomes_session ON call_outcomes(call_session_id);
CREATE INDEX idx_user_scores_composite ON user_call_scores(next_call_after, score);
CREATE INDEX idx_queue_status_priority ON call_queue(status, priority_score);
```

---

## Week 4: Production Hardening + Buffer Time

### Day 16-17: Real-time Features + Enhanced Testing

#### WebSocket Implementation
```typescript
// apps/api/src/services/websocket.service.ts
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export class WebSocketService {
  private io: Server;
  private agentSockets = new Map<number, string>();
  
  initialize(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true
      }
    });
    
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      socket.on('agent:login', (agentId: number) => {
        this.agentSockets.set(agentId, socket.id);
        socket.join(`agent:${agentId}`);
      });
      
      socket.on('disconnect', () => {
        // Remove from agent map
        for (const [agentId, socketId] of this.agentSockets) {
          if (socketId === socket.id) {
            this.agentSockets.delete(agentId);
            break;
          }
        }
      });
    });
  }
  
  // Notify agent of queue updates
  notifyQueueUpdate(agentId: number, data: any) {
    this.io.to(`agent:${agentId}`).emit('queue:update', data);
  }
  
  // Broadcast call status to supervisors
  broadcastCallStatus(callData: any) {
    this.io.to('supervisors').emit('call:status', callData);
  }
}

// Frontend WebSocket hook
// apps/web/src/hooks/useWebSocket.ts
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';

let socket: Socket | null = null;

export function useWebSocket() {
  const { agent } = useAuthStore();
  
  useEffect(() => {
    if (agent && !socket) {
      socket = io(import.meta.env.VITE_WS_URL, {
        auth: {
          token: localStorage.getItem('token')
        }
      });
      
      socket.on('connect', () => {
        console.log('WebSocket connected');
        socket!.emit('agent:login', agent.id);
      });
      
      socket.on('queue:update', (data) => {
        // Handle queue updates
        queryClient.invalidateQueries(['queue']);
      });
    }
    
    return () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, [agent]);
  
  return socket;
}
```

#### Enhanced Testing Suite
```typescript
// apps/api/src/__tests__/integration/queue.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { prisma } from '../../services/database.service';

describe('Queue Integration Tests', () => {
  let authToken: string;
  let testAgent: any;
  let testUser: any;
  
  beforeEach(async () => {
    // Create test agent
    testAgent = await prisma.agent.create({
      data: {
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        firstName: 'Test',
        lastName: 'Agent',
        role: 'agent'
      }
    });
    
    // Login and get token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    
    authToken = res.body.data.token;
    
    // Create test user in queue
    testUser = await prisma.callQueue.create({
      data: {
        userId: 12345,
        claimId: 67890,
        priorityScore: 50,
        queuePosition: 1,
        status: 'pending'
      }
    });
  });
  
  afterEach(async () => {
    // Cleanup
    await prisma.callSession.deleteMany();
    await prisma.callQueue.deleteMany();
    await prisma.agent.deleteMany();
  });
  
  it('should return paginated queue with user data', async () => {
    const res = await request(app)
      .get('/api/queue?page=1&limit=20')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.data[0]).toHaveProperty('userId');
  });
  
  it('should assign call to available agent', async () => {
    // Set agent as available
    await prisma.agentSession.create({
      data: {
        agentId: testAgent.id,
        status: 'available'
      }
    });
    
    const res = await request(app)
      .post(`/api/queue/${testUser.id}/assign`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('assigned');
    expect(res.body.data.assignedToAgentId).toBe(testAgent.id);
  });
  
  it('should reject assignment when agent unavailable', async () => {
    // Set agent as on call
    await prisma.agentSession.create({
      data: {
        agentId: testAgent.id,
        status: 'on_call'
      }
    });
    
    const res = await request(app)
      .post(`/api/queue/${testUser.id}/assign`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AGENT_NOT_AVAILABLE');
  });
});

// E2E Tests with Playwright
// apps/web/src/__tests__/e2e/call-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Complete Call Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as agent
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    
    // Wait for queue page
    await expect(page).toHaveURL('/queue');
  });
  
  test('agent can complete full call workflow', async ({ page }) => {
    // 1. View queue
    await expect(page.locator('[data-testid=queue-item]').first()).toBeVisible();
    
    // 2. Start call
    await page.click('[data-testid=call-button]');
    await expect(page).toHaveURL(/\/call\/.+/);
    
    // 3. Call interface loaded
    await expect(page.locator('[data-testid=user-name]')).toBeVisible();
    await expect(page.locator('[data-testid=call-timer]')).toBeVisible();
    
    // 4. Record outcome
    await page.selectOption('[data-testid=outcome-select]', 'contacted');
    await page.fill('[data-testid=notes-textarea]', 'User was interested in proceeding');
    
    // 5. Send magic link
    await page.click('[data-testid=send-magic-link]');
    await expect(page.locator('[data-testid=magic-link-sent]')).toBeVisible();
    
    // 6. End call
    await page.click('[data-testid=end-call]');
    
    // 7. Return to queue
    await expect(page).toHaveURL('/queue');
    
    // 8. Verify call was recorded
    await page.goto('/calls/history');
    await expect(page.locator('[data-testid=call-history-item]').first()).toBeVisible();
  });
  
  test('supervisor can view real-time dashboard', async ({ page }) => {
    // Login as supervisor
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'supervisor@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Verify metrics are visible
    await expect(page.locator('[data-testid=total-calls-metric]')).toBeVisible();
    await expect(page.locator('[data-testid=completion-rate-metric]')).toBeVisible();
    await expect(page.locator('[data-testid=agent-status-list]')).toBeVisible();
    
    // Check real-time updates (mock a call)
    // ... additional test logic
  });
});
```

### Day 18-19: Production Hardening + Security

#### Enhanced Error Handling & Monitoring
```typescript
// apps/api/src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/services/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Request error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    user: (req as any).agent,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }
  
  // Database errors
  if (err.message.includes('P2002')) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'This record already exists'
      }
    });
  }
  
  // Validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.issues
      }
    });
  }
  
  // Default error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
};

// Security enhancements
// apps/api/src/middleware/security.middleware.ts
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

export const createRateLimit = (windowMs: number, max: number) => 
  rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      }
    }
  });

export const createSlowDown = (windowMs: number, delayAfter: number) =>
  slowDown({
    windowMs,
    delayAfter,
    delayMs: 500
  });

// Phone number validation and sanitization
export const validatePhoneNumber = (phone: string): string | null => {
  const cleaned = phone.replace(/\D/g, '');
  
  // UK numbers
  if (cleaned.startsWith('44') && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+44${cleaned.slice(1)}`;
  }
  if (cleaned.length === 10) {
    return `+44${cleaned}`;
  }
  
  return null;
};

// GDPR compliance middleware
export const gdprCompliance = async (req: Request, res: Response, next: NextFunction) => {
  // Log data access for GDPR audit trail
  if (req.params.userId) {
    logger.info('User data accessed', {
      userId: req.params.userId,
      agentId: (req as any).agent?.id,
      endpoint: req.url,
      method: req.method,
      timestamp: new Date()
    });
  }
  next();
};
```

#### Health Monitoring & Metrics
```typescript
// apps/api/src/services/health.service.ts
export class HealthService {
  async performHealthCheck() {
    const checks = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {
        api: await this.checkAPI(),
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
        twilio: await this.checkTwilio(),
        replica: await this.checkReplica()
      }
    };
    
    const allHealthy = Object.values(checks.checks)
      .every(check => check.status === 'healthy');
    
    checks.status = allHealthy ? 'healthy' : 'degraded';
    
    return checks;
  }
  
  private async checkAPI() {
    return {
      status: 'healthy',
      responseTime: process.hrtime(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
  
  private async checkDatabase() {
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  private async checkRedis() {
    try {
      const start = Date.now();
      await redis.ping();
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  private async checkTwilio() {
    try {
      await twilioService.getAccountInfo();
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  private async checkReplica() {
    try {
      const start = Date.now();
      await replicaPool.execute('SELECT 1');
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}
```

### Day 20: Final Testing + Deployment

#### Deployment Configuration
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "apps/api/src/app.ts",
      "use": "@vercel/node"
    },
    {
      "src": "apps/web/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "apps/api/src/app.ts"
    },
    {
      "src": "/(.*)",
      "dest": "apps/web/$1"
    }
  ],
  "env": {
    "DATABASE_URL": "@database_url",
    "REPLICA_DATABASE_URL": "@replica_database_url",
    "REDIS_URL": "@redis_url",
    "JWT_SECRET": "@jwt_secret",
    "TWILIO_ACCOUNT_SID": "@twilio_account_sid",
    "TWILIO_AUTH_TOKEN": "@twilio_auth_token"
  }
}

// package.json scripts
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "start": "turbo run start",
    "test": "turbo run test",
    "test:integration": "turbo run test:integration",
    "test:e2e": "turbo run test:e2e",
    "deploy": "vercel --prod",
    "migrate": "cd apps/api && npx prisma migrate deploy",
    "db:seed": "cd apps/api && npx prisma db seed",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check"
  }
}
```

#### Final Load Testing
```typescript
// Load testing with k6
// scripts/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 10 }, // Steady state
    { duration: '2m', target: 0 },  // Ramp down
  ],
};

export default function() {
  // Login
  const loginRes = http.post(`${__ENV.BASE_URL}/api/auth/login`, {
    email: 'loadtest@example.com',
    password: 'password123'
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });
  
  const token = loginRes.json('data.token');
  
  // Get queue
  const queueRes = http.get(`${__ENV.BASE_URL}/api/queue`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  check(queueRes, {
    'queue loaded': (r) => r.status === 200,
    'queue has data': (r) => r.json('data').length >= 0,
  });
  
  sleep(1);
}
```

---

## Week 5 (Buffer Week): Polish & Advanced Features

### Day 21-22: Advanced SMS Features
- Two-way conversation threading
- SMS templates and automation
- Conversation analytics

### Day 23-24: AI Agent Integration Prep
- API endpoints for AI agent integration
- Webhook system for external AI services
- Call outcome automation

### Day 25: Documentation & Training
- Complete API documentation
- User training materials
- Deployment runbooks

---

## Post-Launch Monitoring & Optimization

### Key Metrics to Track
1. **Call Metrics**
   - Average call duration
   - Connection success rate
   - Outcomes distribution
   
2. **Queue Metrics**
   - Average wait time
   - Assignment rate
   - Queue depth over time
   
3. **Agent Metrics**
   - Calls per hour
   - Average handle time
   - Login/logout patterns

4. **Business Metrics**
   - Magic link click rates
   - Document completion rates
   - Claim progression after calls

### Performance Monitoring
```typescript
// apps/api/src/services/metrics.service.ts
export class MetricsService {
  async collectMetrics() {
    const metrics = {
      timestamp: new Date(),
      queue: {
        pending: await prisma.callQueue.count({ where: { status: 'pending' } }),
        assigned: await prisma.callQueue.count({ where: { status: 'assigned' } })
      },
      agents: {
        online: await prisma.agentSession.count({ where: { status: { not: 'offline' } } }),
        onCall: await prisma.agentSession.count({ where: { status: 'on_call' } })
      },
      calls: {
        today: await this.getCallsToday(),
        avgDuration: await this.getAvgCallDuration()
      },
      system: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        activeConnections: this.getActiveConnections()
      }
    };
    
    // Store in time-series database or monitoring service
    await this.storeMetrics(metrics);
    
    // Alert on thresholds
    await this.checkAlerts(metrics);
  }
  
  private async checkAlerts(metrics: any) {
    // Queue depth alert
    if (metrics.queue.pending > 100) {
      await this.sendAlert('Queue depth exceeded threshold', metrics);
    }
    
    // Response time alert
    if (metrics.system.responseTime > 2000) {
      await this.sendAlert('Response time degraded', metrics);
    }
    
    // Memory usage alert
    const memoryUsagePercent = (metrics.system.memoryUsage.heapUsed / metrics.system.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 85) {
      await this.sendAlert('High memory usage', metrics);
    }
  }
}
```

### Continuous Improvement Areas
1. **A/B Testing Framework** for call scripts and timing
2. **Machine Learning** for queue prioritization optimization
3. **Voice Analytics** integration with Twilio
4. **Advanced Reporting** with custom dashboard builder
5. **Mobile App** for agents using React Native

## Success Criteria

### Week 1 Deliverables
- ✅ Database replica configured and syncing
- ✅ Core schema implemented with all tables
- ✅ Basic API with enhanced authentication and error handling
- ✅ React app foundation with comprehensive testing setup

### Week 2 Deliverables
- ✅ Queue management system with smart prioritization
- ✅ Call session handling with state management
- ✅ Enhanced SMS integration with two-way messaging
- ✅ Magic link system with analytics and tracking

### Week 3 Deliverables
- ✅ Twilio voice integration with browser SDK
- ✅ Supervisor dashboard with real-time analytics
- ✅ Performance optimization with Redis caching
- ✅ WebSocket real-time updates

### Week 4 Deliverables
- ✅ Production-grade error handling and monitoring
- ✅ Comprehensive testing suite (unit, integration, E2E)
- ✅ Security hardening and GDPR compliance
- ✅ Deployed to Vercel with health monitoring
- ✅ Ready for Azure migration

### Additional Enhancements Added
- ✅ Enhanced SMS conversations with threading
- ✅ Magic link analytics and validation
- ✅ Comprehensive supervisor dashboard
- ✅ Advanced error handling and circuit breakers
- ✅ Load testing and performance monitoring
- ✅ GDPR compliance features
- ✅ Enhanced testing infrastructure
- ✅ Buffer time for polish and debugging