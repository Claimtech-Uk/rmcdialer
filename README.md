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
- **Intelligent Call Queue** - Priority-based user targeting with real-time updates
- **Twilio Voice Integration** - Browser-based calling with recording
- **Magic Link Generation** - Secure, trackable authentication links
- **SMS Conversations** - Two-way messaging with users
- **Supervisor Dashboard** - Real-time analytics and monitoring
- **Agent Management** - Session tracking and performance metrics
- **Real-time Data Sync** - CDC + Batch hybrid for instant updates

## 📋 Queue Management Strategy

### Three Specialized Queue Types

The system operates three distinct call queues, each serving specific business purposes:

#### 🖊️ **Queue 1: Unsigned Users** (Priority 1 - Highest)
- **Purpose**: Obtain missing signatures to unblock claim progress
- **Criteria**: `current_signature_file_id IS NULL`
- **Business Impact**: Highest priority - signature missing blocks all claim progress
- **Agent Focus**: Get users to provide digital signatures
- **Typical Volume**: ~15-20% of active claims

#### 📋 **Queue 2: Outstanding Requests** (Priority 2 - Medium)  
- **Purpose**: Follow up on pending document requirements
- **Criteria**: `requirements.status = 'PENDING' AND current_signature_file_id IS NOT NULL`
- **Business Impact**: Medium priority - claim can progress but needs supporting documents
- **Agent Focus**: Chase specific documents (bank statements, ID, proof of address)
- **Typical Volume**: ~60-70% of active claims

#### 📞 **Queue 3: Callbacks** (Priority 1 - High)
- **Purpose**: Honor callback requests from previous call attempts
- **Criteria**: `scheduled_callback_date <= NOW()`
- **Business Impact**: High priority - user expectation already set
- **Agent Focus**: Complete previous conversation or address specific user requests
- **Typical Volume**: ~10-15% of daily calls

### Agent Specialization Model

- **Each agent operates on one queue type** - allows specialization and focused mindset
- **Queue-specific training** - agents become experts in their queue's typical scenarios
- **Improved efficiency** - agents know exactly why they're calling before dialing
- **Better outcomes** - targeted conversations vs generic "checking in" calls

### Queue Population Logic

#### Unsigned Users Detection
```sql
-- Users missing signatures
SELECT users.* FROM users 
WHERE current_signature_file_id IS NULL 
  AND is_enabled = true 
  AND status != 'inactive'
  AND EXISTS (SELECT 1 FROM claims WHERE user_id = users.id AND status != 'complete')
```

#### Outstanding Requests Detection
```sql
-- Users with pending requirements (but have signatures)
SELECT users.* FROM users 
WHERE current_signature_file_id IS NOT NULL 
  AND is_enabled = true
  AND EXISTS (
    SELECT 1 FROM claims c
    JOIN claim_requirements cr ON c.id = cr.claim_id
    WHERE c.user_id = users.id AND cr.status = 'PENDING'
  )
```

#### Callback Queue Detection
```sql
-- Users with scheduled callbacks due now
SELECT users.* FROM callbacks cb
JOIN users ON cb.user_id = users.id
WHERE cb.status = 'pending' 
  AND cb.scheduled_for <= NOW()
  AND users.is_enabled = true
```

### Advanced Priority Scoring System

Each queue maintains sophisticated priority scoring via a dedicated **Scoring Module**:

#### **Lender-Based Scoring**
- **High-value lenders** (Santander, Lloyds, Barclays) get priority boosts
- **Configurable lender matrix** for business rule adjustments
- **Regional lender preferences** for specialized teams

#### **User Demographics**  
- **Age-based prioritization** - elderly users receive higher priority
- **Location factors** - regional optimization
- **Historical conversion rates** by demographic segments

#### **Time-Based Factors**
- **Days since claim created** - older claims get priority
- **Days since last contact** - longer gaps = higher priority
- **Optimal calling windows** - respect user preferences
- **Callback timing** - honor specific callback requests

#### **Disposition History**
- **Previous call outcomes** - failed attempts get cooldown periods
- **Communication preferences** - SMS vs call response rates  
- **Agent interaction history** - successful agent matching
- **Seasonal patterns** - holiday and month-end adjustments

### Queue Refresh Strategy

- **Real-time updates** via CDC for critical changes (new requirements, signatures added)
- **5-minute batch refresh** for queue population
- **Intelligent caching** to prevent duplicate processing
- **Cross-queue movement** - users automatically move between queues as status changes

## 🏗️ Architecture

### Technology Stack
- **Framework**: Next.js 14 (App Router) + TypeScript
- **API Layer**: tRPC (type-safe RPC) + TanStack Query
- **Database**: PostgreSQL + Prisma ORM + MySQL replica (claims data)
- **Data Sync**: AWS DMS (CDC) + SQS (Message Queue) + Redis (Cache)
- **Authentication**: JWT + Next.js middleware
- **UI Components**: Tailwind CSS + shadcn/ui + Radix UI primitives
- **State Management**: tRPC + TanStack Query (server state) + localStorage (client state)
- **Real-time**: Server-Sent Events (SSE) + WebSockets
- **External Services**: Twilio (voice/SMS), SendGrid (email), OpenAI (AI agents)

### Database & Sync Strategy
```
┌─────────────────────┐    ┌─────────────────┐    ┌──────────────────────┐
│   Main Laravel App  │───▶│   AWS DMS       │───▶│   SQS Message Queue  │
│  claim.resolvemy... │    │ (Change Stream) │    │  (Change Events)     │
└─────────────────────┘    └─────────────────┘    └──────────────────────┘
         │                                                    │
         ▼                                                    ▼
┌─────────────────────┐    ┌─────────────────┐    ┌──────────────────────┐
│   MySQL Replica     │    │  Redis Cache    │    │   Next.js Dialler   │
│  (Read-Only Data)   │◄──▶│   (Hot Data)    │◄──▶│ dialler.resolvemy... │
└─────────────────────┘    └─────────────────┘    └──────────────────────┘
                                    │                         │
                                    └─────────────────────────┼─────────────┐
                                                              ▼             │
                                                   ┌──────────────────────┐ │
                                                   │   PostgreSQL        │ │
                                                   │ (Dialler Features)  │◄┘
                                                   └──────────────────────┘
```

### Data Flow Overview
1. **Real-time Changes (CDC)**: AWS DMS captures database changes instantly
2. **Event Processing**: SQS delivers change notifications to dialler
3. **Cache Layer**: Redis stores frequently accessed data for performance
4. **Scoring Engine**: Dedicated module calculates priority scores using lender rules, demographics, and history
5. **Queue Prioritization**: Scoring system feeds intelligent queue ordering
6. **Batch Processing**: Periodic housekeeping and missed change recovery
7. **User Context**: Combined data from MySQL replica + PostgreSQL dialler data

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Redis instance  
- Twilio account
- AWS account (for DMS and SQS)

### Environment Setup
1. Copy environment template:
   ```bash
   cp env.template .env.local
   ```

2. Configure your environment variables in `.env.local`:
   ```env
   # Databases
   DATABASE_URL="postgresql://user:password@localhost:5432/dialler_features"
   REPLICA_DATABASE_URL="mysql://readonly:password@replica:3306/main_db"
   REDIS_URL="redis://localhost:6379"
   
   # Twilio
   TWILIO_ACCOUNT_SID="your-twilio-account-sid"
   TWILIO_AUTH_TOKEN="your-twilio-auth-token"
   
   # Authentication
   NEXTAUTH_SECRET="your-super-secret-nextauth-key"
   NEXTAUTH_URL="http://localhost:3000"
   
   # AWS Services
   AWS_ACCESS_KEY_ID="your-aws-access-key"
   AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
   AWS_REGION="eu-west-1"
   SQS_QUEUE_URL="https://sqs.eu-west-1.amazonaws.com/account/user-changes"
   
   # External Apps
   MAIN_APP_URL="https://claim.resolvemyclaim.co.uk"
   ```

### Installation & Development
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed

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
├── modules/                    # Business Modules (Modulith)
│   ├── auth/                  # Authentication & sessions
│   ├── calls/                 # Call management
│   ├── communications/        # SMS & magic links
│   ├── queue/                 # Queue management
│   ├── **scoring/**           # **Priority scoring & business rules**
│   ├── users/                 # User data & sync
│   ├── analytics/             # Metrics & reporting
│   └── core/                  # Shared utilities
├── lib/                       # Infrastructure libraries
│   ├── db.ts                  # Database clients (PostgreSQL + MySQL)
│   ├── redis.ts               # Redis cache client
│   ├── aws.ts                 # AWS services (SQS, DMS)
│   ├── trpc/                  # tRPC client setup
│   └── utils.ts               # General utilities
├── server/                    # tRPC API layer
│   ├── api/                   # tRPC routers (delegate to modules)
│   └── middleware/            # Server middleware
├── services/                  # Background services
│   ├── sync/                  # CDC + Batch sync services
│   ├── queue/                 # Queue population services
│   └── cache/                 # Cache warming services
├── prisma/                    # Database schemas & migrations
│   ├── schema.prisma          # PostgreSQL schema (dialler data)
│   ├── replica.prisma         # MySQL schema (main app data)
│   └── migrations/            # Database migrations
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
npm run db:generate      # Generate Prisma clients
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed development data

# Services
npm run sync:start       # Start sync services
npm run sync:test        # Test sync functionality
npm run queue:refresh    # Manual queue refresh
npm run scoring:test     # Test scoring algorithms
npm run scoring:explain  # Debug scoring for specific users

# Build & Deploy
npm run build            # Build for production
npm run start            # Start production server
npm run deploy           # Deploy to Vercel
```

### Development Features
- **Hot reloading** with Next.js dev server
- **Type-safe APIs** with tRPC and automatic client generation
- **Database migrations** with Prisma
- **Real-time updates** in development environment
- **Mock data** for development and testing

## 🔄 Data Synchronization

### Real-time Sync (CDC)
- **AWS DMS** monitors MySQL database for changes
- **Instant notifications** for critical updates (phone numbers, claim status)
- **Event processing** via SQS message queue
- **Sub-second latency** for important changes

### Batch Processing
- **Every 15 minutes**: Catch missed changes and bulk updates
- **Every hour**: Cache warming and data optimization
- **Every 6 hours**: Full data integrity checks
- **Daily**: Cleanup and maintenance tasks

### Cache Strategy
- **User contexts**: 15-minute TTL for frequently accessed data
- **Queue data**: 5-minute TTL for call queue information
- **Static data**: 1-hour TTL for reference data (lenders, solicitors)
- **Cache invalidation**: Automatic on relevant data changes

## 🔐 Security

- **JWT Authentication** with Next.js middleware
- **Type-safe APIs** with tRPC and Zod validation
- **Rate limiting** on all API endpoints
- **CORS protection** with Next.js built-in security
- **Environment variable protection**
- **Server-side validation** for all mutations
- **AWS IAM roles** for secure service access
- **Encrypted data in transit** for all external communications

## 📊 Monitoring & Observability

- **Health checks** at `/api/health` endpoint
- **Structured logging** with Winston
- **Error tracking** with comprehensive error boundaries
- **Performance monitoring** with Next.js analytics
- **Real-time updates** via Server-Sent Events
- **Sync monitoring** for CDC and batch processes
- **Queue metrics** for call volume and performance
- **Cache hit rates** and performance metrics

## 🚢 Deployment

### Vercel (Production)
The application is configured for Vercel deployment:

1. **Automatic deploys** from `main` branch
2. **Environment variables** configured in Vercel dashboard
3. **API routes** served as serverless functions
4. **Static assets** served from CDN
5. **Edge functions** for performance optimization

### AWS Services Required
- **RDS Read Replica** (already setup)
- **DMS Instance** for change data capture
- **SQS Queue** for message processing
- **IAM Roles** for service permissions

### Environment Variables (Production)
Configure these in your Vercel dashboard:
```env
# Core Application
DATABASE_URL=postgresql://production-db-url
REPLICA_DATABASE_URL=mysql://rmc-dialer-replica-url
REDIS_URL=redis://production-redis-url
NEXTAUTH_SECRET=production-secret
NEXTAUTH_URL=https://dialler.resolvemyclaim.co.uk

# AWS Services
AWS_ACCESS_KEY_ID=production-aws-key
AWS_SECRET_ACCESS_KEY=production-aws-secret
AWS_REGION=eu-west-1
SQS_QUEUE_URL=https://sqs.eu-west-1.amazonaws.com/account/user-changes

# External Services
TWILIO_ACCOUNT_SID=production-twilio-sid
TWILIO_AUTH_TOKEN=production-twilio-token
MAIN_APP_URL=https://claim.resolvemyclaim.co.uk

# Feature Flags
ENABLE_CDC_SYNC=true
ENABLE_BATCH_SYNC=true
ENABLE_CACHE_WARMING=true
```

## 📈 Performance & Scale

### Performance Targets
- **API Response**: < 200ms (cached), < 500ms (database)
- **Queue Refresh**: < 5 seconds
- **Page Load**: < 1 second
- **Real-time Updates**: < 3 seconds

### Scale Capabilities
- **Users**: Handles 50k+ users efficiently
- **Claims**: Processes 150k+ claims with complex relationships
- **Requirements**: Manages 200k+ requirements with real-time updates
- **Concurrent Agents**: Supports 100+ simultaneous users
- **Call Volume**: Handles 1000+ calls per day

### Cost Optimization
- **60% reduction** in database query costs via caching
- **90% reduction** in sync processing time
- **Real-time updates** eliminate polling overhead
- **Efficient batch processing** for bulk operations

## 📋 Contributing

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Follow naming conventions**: PascalCase components, camelCase functions
3. **Add tests**: Unit tests for utilities, integration tests for APIs
4. **Update documentation**: Keep README and comments current
5. **Test sync processes**: Ensure data integrity in development
6. **Submit PR**: With description of changes and testing notes

## 📄 License

This project is proprietary to Resolve My Claim Ltd.

---

**Questions?** Check the implementation guide in `/docs/implementation-guide.md` for detailed setup instructions and troubleshooting. 