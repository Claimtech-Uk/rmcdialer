# 🚀 Queue Migration Completion Plan

**Objective**: Complete Phase 3 database migration and finalize the queue separation project

---

## 📋 **Phase 3: Database Migration (Required Steps)**

### **Step 1: Update Database Schema** ⏱️ 15-30 min

#### **1.1. Update `prisma/schema.prisma`**
```bash
# Add the separated queue tables to current schema
```

**Action Items**:
- [ ] Add `UnsignedUsersQueue` model to schema.prisma
- [ ] Add `OutstandingRequestsQueue` model to schema.prisma  
- [ ] Add proper relations to Agent, Callback, UserCallScore
- [ ] Add optimized indexes for each queue type
- [ ] Preserve legacy `CallQueue` model during transition

#### **1.2. Generate Prisma Migration**
```bash
npx prisma migrate dev --name create-separated-queue-tables
```

**Expected Result**: Creates migration files in `prisma/migrations/`

---

### **Step 2: Run Database Migration** ⏱️ 5-10 min

#### **2.1. Apply Migration to Database**
```bash
npx prisma migrate deploy
```

#### **2.2. Regenerate Prisma Client**
```bash
npx prisma generate
```

#### **2.3. Verify Tables Created**
```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('unsigned_users_queue', 'outstanding_requests_queue');
```

**Expected Result**: New separated queue tables created successfully

---

### **Step 3: Data Migration Strategy** ⏱️ 30-60 min

#### **3.1. Create Data Migration Script**
```typescript
// scripts/migrate-queue-data.ts
async function migrateCallQueueData() {
  // 1. Migrate existing call_queue data to separated tables
  // 2. Preserve data integrity and relationships
  // 3. Validate migration success
}
```

#### **3.2. Migration Logic**
```typescript
// Migrate unsigned_users queue type
const unsignedEntries = await prisma.callQueue.findMany({
  where: { queueType: 'unsigned_users' }
});

for (const entry of unsignedEntries) {
  await prisma.unsignedUsersQueue.create({
    data: {
      userId: entry.userId,
      claimId: entry.claimId,
      priorityScore: entry.priorityScore,
      // ... map other fields
    }
  });
}

// Migrate outstanding_requests queue type
const outstandingEntries = await prisma.callQueue.findMany({
  where: { queueType: 'outstanding_requests' }
});

for (const entry of outstandingEntries) {
  await prisma.outstandingRequestsQueue.create({
    data: {
      userId: entry.userId,
      claimId: entry.claimId,
      priorityScore: entry.priorityScore,
      // ... map other fields
    }
  });
}
```

#### **3.3. Run Data Migration**
```bash
npx tsx scripts/migrate-queue-data.ts
```

**Expected Result**: All existing queue data migrated to separated tables

---

### **Step 4: Enable New Queue System** ⏱️ 10-15 min

#### **4.1. Update Feature Flags**
```typescript
// lib/config/features.ts
export const QUEUE_MIGRATION_FLAGS = {
  USE_NEW_QUEUES: true,              // ✅ Enable new queues
  POPULATE_SEPARATED_TABLES: true,   // ✅ Enable population
  FALLBACK_TO_LEGACY: true,         // 🛡️ Keep safety fallback
};
```

#### **4.2. Test New Queue Operations**
```bash
# Test that separated queue operations work
npm run test:queue-migration
```

**Expected Result**: All queue operations work with new separated tables

---

### **Step 5: Fix Broken Methods** ⏱️ 15-30 min

#### **5.1. Remove Type Casting**
```typescript
// BEFORE: (this.prisma as any).unsignedUsersQueue.create({...})
// AFTER:  this.prisma.unsignedUsersQueue.create({...})
```

#### **5.2. Update Queue Service Methods**
- [ ] Fix `addUserToQueue()` in both services
- [ ] Fix `removeUserFromQueue()` in both services  
- [ ] Fix `getUserQueueEntry()` in both services
- [ ] Test all CRUD operations work

**Expected Result**: All queue service methods functional

---

### **Step 6: Update Cron Jobs** ⏱️ 20-30 min

#### **6.1. Create New Queue Population Service**
```typescript
// modules/queue/services/separated-queue-population.service.ts
export class SeparatedQueuePopulationService {
  async populateUnsignedUsersQueue() {
    // Read from user_call_scores where currentQueueType = 'unsigned_users'
    // Populate unsignedUsersQueue table
  }
  
  async populateOutstandingRequestsQueue() {
    // Read from user_call_scores where currentQueueType = 'outstanding_requests'  
    // Populate outstandingRequestsQueue table
  }
}
```

#### **6.2. Update Cron Jobs to Use New Population**
```typescript
// app/api/cron/queue-population/route.ts
const populationService = new SeparatedQueuePopulationService();
await populationService.populateUnsignedUsersQueue();
await populationService.populateOutstandingRequestsQueue();
```

**Expected Result**: Cron jobs populate separated tables instead of legacy call_queue

---

## 📋 **Phase 4: Cleanup & Optimization (Optional)**

### **Step 7: Remove Deprecated Services** ⏱️ 15-20 min

#### **7.1. Delete Redundant Services**
```bash
# Remove deprecated services
rm modules/queue/services/queue-generation.service.ts
rm modules/queue/services/pre-call-validation.service.ts
```

#### **7.2. Update Exports**
```typescript
// Remove deprecated exports from index.ts files
// Update any remaining imports
```

#### **7.3. Clean Up Health Endpoints**
- [ ] Remove PreCallValidationService usage
- [ ] Use queue service stats directly
- [ ] Test health endpoints work

**Expected Result**: Codebase cleaned of redundant services

---

### **Step 8: Performance Optimization** ⏱️ 30-45 min

#### **8.1. Add Specialized Indexes**
```sql
-- Optimized indexes for unsigned users queue
CREATE INDEX idx_unsigned_priority ON unsigned_users_queue(status, priority_score, available_from);
CREATE INDEX idx_unsigned_user ON unsigned_users_queue(user_id);

-- Optimized indexes for outstanding requests queue  
CREATE INDEX idx_outstanding_priority ON outstanding_requests_queue(status, priority_score, available_from);
CREATE INDEX idx_outstanding_user ON outstanding_requests_queue(user_id);
```

#### **8.2. Test Performance Improvements**
```bash
# Benchmark queue operations before/after
npm run benchmark:queue-performance
```

**Expected Result**: Improved query performance with specialized tables

---

### **Step 9: Legacy Deprecation** ⏱️ 15-20 min

#### **9.1. Disable Legacy Queue Population**
```typescript
// Stop populating legacy call_queue table
QUEUE_MIGRATION_FLAGS.POPULATE_LEGACY_QUEUE = false;
```

#### **9.2. Monitor New System**
- [ ] Monitor queue performance
- [ ] Track error rates
- [ ] Validate data consistency
- [ ] Ensure agents get valid users

#### **9.3. Schedule Legacy Table Removal**
```sql
-- After monitoring period (e.g., 2 weeks)
-- DROP TABLE call_queue; -- (Future step)
```

**Expected Result**: New separated queues fully operational, legacy deprecated

---

## 🎯 **Execution Timeline**

### **Phase 3A: Core Migration (Required)**
- **Steps 1-5**: Database migration and basic functionality
- **Time**: 2-3 hours
- **Risk**: Low (fallback available)
- **Outcome**: Fully functional separated queues

### **Phase 3B: Population Updates (Important)**  
- **Step 6**: Update cron jobs
- **Time**: 30-60 minutes
- **Risk**: Low (existing crons still work)
- **Outcome**: Separated tables populated by crons

### **Phase 4: Cleanup (Optional)**
- **Steps 7-9**: Remove deprecated code and optimize
- **Time**: 1-2 hours
- **Risk**: Very low
- **Outcome**: Clean, optimized codebase

---

## ✅ **Success Criteria**

### **Phase 3A Complete When**:
- [ ] Separated queue tables created in database
- [ ] All queue service methods work without errors
- [ ] Agents can get users from both queue types
- [ ] TypeScript compiles without errors
- [ ] Basic tests pass

### **Phase 3B Complete When**:
- [ ] Cron jobs populate separated tables
- [ ] Queue population happens automatically
- [ ] Data flows correctly from user_call_scores → separated tables

### **Phase 4 Complete When**:
- [ ] No deprecated services in codebase
- [ ] Performance benchmarks show improvement
- [ ] Legacy call_queue table not used
- [ ] System fully optimized

---

## 🛡️ **Risk Mitigation**

### **Rollback Plan**:
1. **Database**: Legacy call_queue table preserved
2. **Services**: Legacy QueueService available as backup
3. **Feature Flags**: Can disable new queues instantly
4. **Data**: Original data preserved during migration

### **Monitoring**:
- [ ] Track queue operation success rates
- [ ] Monitor agent call success rates  
- [ ] Watch for database errors
- [ ] Validate data consistency

---

**Ready to proceed with Phase 3A when you are!** 🚀 