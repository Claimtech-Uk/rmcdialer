# 📞 RMC Dialler System

A standalone dialler system for Resolve My Claim that enables agents to efficiently contact users about their financial claims. Built as a unified Next.js 14 application with type-safe tRPC APIs and modern React patterns.

## 🎯 Overview

### Core Business Goals
- **Increase claim completion rates** by proactively contacting users with pending requirements
- **Reduce friction** in the claims process by sending magic links for passwordless authentication
- **Prioritize high-value claims** through intelligent scoring and queue management
- **Track all interactions** for compliance and quality improvement
- **Scale operations** with both human and AI agents

### Key Features
- **Intelligent Call Queue** - Priority-based user targeting
- **Twilio Voice Integration** - Browser-based calling with recording
- **Magic Link Generation** - Secure, trackable authentication links
- **SMS Conversations** - Two-way messaging with users
- **Supervisor Dashboard** - Real-time analytics and monitoring
- **Agent Management** - Session tracking and performance metrics

## 🏗️ Architecture

### Technology Stack
- **Framework**: Next.js 14 (App Router) + TypeScript
- **API Layer**: tRPC (type-safe RPC) + TanStack Query
- **Database**: PostgreSQL + Prisma ORM + MySQL replica (claims data)
- **Authentication**: JWT + Next.js middleware
- **UI Components**: Tailwind CSS + shadcn/ui + Radix UI primitives
- **State Management**: tRPC + TanStack Query (server state) + localStorage (client state)
- **Real-time**: Server-Sent Events (SSE) + WebSockets
- **External Services**: Twilio (voice/SMS), SendGrid (email), OpenAI (AI agents)

### Database Strategy
```
┌─────────────────────┐         ┌──────────────────────┐
│   MySQL Replica     │ ◄────── │  Main Laravel App    │
│  (Read-Only Data)   │         │  claim.resolvemy...  │
└─────────────────────┘         └──────────────────────┘
         │                                    
         ▼ Cache (Redis)                     
┌─────────────────────┐         ┌──────────────────────┐
│   PostgreSQL        │         │   Next.js Dialler   │
│ (Dialler Features)  │ ◄────── │ dialler.resolvemy... │
└─────────────────────┘         └──────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Redis instance  
- Twilio account

### Environment Setup
1. Copy environment template:
   ```bash
   cp env.template .env.local
   ```

2. Configure your environment variables in `.env.local`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/dialler_features"
   REPLICA_DATABASE_URL="mysql://readonly:password@replica:3306/main_db"
   REDIS_URL="redis://localhost:6379"
   TWILIO_ACCOUNT_SID="your-twilio-account-sid"
   TWILIO_AUTH_TOKEN="your-twilio-auth-token"
   NEXTAUTH_SECRET="your-super-secret-nextauth-key"
   NEXTAUTH_URL="http://localhost:3000"
   ```

### Installation & Development
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

This will start the Next.js development server at: http://localhost:3000

### Build for Production
```bash
# Build the application
npm run build

# Start production server
npm start

# Deploy to Vercel
npm run deploy
```

## 📁 Project Structure

```
dialler-system/
├── app/                        # Next.js App Router
│   ├── (dashboard)/           # Protected dashboard routes
│   │   ├── calls/             # Call management
│   │   ├── queue/             # Call queue interface
│   │   ├── sms/               # SMS conversations
│   │   └── analytics/         # Supervisor dashboard
│   ├── api/                   # API routes & tRPC endpoints
│   │   ├── trpc/              # tRPC router setup
│   │   ├── auth/              # Authentication endpoints
│   │   └── webhooks/          # Twilio/external webhooks
│   ├── login/                 # Authentication pages
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Homepage
├── components/                 # Reusable UI components
│   ├── ui/                    # shadcn/ui components
│   ├── forms/                 # Form components
│   └── layout/                # Layout components
├── lib/                       # Utility libraries
│   ├── db.ts                  # Database client
│   ├── auth.ts                # Authentication utilities
│   ├── trpc/                  # tRPC client setup
│   └── utils.ts               # General utilities
├── server/                    # Server-side code
│   ├── api/                   # tRPC routers
│   ├── services/              # Business logic services
│   └── middleware/            # Server middleware
├── prisma/                    # Database schema & migrations
└── types/                     # Shared TypeScript types
```

## 🔧 Development

### Core Commands
```bash
# Development
npm run dev              # Start Next.js dev server
npm run test             # Run all tests
npm run lint             # Lint all code
npm run type-check       # TypeScript validation

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed development data

# Build & Deploy
npm run build            # Build for production
npm run start            # Start production server
npm run deploy           # Deploy to Vercel
```

### tRPC API Structure
- `api/trpc/[trpc].ts` - Main tRPC endpoint
- `server/api/routers/` - Type-safe API routers
- `lib/trpc/client.ts` - Client-side tRPC setup

### Key Features Status
- ✅ **Project Foundation** - Next.js 14, TypeScript, tRPC setup
- ✅ **Database Schema** - Complete Prisma schema with relationships  
- ✅ **Authentication** - JWT-based agent login with Next.js middleware
- 🚧 **Queue Management** - Priority-based call queue (migrating)
- 🚧 **Twilio Integration** - Voice calling and SMS (migrating)
- 🚧 **Magic Links** - Secure authentication links (migrating)

## 🔐 Security

- **JWT Authentication** with Next.js middleware
- **Type-safe APIs** with tRPC and Zod validation
- **Rate limiting** on all API endpoints
- **CORS protection** with Next.js built-in security
- **Environment variable protection**
- **Server-side validation** for all mutations

## 📊 Monitoring

- **Health checks** at `/api/health` endpoint
- **Structured logging** with Winston
- **Error tracking** with comprehensive error boundaries
- **Performance monitoring** with Next.js analytics
- **Real-time updates** via Server-Sent Events

## 🚢 Deployment

### Vercel (Production)
The application is configured for Vercel deployment:

1. **Automatic deploys** from `main` branch
2. **Environment variables** configured in Vercel dashboard
3. **API routes** served as serverless functions
4. **Static assets** served from CDN
5. **Edge functions** for performance optimization

### Environment Variables (Production)
Configure these in your Vercel dashboard:
- `DATABASE_URL` - PostgreSQL connection string
- `REPLICA_DATABASE_URL` - MySQL replica connection  
- `REDIS_URL` - Redis connection string
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `NEXTAUTH_SECRET` - Secret for JWT token signing
- `NEXTAUTH_URL` - Production URL

## 📋 Contributing

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Follow naming conventions**: PascalCase components, camelCase functions
3. **Add tests**: Unit tests for utilities, integration tests for APIs
4. **Update documentation**: Keep README and comments current
5. **Submit PR**: With description of changes and testing notes

## 📄 License

This project is proprietary to Resolve My Claim Ltd.

---

**Questions?** Check the migration guide for detailed Next.js implementation patterns. 