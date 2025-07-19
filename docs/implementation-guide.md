# 📋 Implementation Guide: Pre-call Validation + Hourly Refresh

This guide provides step-by-step instructions to implement the **pre-call validation + hourly refresh** approach for real-time data accuracy in the Next.js dialler system.

## 🎯 **Overview**

### **Current State**
- ✅ **Next.js Dialler App**: Running with tRPC, PostgreSQL, real data integration
- ✅ **MySQL Replica**: Connected and providing real user/claim data
- ✅ **Three Queue Types**: Unsigned users, outstanding requests, callbacks working
- ❌ **Queue Staleness**: Users may appear in queues after completing requirements

### **Target State**
- ✅ **Zero Wrong Calls**: Pre-call validation ensures 100% accuracy at contact moment
- ✅ **Automated Lead Discovery**: Hourly background jobs find new eligible users
- ✅ **Cost Effective**: £0-25/month additional infrastructure costs
- ✅ **Simple Operations**: Standard database queries and background jobs

---

## 📅 **Implementation Timeline: 1 Week**

### **Day 1-2: Pre-call Validation Service**
### **Day 3-4: Hourly Queue Population**
### **Day 5-7: Optimization & Monitoring**

---

## 📋 **Phase 1: Pre-call Validation (Days 1-2)**

### **Step 1: Pre-call Validation Service**
**Complexity**: 🟢 Low | **Location**: Dialler App | **Time**: 1 day

#### **What to Build**
```typescript
// modules/queue/services/pre-call-validation.service.ts - NEW FILE
import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import type { QueueType } from '../types/queue.types';

export interface PreCallValidationResult {
  isValid: boolean;
  reason?: string;
  currentQueueType?: QueueType | null;
  userStatus: {
    hasSignature: boolean;
    pendingRequirements: number;
    hasScheduledCallback: boolean;
    isEnabled: boolean;
  };
}

export class PreCallValidationService {
  /**
   * Validate user is still eligible for calling RIGHT NOW
   * This is called immediately before agent dials the number
   */
  async validateUserForCall(userId: number, expectedQueueType: QueueType): Promise<PreCallValidationResult> {
    try {
      // 1. Get current user state from MySQL replica (real-time)
      const userData = await replicaDb.user.findUnique({
        where: { id: BigInt(userId) },
        include: {
          claims: {
            include: {
              requirements: {
                where: { status: 'PENDING' }
              }
            }
          }
        }
      });

      if (!userData || !userData.is_enabled) {
        return {
          isValid: false,
          reason: 'User not found or disabled',
          userStatus: {
            hasSignature: false,
            pendingRequirements: 0,
            hasScheduledCallback: false,
            isEnabled: false
          }
        };
      }

      // 2. Check for scheduled callback from PostgreSQL
      const scheduledCallback = await prisma.callback.findFirst({
        where: {
          userId: BigInt(userId),
          status: 'pending',
          scheduledFor: { lte: new Date() }
        }
      });

      // 3. Determine current eligibility
      const hasSignature = userData.current_signature_file_id !== null;
      const pendingRequirements = userData.claims.reduce((acc, claim) => 
        acc + claim.requirements.length, 0
      );

      const userStatus = {
        hasSignature,
        pendingRequirements,
        hasScheduledCallback: !!scheduledCallback,
        isEnabled: userData.is_enabled
      };

      // 4. Determine current queue type
      let currentQueueType: QueueType | null = null;
      
      if (scheduledCallback) {
        currentQueueType = 'callback';
      } else if (!hasSignature) {
        currentQueueType = 'unsigned_users';
      } else if (pendingRequirements > 0) {
        currentQueueType = 'outstanding_requests';
      }

      // 5. Validate against expected queue type
      const isValid = currentQueueType === expectedQueueType;

      return {
        isValid,
        reason: isValid ? undefined : `User moved from ${expectedQueueType} to ${currentQueueType || 'none'}`,
        currentQueueType,
        userStatus
      };

    } catch (error) {
      console.error(`Pre-call validation failed for user ${userId}:`, error);
      return {
        isValid: false,
        reason: 'Validation error - please try another user',
        userStatus: {
          hasSignature: false,
          pendingRequirements: 0,
          hasScheduledCallback: false,
          isEnabled: false
        }
      };
    }
  }

  /**
   * Get the next valid user from queue for calling
   * Automatically skips invalid users until finding a valid one
   */
  async getNextValidUserForCall(queueType: QueueType): Promise<{
    userId: number;
    userContext: any;
    queuePosition: number;
  } | null> {
    
    const queueEntries = await prisma.callQueue.findMany({
      where: {
        queueType,
        status: 'pending'
      },
      orderBy: [
        { priorityScore: 'asc' },
        { queuePosition: 'asc' }
      ],
      take: 10 // Check up to 10 users to find a valid one
    });

    for (const entry of queueEntries) {
      const validation = await this.validateUserForCall(Number(entry.userId), queueType);
      
      if (validation.isValid) {
        // Get complete user context for the call
        const userService = new (await import('../../users/services/user.service')).UserService();
        const userContext = await userService.getUserCallContext(Number(entry.userId));
        
        if (userContext) {
          return {
            userId: Number(entry.userId),
            userContext,
            queuePosition: entry.queuePosition
          };
        }
      } else {
        // Mark this queue entry as invalid and remove it
        await prisma.callQueue.update({
          where: { id: entry.id },
          data: { 
            status: 'invalid',
            queueReason: validation.reason || 'No longer eligible'
          }
        });
      }
    }

    return null; // No valid users found in queue
  }
}
```

#### **Integration with Queue Service**
```typescript
// Add to modules/queue/services/queue.service.ts

import { PreCallValidationService } from './pre-call-validation.service';

export class QueueService {
  private preCallValidator = new PreCallValidationService();

  /**
   * Get next user for calling with real-time validation
   */
  async getNextUserForCall(queueType: QueueType): Promise<NextUserForCallResult | null> {
    const result = await this.preCallValidator.getNextValidUserForCall(queueType);
    
    if (!result) {
      // Queue is empty or no valid users - trigger refresh
      await this.refreshQueueByType(queueType);
      return await this.preCallValidator.getNextValidUserForCall(queueType);
    }

    return result;
  }
}
```

### **Step 2: Update Agent Interface**
**Complexity**: 🟢 Low | **Location**: Frontend Components | **Time**: 4 hours

#### **Update Queue Components**
```typescript
// app/queue/components/QueuePageTemplate.tsx - UPDATE

// Add pre-call validation to "Call Next User" button
const handleCallNextUser = async () => {
  setIsLoading(true);
  
  try {
    // Get next valid user with real-time validation
    const nextUser = await trpc.queue.getNextUserForCall.mutate({ queueType });
    
    if (!nextUser) {
      toast({
        title: "No eligible users",
        description: "Queue is empty or being refreshed. Please try again in a moment.",
        variant: "warning"
      });
      return;
    }

    // Start call session with validated user
    router.push(`/calls/${nextUser.sessionId}`);
    
  } catch (error) {
    toast({
      title: "Validation failed",
      description: "Unable to validate next user. Please try again.",
      variant: "destructive"
    });
  } finally {
    setIsLoading(false);
  }
};
```

---

## 🔄 **Phase 2: Hourly Queue Population (Days 3-4)**

### **Step 3: Background Job Service**
**Complexity**: 🟡 Medium | **Location**: Dialler App | **Time**: 1 day

#### **Create Queue Discovery Service**
```typescript
// services/queue/hourly-discovery.service.ts - NEW FILE
import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import { QueueService } from '@/modules/queue/services/queue.service';
import type { QueueType } from '@/modules/queue/types/queue.types';

export interface DiscoveryStats {
  queueType: QueueType;
  newUsersFound: number;
  newUsersAdded: number;
  duplicatesSkipped: number;
  invalidUsersSkipped: number;
}

export class HourlyDiscoveryService {
  private queueService = new QueueService();

  /**
   * Main discovery job - runs every hour
   */
  async discoverAndPopulateAllQueues(): Promise<DiscoveryStats[]> {
    console.log('🔍 Starting hourly queue discovery...');
    
    const results = await Promise.all([
      this.discoverUnsignedUsers(),
      this.discoverOutstandingRequests(),
      this.discoverDueCallbacks(),
      this.cleanupStaleQueueEntries()
    ]);

    const stats = results.slice(0, 3) as DiscoveryStats[];
    const cleanupCount = results[3] as number;

    console.log(`✅ Hourly discovery complete:`, {
      totalNewUsers: stats.reduce((acc, s) => acc + s.newUsersAdded, 0),
      cleanupCount,
      queueStats: stats
    });

    return stats;
  }

  /**
   * Find new users missing signatures
   */
  private async discoverUnsignedUsers(): Promise<DiscoveryStats> {
    const newUsers = await replicaDb.user.findMany({
      where: {
        is_enabled: true,
        status: { not: 'inactive' },
        current_signature_file_id: null,
        claims: {
          some: {
            status: { not: 'complete' }
          }
        }
      },
      include: {
        claims: {
          include: {
            requirements: true
          }
        }
      },
      take: 500 // Limit to prevent overwhelming the queue
    });

    return await this.addUsersToQueue(newUsers, 'unsigned_users');
  }

  /**
   * Find new users with pending requirements (have signatures)
   */
  private async discoverOutstandingRequests(): Promise<DiscoveryStats> {
    const newUsers = await replicaDb.user.findMany({
      where: {
        is_enabled: true,
        status: { not: 'inactive' },
        current_signature_file_id: { not: null },
        claims: {
          some: {
            requirements: {
              some: {
                status: 'PENDING'
              }
            }
          }
        }
      },
      include: {
        claims: {
          include: {
            requirements: {
              where: { status: 'PENDING' }
            }
          }
        }
      },
      take: 1000 // Higher limit as this is the largest queue
    });

    return await this.addUsersToQueue(newUsers, 'outstanding_requests');
  }

  /**
   * Find callbacks that are now due
   */
  private async discoverDueCallbacks(): Promise<DiscoveryStats> {
    const dueCallbacks = await prisma.callback.findMany({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: new Date()
        }
      }
    });

    const userIds = dueCallbacks.map(cb => Number(cb.userId));
    
    if (userIds.length === 0) {
      return {
        queueType: 'callback',
        newUsersFound: 0,
        newUsersAdded: 0,
        duplicatesSkipped: 0,
        invalidUsersSkipped: 0
      };
    }

    const users = await replicaDb.user.findMany({
      where: {
        id: { in: userIds.map(id => BigInt(id)) },
        is_enabled: true
      },
      include: {
        claims: {
          include: {
            requirements: true
          }
        }
      }
    });

    return await this.addUsersToQueue(users, 'callback');
  }

  /**
   * Add discovered users to appropriate queue
   */
  private async addUsersToQueue(users: any[], queueType: QueueType): Promise<DiscoveryStats> {
    let newUsersAdded = 0;
    let duplicatesSkipped = 0;
    let invalidUsersSkipped = 0;

    for (const user of users) {
      try {
        // Check if user already in this queue
        const existingEntry = await prisma.callQueue.findFirst({
          where: {
            userId: user.id,
            queueType,
            status: 'pending'
          }
        });

        if (existingEntry) {
          duplicatesSkipped++;
          continue;
        }

        // Validate user is still eligible
        const validation = await this.validateUserEligibility(Number(user.id), queueType);
        if (!validation.isEligible) {
          invalidUsersSkipped++;
          continue;
        }

        // Calculate priority score
        const priorityScore = await this.calculatePriorityScore(user, queueType);

        // Add to queue
        await prisma.callQueue.create({
          data: {
            userId: user.id,
            claimId: user.claims[0]?.id || null,
            queueType,
            priorityScore,
            queuePosition: newUsersAdded + 1,
            status: 'pending',
            queueReason: this.getQueueReason(queueType, user),
            availableFrom: new Date()
          }
        });

        newUsersAdded++;

      } catch (error) {
        console.error(`Failed to add user ${user.id} to ${queueType} queue:`, error);
        invalidUsersSkipped++;
      }
    }

    return {
      queueType,
      newUsersFound: users.length,
      newUsersAdded,
      duplicatesSkipped,
      invalidUsersSkipped
    };
  }

  /**
   * Remove stale queue entries (users no longer eligible)
   */
  private async cleanupStaleQueueEntries(): Promise<number> {
    const staleEntries = await prisma.callQueue.findMany({
      where: {
        status: 'pending',
        createdAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Older than 24 hours
        }
      },
      take: 100 // Process in batches
    });

    let cleanedUp = 0;

    for (const entry of staleEntries) {
      try {
        const validation = await this.validateUserEligibility(Number(entry.userId), entry.queueType);
        
        if (!validation.isEligible) {
          await prisma.callQueue.update({
            where: { id: entry.id },
            data: {
              status: 'invalid',
              queueReason: validation.reason || 'No longer eligible'
            }
          });
          cleanedUp++;
        }
      } catch (error) {
        console.error(`Failed to validate queue entry ${entry.id}:`, error);
      }
    }

    return cleanedUp;
  }
}
```

### **Step 4: Background Job Endpoints**
**Complexity**: 🟢 Low | **Location**: API Routes | **Time**: 2 hours

#### **Create Cron API Endpoints**
```typescript
// app/api/cron/discover-new-leads/route.ts - NEW FILE
import { NextResponse } from 'next/server';
import { HourlyDiscoveryService } from '@/services/queue/hourly-discovery.service';

export async function GET() {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting hourly lead discovery cron job...');
    
    const discoveryService = new HourlyDiscoveryService();
    const stats = await discoveryService.discoverAndPopulateAllQueues();
    
    const totalNewUsers = stats.reduce((acc, s) => acc + s.newUsersAdded, 0);
    
    console.log(`✅ Hourly discovery completed: ${totalNewUsers} new users added`);
    
    return NextResponse.json({
      success: true,
      stats,
      totalNewUsers,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Hourly discovery failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// For manual testing
export async function POST() {
  return GET();
}
```

#### **Update vercel.json for Cron Jobs**
```json
{
  "crons": [
    {
      "path": "/api/cron/discover-new-leads",
      "schedule": "0 * * * *"
    }
  ],
  "functions": {
    "app/api/cron/discover-new-leads/route.ts": {
      "maxDuration": 300
    }
  }
}
```

---

## ⚡ **Phase 3: Optimization & Monitoring (Days 5-7)**

### **Step 5: Performance Optimization**
**Complexity**: 🟡 Medium | **Location**: Various Services | **Time**: 1 day

#### **Optional Redis Integration**
```typescript
// lib/redis.ts - UPDATE cache keys for new approach

export const CACHE_KEYS = {
  // Longer TTLs since we validate before calling
  userContext: (userId: number) => `user:${userId}:context`,
  queueUsers: (queueType: string) => `queue:${queueType}:users`,
  discoveryStats: () => `discovery:stats:latest`,
  
  // New cache keys for pre-call validation
  userValidation: (userId: number) => `validation:${userId}`,
  queueHealth: (queueType: string) => `queue:${queueType}:health`
};

export const CACHE_TTL = {
  USER_CONTEXT: 1800,      // 30 min (longer since we validate before calling)
  QUEUE_USERS: 900,        // 15 min (can be stale since we validate)
  DISCOVERY_STATS: 3600,   // 1 hour
  USER_VALIDATION: 300,    // 5 min (cache recent validations)
  QUEUE_HEALTH: 600        // 10 min
};
```

### **Step 6: Monitoring & Health Checks**
**Complexity**: 🟢 Low | **Location**: API Routes | **Time**: 4 hours

#### **Queue Health Monitoring**
```typescript
// app/api/health/queues/route.ts - NEW FILE
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';

export async function GET() {
  try {
    const [queueStats, replicaHealth] = await Promise.all([
      // Get queue statistics
      Promise.all([
        prisma.callQueue.count({ where: { queueType: 'unsigned_users', status: 'pending' } }),
        prisma.callQueue.count({ where: { queueType: 'outstanding_requests', status: 'pending' } }),
        prisma.callQueue.count({ where: { queueType: 'callback', status: 'pending' } }),
        prisma.callQueue.count({ where: { status: 'invalid' } })
      ]),
      
      // Test MySQL replica connection
      replicaDb.user.count({ where: { is_enabled: true } })
    ]);

    const [unsignedCount, outstandingCount, callbackCount, invalidCount] = queueStats;

    return NextResponse.json({
      status: 'healthy',
      queues: {
        unsigned_users: unsignedCount,
        outstanding_requests: outstandingCount,
        callback: callbackCount,
        invalid_entries: invalidCount
      },
      replica: {
        connection: 'healthy',
        enabled_users: replicaHealth
      },
      last_check: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      last_check: new Date().toISOString()
    }, { status: 500 });
  }
}
```

---

## 📋 **Testing Strategy**

### **Manual Testing Checklist**
- [ ] **Pre-call validation**: Test with users who recently signed/completed requirements
- [ ] **Queue population**: Run hourly discovery manually and verify new users added
- [ ] **Agent workflow**: Ensure "Call Next User" always returns valid users
- [ ] **Queue cleanup**: Verify stale entries are removed
- [ ] **Performance**: Test queue loading times with/without Redis

### **API Testing**
```bash
# Test hourly discovery
curl -X POST "http://localhost:3000/api/cron/discover-new-leads" \
  -H "Authorization: Bearer your-cron-secret"

# Test queue health  
curl "http://localhost:3000/api/health/queues"

# Test pre-call validation
curl "http://localhost:3000/api/queue/validate-user" \
  -d '{"userId": 12345, "queueType": "unsigned_users"}'
```

---

## 🎯 **Success Metrics**

### **Week 1 Targets**
- [ ] **Zero wrong calls**: Pre-call validation prevents all incorrect contacts
- [ ] **Automated discovery**: Hourly jobs find 50+ new eligible users per hour
- [ ] **Queue health**: <5% invalid entries in queues at any time
- [ ] **Agent satisfaction**: Fast queue loading (<2 seconds) and reliable user data

### **Performance Benchmarks**
- **Pre-call validation**: <500ms per user
- **Hourly discovery**: <5 minutes total execution time
- **Queue loading**: <2 seconds with caching
- **User context**: <1 second load time

---

## 💰 **Cost Summary**

### **Implementation Costs**
- **Development Time**: 5-7 days (1 developer)
- **No AWS setup required**: Uses existing infrastructure
- **Simple deployment**: Standard Next.js deployment

### **Ongoing Monthly Costs**
- **Redis Cache (Optional)**: £25/month (Upstash basic tier)
- **Background Jobs**: £0 (Vercel Cron included)
- **Database Queries**: Minimal additional load on existing replica
- **Total**: £0-25/month

### **Business Benefits**
- **Perfect call accuracy**: Zero user complaints about wrong calls
- **Automated operations**: No manual queue management required
- **Fast implementation**: Working in 1 week vs 3 weeks for CDC
- **Easy maintenance**: Standard database operations and monitoring

---

## 🚀 **Next Steps After Implementation**

Once pre-call validation is working:

1. **Advanced Features**:
   - Lender-based priority scoring
   - User demographics integration
   - Agent specialization by queue type

2. **Performance Enhancements**:
   - Queue prefetching
   - Predictive user context loading
   - Smart cache warming

3. **Business Intelligence**:
   - Queue transition analytics
   - Discovery efficiency metrics
   - Agent productivity correlation

**This approach provides the perfect foundation for these advanced capabilities while maintaining simplicity and cost-effectiveness!** 🎉 