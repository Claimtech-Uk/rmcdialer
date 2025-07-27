# 🧹 Queue Services Cleanup Plan

**Objective**: Remove unnecessary legacy services and fix queue logic to be truly simple storage/retrieval  
**Key Insight**: Queues should only query `user_call_scores` + `callback` tables - no business logic, no replica queries

---

## 🔍 **Current Service Analysis**

### **✅ KEEP - Core Pipeline Services**
| Service | Purpose | Why Keep |
|---------|---------|----------|
| `lead-discovery-optimized.service.ts` | Finds new users from MySQL replica | ✅ Applies business logic to determine queue type |
| `lead-scoring.service.ts` | Assigns priority scores | ✅ Determines user priority within queue type |
| `daily-aging.service.ts` | Ages scores daily | ✅ Prevents score stagnation |
| `queue-generation.service.ts` | Populates queues from scores | ✅ Bridge between scoring and queues |
| `pre-call-validation.service.ts` | Real-time validation before calls | ✅ Final safety check (but needs splitting) |

### **🗑️ REMOVE - Redundant Legacy Services**
| Service | Purpose | Why Remove |
|---------|---------|------------|
| `queue.service.ts` | Legacy unified queue service | ❌ Replaced by queue-adapter.service.ts |
| `lead-scoring-simple.service.ts` | Alternative scoring | ❌ Redundant with main scoring service |

### **🔧 FIX - New Queue Services (Remove Business Logic)**
| Service | Current Problem | Fix Required |
|---------|----------------|--------------|
| `unsigned-users-queue.service.ts` | Checks signature criteria, queries replica | ❌ Should only query `user_call_scores` + `callback` |
| `outstanding-requests-queue.service.ts` | Checks requirements criteria, queries replica | ❌ Should only query `user_call_scores` + `callback` |
| `queue-adapter.service.ts` | Has legacy fallback complexity | ❌ Simplify routing logic |

---

## 🎯 **Corrected Queue Logic**

### **What Queues Should Actually Do:**
```typescript
// SIMPLE queue operations - NO business logic
interface CorrectQueueService {
  // 1. Get next user from user_call_scores (by queue type) + callbacks
  getNextUser(): Promise<User | null>
  
  // 2. Add user to queue (from cron population only)
  addUserToQueue(userData): Promise<void>
  
  // 3. Remove user from queue (from pre-call validation only)
  removeUserFromQueue(userId): Promise<boolean>
  
  // 4. Stats for monitoring
  getQueueStats(): Promise<QueueStats>
}
```

### **Where Business Logic SHOULD Be Applied:**
```
MySQL Replica → lead-discovery → determines queue type → user_call_scores
                                                       ↓
user_call_scores → queue-generation → populates queue tables
                                   ↓
queue tables → queue services → DUMB retrieval by priority score
                              ↓
pre-call-validation → validates user before call
```

### **Fixed Query Logic:**
```typescript
// ✅ CORRECT: Only query user_call_scores + callback
async getNextUser(): Promise<User | null> {
  // 1. Check callbacks first
  const callback = await prisma.callback.findFirst({
    where: { status: 'pending', scheduledFor: { lte: new Date() } }
  });
  if (callback) return callback;
  
  // 2. Get from user_call_scores by queue type
  const scored = await prisma.userCallScore.findFirst({
    where: { queueType: this.queueType }, // Queue type already determined!
    orderBy: { currentScore: 'asc' } // Lower = higher priority
  });
  
  return scored;
}

// ❌ WRONG: Don't check signature status or requirements
// ❌ WRONG: Don't query MySQL replica  
// ❌ WRONG: Don't apply business criteria
```

---

## 🗑️ **Services Removal Plan**

### **Phase 1: Remove Redundant Legacy Services**

#### **1.1 Remove `queue.service.ts`** 
- **Lines**: 494 lines
- **Reason**: Replaced by `queue-adapter.service.ts`
- **Migration**: Update any imports to use `queue-adapter.service.ts`
- **Safety**: Keep file temporarily, rename to `.backup` until migration complete

#### **1.2 Remove `lead-scoring-simple.service.ts`**
- **Lines**: 186 lines  
- **Reason**: Redundant with main `lead-scoring.service.ts`
- **Check**: Ensure no cron jobs use this service
- **Safety**: Check for imports before removal

### **Phase 2: Fix Queue Service Logic**

#### **2.1 Fix `unsigned-users-queue.service.ts`**
- **Remove**: All MySQL replica queries
- **Remove**: Signature checking logic (already applied upstream)
- **Keep**: Simple priority-based retrieval from `user_call_scores`
- **Fix**: Only query `user_call_scores` where `queueType = 'unsigned_users'`

#### **2.2 Fix `outstanding-requests-queue.service.ts`**
- **Remove**: All MySQL replica queries  
- **Remove**: Requirements checking logic (already applied upstream)
- **Keep**: Simple priority-based retrieval from `user_call_scores`
- **Fix**: Only query `user_call_scores` where `queueType = 'outstanding_requests'`

#### **2.3 Simplify `queue-adapter.service.ts`**
- **Remove**: Complex legacy fallback logic
- **Keep**: Simple routing between unsigned/outstanding services
- **Remove**: Emergency fallback complexity

### **Phase 3: Update Pre-call Validation Integration**

#### **3.1 Keep Single Pre-call Validation Service** ✅ **DECISION UPDATED**
- **Reason**: Current service already handles both queue types efficiently
- **Current logic**: Already checks signature status for unsigned_users, requirements for outstanding_requests
- **Better approach**: Update to integrate with new QueueAdapterService instead of splitting

#### **3.2 Update PreCallValidationService Integration**
- **Remove**: Direct queries to `CallQueue` table
- **Add**: Integration with `QueueAdapterService` for queue operations
- **Keep**: MySQL replica validation logic (this is the right place for business logic validation)
- **Update**: Remove invalid users through QueueAdapterService instead of direct database calls

#### **3.3 Integration Pattern**
```typescript
// Updated PreCallValidationService
class PreCallValidationService {
  constructor(private queueAdapter: QueueAdapterService) {}
  
  async getNextValidUserForCall(queueType: QueueType): Promise<NextUserForCallResult | null> {
    // 1. Get next user from queue adapter (not CallQueue directly)
    const user = await this.queueAdapter.getNextUserForCall(queueType);
    if (!user) return null;
    
    // 2. Validate user against MySQL replica (existing logic)
    const validation = await this.validateUserForCall(user.userId, queueType);
    
    // 3. If invalid, remove from queue and try next
    if (!validation.isValid) {
      await this.queueAdapter.removeUserFromQueue(queueType, user.userId);
      return this.getNextValidUserForCall(queueType); // Recursive
    }
    
    return user;
  }
}
```

---

## 📋 **Detailed Cleanup Checklist**

### **Phase 1: Legacy Service Removal**
- [ ] Audit all imports of `queue.service.ts`
- [ ] Update imports to use `queue-adapter.service.ts`
- [ ] Rename `queue.service.ts` to `queue.service.ts.backup`
- [ ] Remove `lead-scoring-simple.service.ts`
- [ ] Update `index.ts` exports

### **Phase 2: Queue Logic Fixes**
- [ ] Remove all replica DB imports from queue services
- [ ] Remove business logic from `getNextUser()` methods
- [ ] Fix queries to only use `user_call_scores` + `callback` tables
- [ ] Remove signature/requirements criteria checking
- [ ] Simplify `queue-adapter.service.ts` routing
- [ ] Update type definitions to match simplified logic

### **Phase 3: Pre-call Validation Split**
- [ ] Create `unsigned-pre-call-validation.service.ts`
- [ ] Create `outstanding-pre-call-validation.service.ts`  
- [ ] Update main `pre-call-validation.service.ts` to coordinate
- [ ] Update queue services to use appropriate validators
- [ ] Test validation works for both queue types

### **Phase 4: Integration Testing**
- [ ] Test queue population from `user_call_scores`
- [ ] Test callback prioritization works
- [ ] Test pre-call validation removes invalid users
- [ ] Test queue stats and monitoring
- [ ] Verify no replica DB queries in queue services

---

## 🎯 **Expected Results**

### **Before Cleanup**
- **Queue Services**: 650 lines with some business logic
- **Legacy Services**: 494 + 186 = 680 redundant lines
- **Logic**: Mixed business logic in queue services
- **Validation**: Single monolithic validator

### **After Cleanup**  
- **Queue Services**: ~400 lines of pure storage/retrieval
- **Legacy Services**: 680 lines removed
- **Logic**: Business logic only in discovery/scoring pipeline
- **Validation**: Split validators for better separation

### **Benefits**
1. **🎯 True Single Responsibility**: Queues only handle storage/retrieval
2. **🚀 Better Performance**: No unnecessary replica queries in queue services
3. **🔧 Easier Maintenance**: Clear separation between discovery, scoring, and serving
4. **🛡️ Better Validation**: Queue-specific validation logic
5. **📦 Smaller Codebase**: Remove 680+ lines of redundant code

---

## ✅ **Validation of Correct Architecture**

```
📊 Data Flow (CORRECTED):

MySQL Replica 
    ↓ (business logic applied here)
lead-discovery-optimized.service.ts → determines queue type
    ↓
user_call_scores (with queueType field)
    ↓ 
queue-generation.service.ts → populates queue tables
    ↓
unsigned-users-queue.service.ts → DUMB retrieval by score
outstanding-requests-queue.service.ts → DUMB retrieval by score
    ↓
pre-call-validation → queue-specific validation
    ↓
Agent gets valid user
```

**Key Principle**: Business logic flows DOWN the pipeline, queues are just the final serving layer! 🎯

This cleanup will make the queue system truly align with your requirements: **simple storage for agent routing, no business logic, no replica queries!** 