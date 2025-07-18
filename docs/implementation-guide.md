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

## 📅 **Implementation Timeline: 3 Weeks**

### **Week 1: Foundation (Days 1-7)**
- **Days 1-2**: MySQL connection and User Service
- **Days 3-4**: Basic data merging and testing
- **Days 5-7**: Cache layer and performance optimization

### **Week 2: CDC Implementation (Days 8-14)**
- **Days 8-9**: AWS DMS setup and configuration
- **Days 10-11**: SQS message queue and event processing
- **Days 12-14**: Real-time sync and error handling

### **Week 3: Production Ready (Days 15-21)**
- **Days 15-16**: Batch processing and housekeeping
- **Days 17-18**: Monitoring and alerting
- **Days 19-21**: Load testing and production deployment

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

## 📋 **Phase 3: Production Ready (Week 3)**

### **Step 6: Monitoring & Alerting**
**Complexity**: 🟡 Medium | **Location**: AWS + Dialler App | **Time**: 2 days

#### **What to Build**
1. **CloudWatch Metrics**
2. **Application Health Checks**
3. **Sync Performance Monitoring**
4. **Error Rate Alerts**

### **Step 7: Load Testing**
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
| Batch Jobs | 🟢 Low | 1 day | Dialler App |
| Monitoring | 🟡 Medium | 2 days | AWS + App |
| Testing | 🟡 Medium | 1 day | Test Env |

### **By Platform**

| Platform | Work Required | Complexity |
|----------|---------------|------------|
| **Main Laravel App** | ❌ **NONE** | No changes |
| **Dialler App** | ✅ **Medium** | 8 days work |
| **AWS Services** | ✅ **High** | 4 days setup |
| **Testing/Ops** | ✅ **Medium** | 2 days |

---

## 💰 **Cost Analysis**

### **Implementation Costs**
- **Development Time**: 3 weeks (1 developer)
- **AWS Setup**: 4 days (DevOps/Senior)
- **Testing**: 3 days (QA + Developer)

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

### **Phase 1 (Week 1)**
- [ ] Connect to MySQL replica successfully
- [ ] User service returns real user data
- [ ] Cache layer operational with proper TTLs
- [ ] Basic queue population works with real data

### **Phase 2 (Week 2)**  
- [ ] AWS DMS captures database changes
- [ ] SQS processes messages reliably
- [ ] Real-time updates appear within 3 seconds
- [ ] Error handling and retry mechanisms work

### **Phase 3 (Week 3)**
- [ ] System handles 50k+ users efficiently  
- [ ] Queue refresh completes under 5 seconds
- [ ] Monitoring and alerts operational
- [ ] Load testing passes with production data

### **Production Ready**
- [ ] All services deployed and monitored
- [ ] Documentation complete
- [ ] Team trained on operational procedures
- [ ] Rollback procedures tested and documented

---

**Next Steps**: Start with Phase 1, Step 1 - MySQL Database Connection setup. The foundation is solid, and this approach will scale beautifully! 🚀 