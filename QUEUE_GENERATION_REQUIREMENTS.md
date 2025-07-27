# 🏭 Queue Generation Requirements Analysis

**Current State**: We have individual `addUserToQueue()` methods but missing bulk population for separated tables

---

## ✅ **What We Currently Have**

### **1. Individual User Operations (✅ Working)**
```typescript
// UnsignedUsersQueueService
async addUserToQueue(data: UnsignedQueueData): Promise<UnsignedUsersQueueEntry>

// OutstandingRequestsQueueService  
async addUserToQueue(data: OutstandingQueueData): Promise<OutstandingRequestsQueueEntry>
```

### **2. Legacy Bulk Generation (✅ Working but for wrong table)**
```typescript
// QueueGenerationService (LEGACY)
async generateQueue(queueType: QueueType) {
  // Reads from user_call_scores
  // Populates call_queue table (LEGACY)
}
```

---

## ❌ **What We Need to Create**

### **1. UnsignedUsersQueueGenerationService**
```typescript
export class UnsignedUsersQueueGenerationService {
  
  /**
   * Bulk populate unsigned_users_queue from user_call_scores
   */
  async populateUnsignedUsersQueue(): Promise<QueueGenerationResult> {
    // 1. Clear existing queue entries
    await this.clearExistingQueue();
    
    // 2. Get users from user_call_scores WHERE currentQueueType = 'unsigned_users'
    const eligibleUsers = await this.getEligibleUsersFromScores();
    
    // 3. Bulk populate unsignedUsersQueue table
    const populated = await this.bulkPopulateQueue(eligibleUsers);
    
    return { queueType: 'unsigned_users', populated };
  }
  
  private async getEligibleUsersFromScores() {
    return await prisma.userCallScore.findMany({
      where: {
        currentQueueType: 'unsigned_users',
        isActive: true,
        nextCallAfter: { lte: new Date() }
      },
      orderBy: [
        { currentScore: 'asc' },    // Lower score = higher priority
        { createdAt: 'asc' }        // FIFO for same score
      ],
      take: 100 // Queue size limit
    });
  }
  
  private async bulkPopulateQueue(users: UserCallScore[]) {
    let populated = 0;
    
    for (const user of users) {
      try {
        await prisma.unsignedUsersQueue.create({
          data: {
            userId: user.userId,
            priorityScore: user.currentScore,
            status: 'pending',
            queueReason: 'Missing signature',
            availableFrom: new Date()
          }
        });
        populated++;
      } catch (error) {
        // Log error but continue
      }
    }
    
    return populated;
  }
}
```

### **2. OutstandingRequestsQueueGenerationService**
```typescript
export class OutstandingRequestsQueueGenerationService {
  
  /**
   * Bulk populate outstanding_requests_queue from user_call_scores
   */
  async populateOutstandingRequestsQueue(): Promise<QueueGenerationResult> {
    // 1. Clear existing queue entries
    await this.clearExistingQueue();
    
    // 2. Get users from user_call_scores WHERE currentQueueType = 'outstanding_requests'
    const eligibleUsers = await this.getEligibleUsersFromScores();
    
    // 3. Bulk populate outstandingRequestsQueue table
    const populated = await this.bulkPopulateQueue(eligibleUsers);
    
    return { queueType: 'outstanding_requests', populated };
  }
  
  private async getEligibleUsersFromScores() {
    return await prisma.userCallScore.findMany({
      where: {
        currentQueueType: 'outstanding_requests',
        isActive: true,
        nextCallAfter: { lte: new Date() }
      },
      orderBy: [
        { currentScore: 'asc' },    // Lower score = higher priority
        { createdAt: 'asc' }        // FIFO for same score
      ],
      take: 100 // Queue size limit
    });
  }
  
  private async bulkPopulateQueue(users: UserCallScore[]) {
    let populated = 0;
    
    for (const user of users) {
      try {
        await prisma.outstandingRequestsQueue.create({
          data: {
            userId: user.userId,
            priorityScore: user.currentScore,
            status: 'pending',
            queueReason: 'Pending document requirements',
            availableFrom: new Date(),
            // Additional fields specific to outstanding requests
            requirementTypes: ['document'], // Default
            totalRequirements: 1,
            pendingRequirements: 1,
            completedRequirements: 0,
            oldestRequirementDate: new Date()
          }
        });
        populated++;
      } catch (error) {
        // Log error but continue
      }
    }
    
    return populated;
  }
}
```

### **3. Combined Queue Population Service**
```typescript
export class SeparatedQueuePopulationService {
  private unsignedGenerator: UnsignedUsersQueueGenerationService;
  private outstandingGenerator: OutstandingRequestsQueueGenerationService;
  
  constructor() {
    this.unsignedGenerator = new UnsignedUsersQueueGenerationService();
    this.outstandingGenerator = new OutstandingRequestsQueueGenerationService();
  }
  
  /**
   * Populate both separated queues
   */
  async populateAllQueues(): Promise<QueueGenerationResult[]> {
    const results: QueueGenerationResult[] = [];
    
    // Populate unsigned users queue
    const unsignedResult = await this.unsignedGenerator.populateUnsignedUsersQueue();
    results.push(unsignedResult);
    
    // Populate outstanding requests queue
    const outstandingResult = await this.outstandingGenerator.populateOutstandingRequestsQueue();
    results.push(outstandingResult);
    
    return results;
  }
}
```

---

## 🎯 **Implementation Plan**

### **Step 1: Create Individual Generation Services**
- [ ] Create `UnsignedUsersQueueGenerationService`
- [ ] Create `OutstandingRequestsQueueGenerationService`  
- [ ] Each reads from their specific `currentQueueType` in `user_call_scores`

### **Step 2: Create Combined Service**
- [ ] Create `SeparatedQueuePopulationService` 
- [ ] Combines both individual services
- [ ] Provides single interface for cron jobs

### **Step 3: Update Cron Jobs**
- [ ] Create new cron endpoint: `app/api/cron/populate-separated-queues/route.ts`
- [ ] Use `SeparatedQueuePopulationService.populateAllQueues()`
- [ ] Replace legacy queue population

### **Step 4: Migration Integration**
- [ ] Use these services after database migration
- [ ] Replace legacy `QueueGenerationService` usage
- [ ] Test with feature flags

---

## 🔄 **Data Flow**

### **Current (Legacy)**:
```
user_call_scores → QueueGenerationService → call_queue (unified table)
```

### **New (Separated)**:
```
user_call_scores (currentQueueType='unsigned_users') → UnsignedUsersQueueGeneration → unsignedUsersQueue
user_call_scores (currentQueueType='outstanding_requests') → OutstandingRequestsQueueGeneration → outstandingRequestsQueue
```

---

## ✅ **Benefits**

1. **Queue-Specific Logic**: Each generator handles its queue's specific requirements
2. **Clean Separation**: No mixed queue types in single table
3. **Performance**: Optimized queries per queue type
4. **Maintainability**: Clear responsibility per service
5. **Scalability**: Independent scaling per queue type

**Assessment**: We need to create these 2 queue generation services to complete the migration! 