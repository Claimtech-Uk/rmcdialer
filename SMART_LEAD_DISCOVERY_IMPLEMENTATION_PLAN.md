# 🚀 Smart Lead Discovery System - Implementation Plan

## Executive Summary

Transform the current bulk discovery system into a **targeted, efficient 4-cron system** that:
- Processes only **new users** and **status changes** (not 11,000+ users every 15 minutes)
- Tracks **conversions automatically** (revenue recognition)
- Maintains **pre-call validation** as safety net
- Reduces processing by **95%** while improving accuracy

## 🎯 System Goals

1. **New Lead Discovery**: Find and categorize new users within 1 hour
2. **Conversion Tracking**: Automatically detect when users sign or complete requirements
3. **Queue Management**: Maintain accurate queue assignments
4. **Performance**: Process only what matters, when it matters

## 📊 Current System Analysis

### What We Have (Working Well)
- ✅ **Optimized Lead Discovery Service** (10,803 users processed efficiently)
- ✅ **user_call_scores table** with `currentQueueType` field (perfect for our needs!)
- ✅ **Pre-call validation** (real-time safety net)
- ✅ **15-minute cron jobs** (can be repurposed)
- ✅ **MySQL read replica access** (for checking status)
- ✅ **PostgreSQL database** (for storing results)

### What We Need to Add
- 🔄 **Queue type tracking** in user_call_scores (already have field!)
- 🔄 **Conversion detection logic** (track state changes)
- 🔄 **Recent activity filtering** (only check recently called users)
- 🔄 **Historical data migration** (one-time catchup)

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MySQL Read Replica                         │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │    Users    │  │   Claims    │  │ Claim Requirements│   │
│  └─────────────┘  └─────────────┘  └───────────────────┘   │
└───────────────────────┬────────────────┬────────────────────┘
                        │                │
                    Every Hour       Every Hour
                        │                │
┌───────────────────────▼────────────────▼────────────────────┐
│                    4 Smart Cron Jobs                         │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │ New Users   │  │New Require- │  │ Check Unsigned  │   │
│  │ Discovery   │  │ments Disc. │  │  Conversions    │   │
│  └─────────────┘  └─────────────┘  └───────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        Check Requirements Conversions                │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │user_call_   │  │conversions  │  │  call_queue     │   │
│  │scores       │  │             │  │                 │   │
│  └─────────────┘  └─────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Implementation Phases

### Phase 1: Database Schema Updates (Day 1)

#### 1.1 Update user_call_scores Table
```sql
-- Already have currentQueueType field! Just need to ensure it's used properly
-- Add index for performance
CREATE INDEX idx_user_call_scores_queue_type_last_call 
ON user_call_scores(current_queue_type, last_call_at);

-- Add field to track when we last checked for conversion
ALTER TABLE user_call_scores 
ADD COLUMN last_conversion_check_at TIMESTAMP NULL;
```

#### 1.2 Create Conversions Table (Already Exists!)
The existing `conversions` table is perfect - no changes needed!

### Phase 2: Core Service Implementation (Days 2-3)

#### 2.1 Smart Discovery Service
```typescript
// modules/queue/services/smart-discovery.service.ts
export class SmartDiscoveryService {
  // Cron 1: New Users (hourly)
  async discoverNewUsers(hoursBack: number = 1) {
    // Only check users created in last hour
    // Determine if signed/unsigned
    // Create user_call_scores entry with appropriate queue_type
    // Add new users with a score of 0 
    // Skip over any users that already exist 
  }

  // Cron 2: New Requirements (hourly)  
  async discoverNewRequirements(hoursBack: number = 1) {
    // Check claim_requirements created in last hour
    // Update user's queue_type to 'requirements'
  }

  // Cron 3: Unsigned Conversions (hourly)
  async checkUnsignedConversions() {
    // Only check users with recent calls (optimization!)
    // Check if current_signature_file_id is now populated
    // Record conversion and update queue_type
  }

  // Cron 4: Requirements Conversions (hourly)
  async checkRequirementsConversions() {
    // Only check users with recent calls
    // Check if requirements now 'approved'
    // Record conversion and remove from queue
  }
}
```

### Phase 3: Cron Job Configuration (Day 4)

#### 3.1 Update vercel.json
```json
{
  "crons": [
    {
      "path": "/api/cron/new-users-discovery",
      "schedule": "0 * * * *"  // Every hour at :00
    },
    {
      "path": "/api/cron/new-requirements-discovery", 
      "schedule": "15 * * * *"  // Every hour at :15
    },
    {
      "path": "/api/cron/check-unsigned-conversions",
      "schedule": "30 * * * *"  // Every hour at :30
    },
    {
      "path": "/api/cron/check-requirements-conversions",
      "schedule": "45 * * * *"  // Every hour at :45
    },
    {
      "path": "/api/cron/daily-aging",
      "schedule": "0 2 * * *"  // Once daily at 2 AM
    }
  ]
}
```

### Phase 4: Migration & Testing (Day 5)

#### 4.1 Historical Data Migration
```typescript
// scripts/migrate-historical-users.ts
async function migrateHistoricalUsers() {
  // One-time script to populate user_call_scores
  // Process in batches of 1000
  // Set appropriate queue_types based on current status
}
```

#### 4.2 Testing Strategy
- Unit tests for each discovery function
- Integration tests with mock MySQL data
- Performance tests to ensure < 30s execution
- Conversion tracking accuracy tests

### Phase 5: Monitoring & Optimization (Day 6)

#### 5.1 Health Dashboard
```typescript
// api/health/smart-discovery
{
  "lastRun": {
    "newUsers": "2024-01-20T14:00:00Z",
    "newRequirements": "2024-01-20T14:15:00Z",
    "unsignedConversions": "2024-01-20T14:30:00Z",
    "requirementsConversions": "2024-01-20T14:45:00Z"
  },
  "metrics": {
    "newUsersFound": 87,
    "conversionsDetected": 23,
    "processingTimeMs": 4500
  }
}
```

## 🎯 Key Optimizations

### 1. Recent Activity Filter
```typescript
// Only check users called in last 24-48 hours
const recentlyCalledUsers = await prisma.userCallScore.findMany({
  where: {
    lastCallAt: {
      gte: new Date(Date.now() - 48 * 60 * 60 * 1000)
    },
    currentQueueType: 'unsigned_users'
  }
});
```

### 2. Batch Processing
```typescript
// Process in chunks to avoid timeouts
const BATCH_SIZE = 100;
for (let i = 0; i < users.length; i += BATCH_SIZE) {
  const batch = users.slice(i, i + BATCH_SIZE);
  await processBatch(batch);
}
```

### 3. Smart Queue Assignment
```typescript
function determineQueueType(user: any): string {
  if (!user.current_signature_file_id) return 'unsigned_users';
  if (hasOutstandingRequirements(user)) return 'requirements_outstanding';
  return 'none'; // Completed
}
```

## 📈 Expected Performance Gains

### Before (Current System)
- Processes: 11,739 users every 15 minutes
- Efficiency: Processing many unchanged users
- Load: High constant database load

### After (Smart System)
- Processes: ~100 new users + ~200 status checks hourly
- Efficiency: Only processes changes
- Load: 95% reduction in database queries

## 🚨 Risk Mitigation

### 1. Missed Users
- **Risk**: User created between cron runs
- **Mitigation**: Hourly runs + pre-call validation catches any missed

### 2. Conversion Delays
- **Risk**: User signs but not detected for up to 1 hour
- **Mitigation**: Acceptable for business (not real-time trading)

### 3. Database Load
- **Risk**: Too many queries to MySQL replica
- **Mitigation**: Recent activity filter + batch processing

## 📅 Implementation Timeline

| Day | Task | Owner | Status |
|-----|------|-------|---------|
| 1 | Database schema updates | Backend | Pending |
| 2-3 | Core service implementation | Backend | Pending |
| 4 | Cron job configuration | DevOps | Pending |
| 5 | Historical migration & testing | Backend | Pending |
| 6 | Monitoring setup | Backend | Pending |
| 7 | Production deployment | All | Pending |

## 🎉 Success Metrics

1. **Performance**: All crons complete in < 30 seconds
2. **Accuracy**: 100% of conversions detected within 1 hour
3. **Efficiency**: 95% reduction in database queries
4. **Reliability**: Zero missed users (validated by pre-call checks)

## 🔧 Configuration

### Environment Variables
```env
# Existing (no changes needed)
REPLICA_DATABASE_URL=mysql://...
DATABASE_URL=postgresql://...

# New
SMART_DISCOVERY_ENABLED=true
RECENT_ACTIVITY_HOURS=48
DISCOVERY_BATCH_SIZE=100
```

## 📝 Next Steps

1. **Review & Approve**: Team review of implementation plan
2. **Create Tasks**: Break down into JIRA tickets
3. **Start Phase 1**: Database schema updates
4. **Daily Standups**: Track progress during implementation

---

## 🏆 Why This Approach Wins

1. **Builds on Success**: Uses proven existing infrastructure
2. **Incremental**: Can deploy one cron at a time
3. **Reversible**: Can rollback to current system easily
4. **Measurable**: Clear metrics for success
5. **Maintainable**: Simple, focused functions

This evolution from "scan everything" to "track changes" is exactly how successful systems scale! 