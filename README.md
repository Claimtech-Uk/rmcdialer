# 📞 RMC Dialler System

A standalone dialler system for Resolve My Claim that enables agents to efficiently contact users about their financial claims. The system reads user data from the main claims platform but operates completely independently with no write-backs.

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
- **Backend**: Node.js + Express + TypeScript + Prisma
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Databases**: PostgreSQL (dialler features) + MySQL replica (claims data)
- **Services**: Twilio (voice/SMS), Redis (cache), Socket.io (real-time)

### Database Strategy
```
┌─────────────────────┐         ┌──────────────────────┐
│   MySQL Replica     │ ◄────── │  Main Laravel App    │
│  (Read-Only Data)   │         │  claim.resolvemy...  │
└─────────────────────┘         └──────────────────────┘
         │                                    
         ▼ Cache (Redis)                     
┌─────────────────────┐         ┌──────────────────────┐
│   PostgreSQL        │         │   Dialler React App  │
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
   cp env.template .env
   ```

2. Configure your environment variables in `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/dialler_features"
   REPLICA_DATABASE_URL="mysql://readonly:password@replica:3306/main_db"
   REDIS_URL="redis://localhost:6379"
   TWILIO_ACCOUNT_SID="your-twilio-account-sid"
   TWILIO_AUTH_TOKEN="your-twilio-auth-token"
   JWT_SECRET="your-super-secret-jwt-key"
   ```

### Installation & Development
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run migrate

# Start development servers
npm run dev
```

This will start:
- **API Server**: http://localhost:3000
- **Web App**: http://localhost:5173

### Build for Production
```bash
# Build all packages
npm run build

# Deploy to Vercel
npm run deploy
```

## 📁 Project Structure

```
dialler-system/
├── apps/
│   ├── api/                    # Node.js/Express backend
│   │   ├── src/
│   │   │   ├── config/         # Database, Redis, Twilio configs
│   │   │   ├── controllers/    # Route handlers
│   │   │   ├── middleware/     # Auth, error handling, validation
│   │   │   ├── models/         # TypeScript interfaces & schemas
│   │   │   ├── services/       # Business logic layer
│   │   │   └── utils/          # Helpers and utilities
│   │   └── prisma/             # Database schema & migrations
│   │
│   └── web/                    # React frontend (Vite)
│       ├── src/
│       │   ├── components/     # UI components
│       │   ├── features/       # Feature-based modules
│       │   ├── hooks/          # Custom React hooks
│       │   ├── lib/            # API client, utilities
│       │   ├── pages/          # Route pages
│       │   └── store/          # Zustand state management
│
├── packages/
│   └── shared/                 # Shared types between api/web
│
└── infrastructure/
    ├── docker/                 # Docker configs
    └── scripts/                # Deployment & maintenance scripts
```

## 🔧 Development

### Core Commands
```bash
# Development
npm run dev              # Start all dev servers
npm run test             # Run all tests
npm run lint             # Lint all packages
npm run type-check       # TypeScript validation

# Database
npm run db:generate      # Generate Prisma client
npm run migrate          # Run database migrations
npm run db:seed          # Seed development data

# Build & Deploy
npm run build            # Build for production
npm run deploy           # Deploy to Vercel
```

### API Endpoints
- `GET /health` - Service health check
- `POST /api/auth/login` - Agent authentication
- `GET /api/queue` - Get call queue
- `POST /api/call-sessions` - Start new call
- `POST /api/magic-links` - Generate magic links
- `GET /api/sms/conversations` - SMS management

### Key Features Status
- ✅ **Project Foundation** - Monorepo, TypeScript, configurations
- ✅ **Database Schema** - Complete Prisma schema with relationships
- ✅ **API Foundation** - Express server with middleware
- ✅ **React Foundation** - Component structure and routing
- 🚧 **Authentication** - JWT-based agent login (planned)
- 🚧 **Queue Management** - Priority-based call queue (planned)
- 🚧 **Twilio Integration** - Voice calling and SMS (planned)
- 🚧 **Magic Links** - Secure authentication links (planned)

## 🔐 Security

- **JWT Authentication** for agent sessions
- **Rate limiting** on all API endpoints
- **Input validation** with Zod schemas
- **CORS protection** with origin restrictions
- **Helmet security headers** 
- **Environment variable protection**

## 📊 Monitoring

- **Health checks** at `/health` endpoint
- **Structured logging** with Winston
- **Error tracking** with stack traces
- **Performance monitoring** ready for integration
- **Real-time updates** via WebSocket

## 🚢 Deployment

### Vercel (Production)
The application is configured for Vercel deployment:

1. **Automatic deploys** from `main` branch
2. **Environment variables** configured in Vercel dashboard
3. **API routes** served as serverless functions
4. **Static assets** served from CDN

### Environment Variables (Production)
Configure these in your Vercel dashboard:
- `DATABASE_URL` - PostgreSQL connection string
- `REPLICA_DATABASE_URL` - MySQL replica connection
- `REDIS_URL` - Redis connection string
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `JWT_SECRET` - Secret for JWT token signing

## 📋 Contributing

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Follow naming conventions**: PascalCase components, camelCase functions
3. **Add tests**: Unit tests for services, integration tests for APIs
4. **Update documentation**: Keep README and comments current
5. **Submit PR**: With description of changes and testing notes

## 📄 License

This project is proprietary to Resolve My Claim Ltd.

---

**Questions?** Check the [build plan](./buildplan.md) for detailed implementation guidance. 