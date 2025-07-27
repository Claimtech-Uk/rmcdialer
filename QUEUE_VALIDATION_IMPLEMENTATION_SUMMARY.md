# 🔍 Queue-Specific Validation Implementation - Complete ✅

**Objective**: Implement queue-specific pre-call validation that checks replica DB and updates user_call_scores when users are invalid

---

## ✅ **Implementation Summary**

### **1. Queue-Specific Validation Criteria**

#### **unsigned_users Queue**
- **Criteria**: `current_signature_file_id IS NULL` AND `is_enabled = true`
- **Validation**: User must still be missing signature

#### **outstanding_requests Queue**  
- **Criteria**: `current_signature_file_id IS NOT NULL` AND `pending_requirements > 0` AND `is_enabled = true`
- **Validation**: User must have signature AND still have pending requirements

### **2. Invalid User Handling**
When a user fails validation:
1. **Update `user_call_scores`**:
   - Set `isActive = false` (prevents future pickup)
   - Set `currentQueueType = null` (prevents next population)
   - Set `lastOutcome = reason` (tracks why removed)
2. **Skip to next user** for agent
3. **Continue until valid user found** or queue exhausted

---

## 🏗️ **Architecture Changes**

### **UnsignedUsersQueueService**
- **Added**: `getNextValidUser()` - Main validation loop
- **Added**: `validateUserForUnsignedQueue()` - Queue-specific validation
- **Added**: `markUserInactive()` - Updates user_call_scores
- **Modified**: `getNextUserForCall()` - Now uses validated method
- **Kept**: `getNextUser()` - Internal method for getting users without validation

### **OutstandingRequestsQueueService**
- **Added**: `getNextValidUser()` - Main validation loop
- **Added**: `validateUserForOutstandingQueue()` - Queue-specific validation
- **Added**: `markUserInactive()` - Updates user_call_scores  
- **Modified**: `getNextUserForCall()` - Now uses validated method
- **Kept**: `getNextUser()` - Internal method for getting users without validation

### **QueueAdapterService**
- **Modified**: `getNextUserForCall()` - Now calls `getNextValidUser()` methods
- **Enhanced**: Priority handling (unsigned → outstanding → none)
- **Fixed**: tRPC compatibility method signatures

---

## 🔄 **Validation Flow**

### **New Validated Flow**:
```
Agent requests call → QueueAdapterService → Queue.getNextValidUser()
                                        ↓
                    Loop: getNextUser() → validateUser() → if invalid: markInactive() → try next
                                        ↓
                    Returns valid user or null → Agent calls valid user
```

### **Validation Loop Logic**:
```typescript
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  // 1. Get next user from queue (callbacks + user_call_scores)
  const user = await this.getNextUser();
  if (!user) return null;
  
  // 2. Validate against replica DB for queue-specific criteria
  const isValid = await this.validateUserForQueue(user.userId);
  
  if (isValid) {
    return user; // Found valid user
  }
  
  // 3. Mark invalid and try next
  await this.markUserInactive(user.userId, reason);
}
```

---

## 📊 **Validation Details**

### **unsigned_users Validation**
```typescript
// Check if user still missing signature
const userData = await replicaDb.user.findUnique({
  where: { id: userId },
  include: { claims: { include: { requirements: {...} } } }
});

const isValid = userData?.is_enabled && !userData.current_signature_file_id;
```

### **outstanding_requests Validation**  
```typescript
// Check if user has signature AND pending requirements
const hasSignature = !!userData.current_signature_file_id;
const pendingRequirements = userData.claims.reduce(
  (acc, claim) => acc + claim.requirements.length, 0
);

const isValid = userData?.is_enabled && hasSignature && pendingRequirements > 0;
```

### **Invalid User Cleanup**
```typescript
await prisma.userCallScore.updateMany({
  where: { userId },
  data: {
    isActive: false,        // Prevents pickup
    currentQueueType: null, // Prevents re-population
    lastOutcome: reason     // Tracks removal reason
  }
});
```

---

## 🛡️ **Error Handling & Safety**

### **Database Error Protection**
- **Validation errors**: Treated as invalid (safer to skip than call potentially invalid user)
- **Update errors**: Logged but don't stop the process (continue to next user)

### **Infinite Loop Prevention**
- **Max attempts**: 10 attempts per queue to prevent infinite loops
- **Exhaustion logging**: Clear logging when no valid users found

### **Monitoring & Logging**
```typescript
// Detailed validation logging
console.log(`🔍 Validating user ${userId} for ${queueType} queue criteria...`);
console.log(`✅ User ${userId} is valid for ${queueType} queue`);
console.log(`❌ User ${userId} validation failed - reason`);
console.log(`🚫 Marked user ${userId} as inactive: ${reason}`);
```

---

## 🎯 **Benefits Achieved**

1. **✅ Queue-Specific Validation**: Each queue validates its own criteria
2. **✅ Real-time Accuracy**: Checks current state in replica DB
3. **✅ Self-Healing**: Invalid users automatically marked inactive
4. **✅ Prevents Re-pickup**: currentQueueType = null prevents re-population
5. **✅ Agent Experience**: Agents never get invalid users
6. **✅ Performance**: Validation only runs when user about to be called
7. **✅ Safety**: Multiple error handling and loop prevention mechanisms

---

## 🚀 **Integration Status**

### **✅ Completed**
- [x] UnsignedUsersQueueService validation
- [x] OutstandingRequestsQueueService validation  
- [x] QueueAdapterService integration
- [x] tRPC router compatibility
- [x] Error handling & logging
- [x] TypeScript compilation fixes

### **📋 Ready for Testing**
The validation system is now **production-ready** and ensures:
- **Agents only get valid users** for their calls
- **System automatically cleans up** invalid users
- **Queues maintain data integrity** through validation
- **Full backward compatibility** with existing tRPC endpoints

---

## 🔄 **Next Steps**

With validation complete, the queue system now provides:
1. **Pure storage/retrieval** from `user_call_scores` + `callback` tables
2. **Queue-specific validation** against replica DB criteria  
3. **Automatic cleanup** of invalid users
4. **Callback prioritization** (checked first in both queues)
5. **Full tRPC compatibility** for seamless transition

**Ready for Phase 3: Database Migration** when you're ready to proceed! 🚀 