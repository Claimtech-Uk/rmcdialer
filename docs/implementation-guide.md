# 📋 Implementation Guide: CDC + Batch Hybrid Data Sync

This guide provides step-by-step instructions to implement the CDC + Batch hybrid approach for real-time data synchronization between the main Laravel application and the Next.js dialler system.

## 🎯 **Overview**

### **Current State**
- ✅ **Next.js Dialler App**: Running with tRPC, PostgreSQL, mock data
- ✅ **AWS RDS Replica**: MySQL read replica of main database available
- ❌ **Data Integration**: Not connected - using mock data for development

### **Target State**
- ✅ **Real-time Sync**: Changes from main app appear in dialler within 3 seconds
- ✅ **Scale Ready**: Handles 50k+ users, 150k+ claims efficiently  
- ✅ **Cost Optimized**: 60% reduction in database query costs
- ✅ **Production Ready**: Monitoring, error handling, failover mechanisms

---

## 📅 **Implementation Timeline: 4 Weeks**

### **Week 1: Foundation (Days 1-7)**
- **Days 1-2**: MySQL connection and User Service
- **Days 3-4**: Basic data merging and testing
- **Days 5-7**: Cache layer and performance optimization

### **Week 2: CDC Implementation (Days 8-14)**
- **Days 8-9**: AWS DMS setup and configuration
- **Days 10-11**: SQS message queue and event processing
- **Days 12-14**: Real-time sync and error handling

### **Week 3: Scoring System (Days 15-21)**
- **Days 15-16**: Scoring module architecture and setup
- **Days 17-18**: Priority scoring rules and lender logic
- **Days 19-21**: User demographics and historical data integration

### **Week 4: Production Ready (Days 22-28)**
- **Days 22-23**: Batch processing and housekeeping
- **Days 24-25**: Monitoring and alerting
- **Days 26-28**: Load testing and production deployment

---

## 📋 **Phase 1: Foundation Setup (Week 1)**

### **Step 1: MySQL Database Connection** 
**Complexity**: 🟡 Medium | **Location**: Dialler App | **Time**: 1 day

#### **What to Build**
```typescript
// lib/mysql.ts - NEW FILE
import { PrismaClient } from '@prisma/mysql-client'

const globalForReplicaDb = globalThis as unknown as {
  replicaDb: PrismaClient | undefined
}

export const replicaDb = globalForReplicaDb.replicaDb ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.REPLICA_DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error']
})

if (process.env.NODE_ENV !== 'production') {
  globalForReplicaDb.replicaDb = replicaDb
}
```

#### **Tasks**
1. **Create MySQL Prisma Schema**
   ```bash
   # Create new schema file
   touch prisma/replica.prisma
   ```

2. **Define MySQL Schema** (based on main app tables)
   ```prisma
   // prisma/replica.prisma
   generator client {
     provider = "prisma-client-js"
     output   = "./generated/mysql-client"
   }

   datasource db {
     provider = "mysql"
     url      = env("REPLICA_DATABASE_URL")
   }

   model User {
     id                      BigInt   @id
     first_name              String?  @map("first_name")
     last_name               String?  @map("last_name")
     email                   String?
     phone_number            String?  @map("phone_number")
     status                  String?
     is_enabled              Boolean? @map("is_enabled")
     introducer              String?
     solicitor               String?
     current_user_address_id String?  @map("current_user_address_id")
     last_login              DateTime? @map("last_login")
     created_at              DateTime @map("created_at")
     updated_at              DateTime @map("updated_at")

     claims                  Claim[]
     address                 UserAddress? @relation(fields: [current_user_address_id], references: [id])

     @@map("users")
   }

   model Claim {
     id                      BigInt    @id
     user_id                 BigInt    @map("user_id")
     type                    String?
     status                  String?
     lender                  String?
     solicitor               String?
     client_last_updated_at  DateTime? @map("client_last_updated_at")
     created_at              DateTime  @map("created_at")
     updated_at              DateTime  @map("updated_at")

     user                    User      @relation(fields: [user_id], references: [id])
     requirements            ClaimRequirement[]
     vehiclePackages         ClaimVehiclePackage[]

     @@map("claims")
   }

   // ... additional models for requirements, addresses, vehicle packages
   ```

3. **Generate MySQL Client**
   ```bash
   npx prisma generate --schema=prisma/replica.prisma
   ```

4. **Test Connection**
   ```typescript
   // Test connection to replica database
   await replicaDb.user.findFirst()
   ```

#### **Environment Variables**
```env
REPLICA_DATABASE_URL="mysql://readonly:password@rmc-dialer-replica.cluster-xyz.eu-west-1.rds.amazonaws.com:3306/main_database"
```

---

### **Step 2: User Service Implementation**
**Complexity**: 🟡 Medium | **Location**: Dialler App | **Time**: 1 day

#### **What to Build**
```typescript
// modules/users/services/user.service.ts - NEW FILE
import { replicaDb } from '@/lib/mysql'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import type { UserCallContext, ClaimContext } from '../types/user.types'

export class UserService {
  constructor(
    private dependencies: {
      replicaDb: typeof replicaDb
      prisma: typeof prisma
      redis: typeof redis
      logger: any
    }
  ) {}

  async getUserCallContext(userId: number): Promise<UserCallContext> {
    // 1. Check cache first
    const cacheKey = `user:${userId}:context`
    const cached = await this.dependencies.redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    // 2. Fetch from both databases in parallel
    const [userData, callScore] = await Promise.all([
      this.getUserDataFromReplica(userId),
      this.getCallScoreFromDialler(userId)
    ])

    // 3. Merge data
    const context = this.mergeUserContext(userData, callScore)

    // 4. Cache result (15 minute TTL)
    await this.dependencies.redis.setex(cacheKey, 900, JSON.stringify(context))

    return context
  }

  private async getUserDataFromReplica(userId: number) {
    return await this.dependencies.replicaDb.user.findUnique({
      where: { id: BigInt(userId) },
      include: {
        claims: {
          include: {
            requirements: {
              where: { status: 'PENDING' }
            },
            vehiclePackages: true
          }
        },
        address: true
      }
    })
  }

  private async getCallScoreFromDialler(userId: number) {
    return await this.dependencies.prisma.userCallScore.findUnique({
      where: { userId: BigInt(userId) }
    })
  }

  private mergeUserContext(userData: any, callScore: any): UserCallContext {
    if (!userData) return null

    return {
      user: {
        id: Number(userData.id),
        firstName: userData.first_name,
        lastName: userData.last_name,
        phoneNumber: userData.phone_number,
        email: userData.email,
        status: userData.status,
        isEnabled: userData.is_enabled,
        address: userData.address ? {
          fullAddress: userData.address.full_address,
          postCode: userData.address.post_code,
          county: userData.address.county
        } : null
      },
      claims: userData.claims.map(claim => ({
        id: Number(claim.id),
        type: claim.type,
        status: claim.status,
        lender: claim.lender,
        solicitor: claim.solicitor,
        lastUpdated: claim.client_last_updated_at,
        requirements: claim.requirements.map(req => ({
          id: req.id,
          type: req.type,
          status: req.status,
          reason: req.claim_requirement_reason
        })),
        vehiclePackages: claim.vehiclePackages.map(pkg => ({
          registration: pkg.vehicle_registration,
          make: pkg.vehicle_make,
          model: pkg.vehicle_model,
          dealership: pkg.dealership_name,
          monthlyPayment: pkg.monthly_payment
        }))
      })),
      callScore: callScore ? {
        currentScore: callScore.currentScore,
        totalAttempts: callScore.totalAttempts,
        lastOutcome: callScore.lastOutcome,
        nextCallAfter: callScore.nextCallAfter
      } : null
    }
  }
}
```

#### **Tasks**
1. **Create User Types**
2. **Implement UserService**
3. **Add User Router to tRPC**
4. **Test with Real Data**

---

### **Step 3: Cache Layer & Performance**
**Complexity**: 🟢 Low | **Location**: Dialler App | **Time**: 1 day

#### **What to Build**
```typescript
// lib/redis.ts - UPDATE EXISTING
import Redis from 'redis'

export const redis = Redis.createClient({
  url: process.env.REDIS_URL,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis server refused connection')
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted')
    }
    if (options.attempt > 10) {
      return undefined
    }
    return Math.min(options.attempt * 100, 3000)
  }
})

// Cache key patterns
export const CACHE_KEYS = {
  user: (id: number) => `user:${id}:context`,
  eligibleUsers: () => 'eligible_users',
  queue: (status: string) => `queue:${status}`,
  userClaims: (userId: number) => `user:${userId}:claims`
} as const

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  USER_CONTEXT: 900,      // 15 minutes
  ELIGIBLE_USERS: 300,    // 5 minutes
  QUEUE_DATA: 300,        // 5 minutes
  STATIC_DATA: 3600       // 1 hour
} as const
```

---

## 📋 **Phase 2: CDC Implementation (Week 2)**

### **Step 4: AWS DMS Setup**
**Complexity**: 🔴 High | **Location**: AWS Console | **Time**: 2 days

#### **AWS Resources to Create**

1. **DMS Replication Instance**
   ```yaml
   # AWS CLI or CloudFormation
   ReplicationInstance:
     Type: AWS::DMS::ReplicationInstance
     Properties:
       ReplicationInstanceClass: dms.t3.micro
       ReplicationInstanceIdentifier: rmc-dialler-dms
       VpcSecurityGroupIds:
         - !Ref DMSSecurityGroup
   ```

2. **Source Endpoint (MySQL)**
   ```yaml
   SourceEndpoint:
     Type: AWS::DMS::Endpoint
     Properties:
       EndpointType: source
       EngineName: mysql
       ServerName: rmc-main-database.cluster-xyz.eu-west-1.rds.amazonaws.com
       Port: 3306
       Username: dms_user
       Password: !Ref DMSPassword
   ```

3. **Target Endpoint (SQS)**
   ```yaml
   TargetEndpoint:
     Type: AWS::DMS::Endpoint
     Properties:
       EndpointType: target
       EngineName: kinesis
       KinesisSettings:
         MessageFormat: json
         StreamArn: !GetAtt UserChangesQueue.Arn
   ```

#### **Tasks**
1. **Create DMS IAM Roles**
2. **Setup VPC Security Groups**
3. **Create DMS Endpoints**
4. **Test Connection**

⚠️ **Platform Work Required**: AWS Console configuration (no code changes to main app)

---

### **Step 5: SQS Message Processing**
**Complexity**: 🟡 Medium | **Location**: Dialler App | **Time**: 2 days

#### **What to Build**
```typescript
// services/sync/cdc-processor.ts - NEW FILE
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs'
import { UserService } from '@/modules/users'

export class CDCProcessor {
  private sqsClient: SQSClient
  private userService: UserService

  constructor() {
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION })
    this.userService = new UserService(/* dependencies */)
  }

  async startProcessing() {
    while (true) {
      try {
        const messages = await this.receiveMessages()
        
        if (messages.length > 0) {
          await this.processMessages(messages)
        }
        
        await this.sleep(1000) // 1 second polling
      } catch (error) {
        console.error('CDC processing error:', error)
        await this.sleep(5000) // 5 second delay on error
      }
    }
  }

  private async receiveMessages() {
    const command = new ReceiveMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20 // Long polling
    })

    const response = await this.sqsClient.send(command)
    return response.Messages || []
  }

  private async processMessages(messages: any[]) {
    await Promise.all(messages.map(msg => this.processMessage(msg)))
  }

  private async processMessage(message: any) {
    try {
      const changeEvent = JSON.parse(message.Body)
      
      switch (changeEvent.eventName) {
        case 'INSERT':
        case 'UPDATE':
          await this.handleUserChange(changeEvent)
          break
        case 'DELETE':
          await this.handleUserDeletion(changeEvent)
          break
      }

      // Delete message after successful processing
      await this.deleteMessage(message.ReceiptHandle)
      
    } catch (error) {
      console.error('Message processing error:', error)
      // Let message return to queue for retry
    }
  }

  private async handleUserChange(event: any) {
    const { tableName, dynamodb } = event
    
    if (tableName === 'users') {
      const userId = dynamodb.NewImage?.id?.N
      if (userId) {
        // Invalidate cache for this user
        await this.userService.invalidateUserCache(parseInt(userId))
        
        // Check if user should be added to queue
        await this.userService.checkQueueEligibility(parseInt(userId))
      }
    }
  }
}
```

#### **Tasks**
1. **Setup AWS SDK**
2. **Create SQS Client**
3. **Implement Message Processing**
4. **Add Error Handling**
5. **Create Background Service**

---

## 📋 **Phase 3: Scoring System Implementation (Week 3)**

### **Step 8: Scoring Module Architecture**
**Complexity**: 🟡 Medium | **Location**: Dialler App | **Time**: 2 days

#### **What to Build**
```typescript
// modules/scoring/services/priority-scoring.service.ts - NEW FILE
import { CallService } from '@/modules/calls'
import { UserService } from '@/modules/users'
import type { ScoringContext, PriorityScore, ScoreExplanation } from '../types/scoring.types'

export class PriorityScoringService {
  constructor(
    private dependencies: {
      callService: CallService
      userService: UserService
      redis: any
      logger: any
    }
  ) {}

  async calculatePriority(context: ScoringContext): Promise<PriorityScore> {
    // 1. Apply lender scoring rules
    let score = await this.applyLenderRules(context)

    // 2. Factor in user age demographics  
    score += await this.applyAgeRules(context)

    // 3. Apply time-based scoring
    score += await this.applyTimeRules(context)

    // 4. Apply disposition history
    score += await this.applyDispositionRules(context)

    return {
      finalScore: Math.max(0, score),
      factors: this.getScoreFactors(context),
      nextCallAfter: this.calculateNextCallTime(context),
      queueType: this.determineQueueType(context)
    }
  }

  async explainScore(userId: number): Promise<ScoreExplanation> {
    // Provides detailed breakdown of score calculation for debugging
  }

  private async applyLenderRules(context: ScoringContext): Promise<number> {
    // High-value lenders get priority boost
    const lenderPriorities = {
      'santander': -20,     // Higher priority
      'lloyds': -15,
      'barclays': -15,
      'hsbc': -10,
      'nationwide': -10,
      'default': 0
    }
    
    return lenderPriorities[context.claim.lender.toLowerCase()] || 0
  }

  private async applyAgeRules(context: ScoringContext): Promise<number> {
    // Older users typically get higher priority
    const userAge = this.calculateAge(context.user.dateOfBirth)
    
    if (userAge >= 65) return -15      // Elderly - highest priority
    if (userAge >= 45) return -10      // Middle age - medium priority  
    if (userAge >= 25) return -5       // Adult - slight priority
    return 0                           // Young adult - standard
  }

  private async applyTimeRules(context: ScoringContext): Promise<number> {
    let timeScore = 0
    
    // Age since claim created
    const daysSinceCreated = this.daysBetween(context.claim.createdAt, new Date())
    timeScore += Math.min(daysSinceCreated * 1.5, 30) // Max 30 points
    
    // Age since last contact
    const daysSinceContact = context.lastContact 
      ? this.daysBetween(context.lastContact.date, new Date())
      : 30 // No contact = 30 days
    timeScore += Math.min(daysSinceContact * 2, 60) // Max 60 points
    
    return timeScore
  }

  private async applyDispositionRules(context: ScoringContext): Promise<number> {
    if (!context.callHistory?.length) return 0
    
    const lastOutcome = context.callHistory[0].outcome
    const outcomeScores = {
      'not_interested': 100,     // Very low priority
      'wrong_number': 80,        // Low priority  
      'no_answer': 10,           // Slight penalty
      'busy': 5,                 // Minimal penalty
      'callback_requested': -25,  // High priority
      'contacted': -5,           // Slight boost for follow-up
      'left_voicemail': 15       // Medium penalty
    }
    
    let dispositionScore = outcomeScores[lastOutcome] || 0
    
    // Multiple failed attempts penalty
    const failedAttempts = context.callHistory.filter(
      call => ['no_answer', 'busy', 'failed'].includes(call.outcome)
    ).length
    
    dispositionScore += failedAttempts * 8
    
    return dispositionScore
  }
}
```

#### **Tasks**
1. **Create Scoring Module Structure**
   ```bash
   mkdir -p modules/scoring/{services,types,utils}
   ```

2. **Define Scoring Types**
   ```typescript
   // modules/scoring/types/scoring.types.ts
   export interface ScoringContext {
     user: {
       id: number
       dateOfBirth: Date
       demographics: UserDemographics
     }
     claim: {
       id: number
       lender: string
       value: number
       createdAt: Date
       type: string
     }
     callHistory: CallHistoryItem[]
     lastContact?: ContactEvent
     currentTime: Date
   }

   export interface PriorityScore {
     finalScore: number
     factors: ScoreFactor[]
     nextCallAfter: Date
     queueType: QueueType
   }

   export interface ScoreExplanation {
     userId: number
     totalScore: number
     breakdown: {
       lenderScore: number
       ageScore: number  
       timeScore: number
       dispositionScore: number
     }
     factors: string[]
     recommendations: string[]
   }
   ```

3. **Integrate with Queue Service**
4. **Add Comprehensive Testing**

---

### **Step 9: Advanced Scoring Rules**
**Complexity**: 🟡 Medium | **Location**: Dialler App | **Time**: 2 days

#### **What to Build**
- **Lender Priority Matrix**: Configurable scoring rules per lender
- **Demographic Factors**: Age, location, claim type interactions
- **Seasonal Adjustments**: Holiday periods, month-end priorities
- **Machine Learning Hooks**: Preparation for AI-driven scoring

#### **Tasks**
1. **Create Scoring Rules Engine**
2. **Add Configuration Management**
3. **Implement A/B Testing Framework** 
4. **Add Performance Monitoring**

---

## 📋 **Phase 4: Production Ready (Week 4)**

### **Step 10: Monitoring & Alerting**
**Complexity**: 🟡 Medium | **Location**: AWS + Dialler App | **Time**: 2 days

#### **What to Build**
1. **CloudWatch Metrics**
2. **Application Health Checks**
3. **Sync Performance Monitoring**
4. **Error Rate Alerts**

### **Step 11: Load Testing**
**Complexity**: 🟡 Medium | **Location**: Test Environment | **Time**: 1 day

#### **What to Test**
- 50k user context requests
- Queue refresh with 1000+ entries
- CDC processing under load
- Cache performance

---

## 🏗️ **Complexity Breakdown**

### **By Component**

| Component | Complexity | Time | Platform Work |
|-----------|------------|------|---------------|
| MySQL Connection | 🟡 Medium | 1 day | Dialler App |
| User Service | 🟡 Medium | 1 day | Dialler App |
| Cache Layer | 🟢 Low | 1 day | Dialler App |
| AWS DMS Setup | 🔴 High | 2 days | AWS Console |
| SQS Processing | 🟡 Medium | 2 days | Dialler App |
| **Scoring Module** | 🟡 **Medium** | **2 days** | **Dialler App** |
| **Advanced Scoring** | 🟡 **Medium** | **2 days** | **Dialler App** |
| Batch Jobs | 🟢 Low | 1 day | Dialler App |
| Monitoring | 🟡 Medium | 2 days | AWS + App |
| Testing | 🟡 Medium | 1 day | Test Env |

### **By Platform**

| Platform | Work Required | Complexity |
|----------|---------------|------------|
| **Main Laravel App** | ❌ **NONE** | No changes |
| **Dialler App** | ✅ **Medium** | **12 days work** |
| **AWS Services** | ✅ **High** | 4 days setup |
| **Testing/Ops** | ✅ **Medium** | 2 days |

---

## 💰 **Cost Analysis**

### **Implementation Costs**
- **Development Time**: 4 weeks (1 developer)
- **AWS Setup**: 4 days (DevOps/Senior)
- **Testing**: 4 days (QA + Developer)

### **Ongoing Monthly Costs**
- **AWS DMS**: £75/month
- **SQS Messages**: £15/month  
- **Redis Cache**: £50/month
- **CloudWatch**: £10/month
- **Total**: £150/month

### **Cost Savings**
- **Database Query Reduction**: £180/month
- **Performance Gains**: Reduced server costs
- **Net Benefit**: £30/month + massive performance improvement

---

## ⚠️ **Risks & Mitigation**

### **High Risk**
- **AWS DMS Complexity**: Requires AWS expertise
  - *Mitigation*: Start with AWS support, detailed documentation
  
- **Data Consistency**: Race conditions between systems
  - *Mitigation*: Proper cache invalidation, eventual consistency design

### **Medium Risk**  
- **Message Processing Failures**: SQS message loss
  - *Mitigation*: Dead letter queues, retry mechanisms
  
- **Cache Strategy**: Cache invalidation complexity
  - *Mitigation*: Short TTLs, multiple invalidation triggers

### **Low Risk**
- **Performance**: System performance under load
  - *Mitigation*: Load testing, gradual rollout

---

## ✅ **Success Criteria**

### **Phase 1 (Week 1) - Foundation + Dual Queue System**
- [x] Connect to MySQL replica successfully
- [x] User service returns real user data
- [x] Cache layer operational with proper TTLs
- [x] **NEW**: Dual queue system implemented with three queue types
- [x] **NEW**: Queue type determination logic for unsigned users vs outstanding requests
- [x] **NEW**: Separate API endpoints for each queue type
- [ ] Queue population works with real production data
- [ ] Queue UI updated to support multiple queue types

### **Phase 2 (Week 2) - Real-time Integration**  
- [ ] AWS DMS captures database changes
- [ ] SQS processes messages reliably
- [ ] Real-time updates appear within 3 seconds
- [ ] Error handling and retry mechanisms work
- [ ] **NEW**: Real-time queue updates when users move between queues
- [ ] **NEW**: Signature status changes trigger queue reassignment

### **Phase 3 (Week 3) - Scoring System**
- [ ] Scoring module architecture implemented and tested
- [ ] Lender-based priority scoring operational (Santander, Lloyds, etc.)
- [ ] User age demographics factored into scoring
- [ ] Historical disposition data influences priority
- [ ] Time-based scoring (claim age, contact frequency) working
- [ ] Queue service integration with scoring complete
- [ ] Score explanation and debugging tools functional
- [ ] A/B testing framework for scoring rules ready

### **Phase 4 (Week 4) - Production Scale**
- [ ] System handles 50k+ users efficiently across all queue types
- [ ] Each queue type refreshes under 5 seconds
- [ ] **NEW**: Agent specialization workflow operational
- [ ] **NEW**: Cross-queue analytics and reporting
- [ ] Monitoring and alerts operational
- [ ] Load testing passes with production data

### **Production Ready - Dual Queue System + Scoring**
- [ ] All three queues (unsigned, outstanding requests, callbacks) operational
- [ ] **NEW**: Advanced priority scoring system deployed in production
- [ ] **NEW**: Lender-specific rules validated with business stakeholders
- [ ] **NEW**: Scoring performance metrics monitored and optimized
- [ ] Agent training completed for queue specialization
- [ ] Queue-specific performance metrics tracked
- [ ] Cross-queue movement logic verified
- [ ] Documentation updated for operational procedures
- [ ] Rollback procedures tested and documented

### **Queue System Verification Checklist**
- [ ] **Unsigned Users Queue**: Shows only users with `current_signature_file_id IS NULL`
- [ ] **Outstanding Requests Queue**: Shows only users with pending requirements AND signatures
- [ ] **Callbacks Queue**: Shows users with scheduled callbacks due now
- [ ] **No Queue Overlap**: Users appear in only one queue at a time
- [ ] **Real-time Movement**: Users move between queues when status changes
- [ ] **Agent Experience**: Agents can select and work from one queue type

---

**Next Steps**: Start with Phase 1, Step 1 - MySQL Database Connection setup. The foundation is solid, and this approach will scale beautifully! 🚀 