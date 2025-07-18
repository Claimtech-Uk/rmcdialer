# 🚀 Next.js 14 + tRPC Deployment Guide

## Overview

This guide covers deploying the unified RMC Dialler System built with Next.js 14, tRPC, and modern React patterns to production on Vercel.

## 📋 Prerequisites

### Development Environment
- Node.js 20+
- PostgreSQL database
- Redis instance
- Twilio account with Voice and SMS capabilities
- Vercel account

### Required Services
- **Database**: Neon PostgreSQL (or other PostgreSQL provider)
- **Cache**: Upstash Redis (or other Redis provider)
- **Email**: SendGrid account
- **Voice/SMS**: Twilio account
- **Deployment**: Vercel account

## 🔧 Environment Configuration

### Development (.env.local)
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dialler_features"
REPLICA_DATABASE_URL="mysql://readonly:password@replica:3306/main_db"

# Cache
REDIS_URL="redis://localhost:6379"

# Authentication
NEXTAUTH_SECRET="your-super-secret-nextauth-key-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"

# Twilio
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"
TWILIO_TWIML_APP_SID="your-twiml-app-sid"
TWILIO_API_KEY="your-twilio-api-key"
TWILIO_API_SECRET="your-twilio-api-secret"

# External APIs
SENDGRID_API_KEY="your-sendgrid-api-key"
OPENAI_API_KEY="your-openai-api-key"

# Application URLs
MAIN_APP_URL="http://localhost:3001"

# Feature Flags
ENABLE_AI_AGENTS="false"
ENABLE_SMS_REPLIES="true"
```

### Production (.env.production)
```env
# Database
DATABASE_URL="postgresql://production:password@db.region.neon.tech:5432/dialler_prod"
REPLICA_DATABASE_URL="mysql://readonly:password@prod-replica:3306/main_db"

# Cache
REDIS_URL="rediss://user:password@redis.upstash.io:6379"

# Authentication
NEXTAUTH_SECRET="your-production-secret-key-different-from-dev"
NEXTAUTH_URL="https://dialler.resolvemyclaim.co.uk"

# Twilio
TWILIO_ACCOUNT_SID="your-production-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-production-twilio-auth-token"
TWILIO_PHONE_NUMBER="+441234567890"
TWILIO_TWIML_APP_SID="your-production-twiml-app-sid"
TWILIO_API_KEY="your-production-twilio-api-key"
TWILIO_API_SECRET="your-production-twilio-api-secret"

# External APIs
SENDGRID_API_KEY="your-production-sendgrid-api-key"
OPENAI_API_KEY="your-production-openai-api-key"

# Application URLs
MAIN_APP_URL="https://claim.resolvemyclaim.co.uk"

# Feature Flags
ENABLE_AI_AGENTS="true"
ENABLE_SMS_REPLIES="true"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
VERCEL_ANALYTICS_ID="your-vercel-analytics-id"
```

## 🗄️ Database Setup

### 1. Production Database (Neon PostgreSQL)
```bash
# Create production database
npx prisma migrate deploy

# Seed production data
npm run db:seed:production
```

### 2. Database Connection Pooling
```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 3. Redis Setup (Upstash)
```typescript
// lib/redis.ts
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN
})
```

## 🌐 Vercel Deployment

### 1. Project Configuration

#### vercel.json
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "regions": ["lhr1"],
  "functions": {
    "app/api/**": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/webhooks/:path*",
      "destination": "/api/webhooks/:path*"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://dialler.resolvemyclaim.co.uk"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-Requested-With, Content-Type, Authorization"
        }
      ]
    }
  ]
}
```

#### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    serverComponentsExternalPackages: ['@prisma/client']
  },
  eslint: {
    dirs: ['app', 'components', 'lib', 'server', 'types']
  },
  typescript: {
    ignoreBuildErrors: false
  },
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['images.resolvemyclaim.co.uk'],
    formats: ['image/webp', 'image/avif']
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
```

### 2. Deployment Steps

#### CLI Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project
vercel link

# Set environment variables
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
# ... add all environment variables

# Deploy to production
vercel --prod
```

#### GitHub Integration
1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Enable automatic deployments from `main` branch
4. Set up preview deployments for pull requests

### 3. Custom Domain Setup
```bash
# Add custom domain
vercel domains add dialler.resolvemyclaim.co.uk

# Configure DNS records
# A record: @ -> 76.76.19.61
# CNAME: www -> cname.vercel-dns.com
```

## 📱 Twilio Configuration

### 1. Voice Configuration
```javascript
// TwiML App Configuration
{
  "friendlyName": "RMC Dialler Production",
  "voiceUrl": "https://dialler.resolvemyclaim.co.uk/api/twilio/voice",
  "voiceMethod": "POST",
  "statusCallback": "https://dialler.resolvemyclaim.co.uk/api/webhooks/twilio/status",
  "statusCallbackMethod": "POST"
}
```

### 2. SMS Configuration
```javascript
// Webhook Configuration
{
  "smsUrl": "https://dialler.resolvemyclaim.co.uk/api/webhooks/twilio/sms",
  "smsMethod": "POST",
  "statusCallback": "https://dialler.resolvemyclaim.co.uk/api/webhooks/twilio/sms-status"
}
```

### 3. API Keys Setup
```bash
# Create API Key in Twilio Console
# Name: "RMC Dialler Production"
# Copy SID and Secret to environment variables
```

## 🔐 Security Configuration

### 1. JWT Configuration
```typescript
// lib/auth.ts
export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET!,
  issuer: 'dialler.resolvemyclaim.co.uk',
  audience: 'rmc-dialler-agents',
  expiresIn: '8h',
  algorithm: 'HS256' as const
}
```

### 2. CORS Configuration
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    
    response.headers.set('Access-Control-Allow-Origin', 'https://dialler.resolvemyclaim.co.uk')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    return response
  }

  return NextResponse.next()
}
```

### 3. Rate Limiting
```typescript
// lib/rate-limit.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!
})

export async function rateLimit(identifier: string, limit: number = 100, window: number = 60) {
  const key = `rate_limit:${identifier}`
  const current = await redis.incr(key)
  
  if (current === 1) {
    await redis.expire(key, window)
  }
  
  return {
    success: current <= limit,
    remaining: Math.max(0, limit - current),
    reset: Date.now() + (window * 1000)
  }
}
```

## 📊 Monitoring & Analytics

### 1. Error Tracking (Sentry)
```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV
})
```

### 2. Performance Monitoring
```typescript
// lib/analytics.ts
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export { Analytics, SpeedInsights }
```

### 3. Health Checks
```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: 'checking',
    redis: 'checking',
    timestamp: new Date().toISOString()
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'healthy'
  } catch (error) {
    checks.database = 'unhealthy'
  }

  try {
    await redis.ping()
    checks.redis = 'healthy'
  } catch (error) {
    checks.redis = 'unhealthy'
  }

  const isHealthy = checks.database === 'healthy' && checks.redis === 'healthy'
  
  return Response.json(checks, { 
    status: isHealthy ? 200 : 503 
  })
}
```

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] Twilio webhooks configured
- [ ] DNS records updated
- [ ] SSL certificates verified

### Production Deployment
- [ ] Build completes without errors
- [ ] TypeScript compilation successful
- [ ] All tests passing
- [ ] Health check endpoint responding
- [ ] Database connectivity verified
- [ ] Redis connectivity verified

### Post-Deployment
- [ ] Authentication flow working
- [ ] Twilio voice calls functional
- [ ] SMS sending/receiving working
- [ ] Magic links generating correctly
- [ ] Queue management operational
- [ ] Error tracking active
- [ ] Performance monitoring enabled

### Rollback Plan
```bash
# Rollback to previous deployment
vercel rollback

# Or rollback to specific deployment
vercel rollback <deployment-url>
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check database connectivity
npx prisma db pull

# Verify migrations
npx prisma migrate status
```

#### 2. Environment Variable Issues
```bash
# Check environment variables in Vercel
vercel env ls

# Add missing variables
vercel env add VARIABLE_NAME production
```

#### 3. Build Failures
```bash
# Check build logs
vercel logs <deployment-url>

# Local build test
npm run build
```

#### 4. Twilio Webhook Issues
```bash
# Test webhook endpoints
curl -X POST https://dialler.resolvemyclaim.co.uk/api/webhooks/twilio/sms \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B1234567890&Body=test&MessageSid=test123"
```

### Performance Optimization

#### 1. Bundle Analysis
```bash
# Analyze bundle size
npm run build
npm run analyze
```

#### 2. Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_call_queue_status_priority 
ON call_queue (status, priority_score, created_at);

CREATE INDEX CONCURRENTLY idx_call_sessions_agent_date 
ON call_sessions (agent_id, created_at DESC);
```

#### 3. Caching Strategy
```typescript
// lib/cache.ts
export const cacheConfig = {
  userContext: 900,      // 15 minutes
  queueData: 60,         // 1 minute
  agentStats: 300,       // 5 minutes
  magicLinkAnalytics: 1800 // 30 minutes
}
```

---

## 📞 Support

For deployment issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test database connectivity
4. Review Twilio webhook configuration
5. Contact development team if issues persist

---

**Last Updated**: November 2024
**Architecture**: Next.js 14 + tRPC + Vercel
**Deployment Status**: Ready for Production 