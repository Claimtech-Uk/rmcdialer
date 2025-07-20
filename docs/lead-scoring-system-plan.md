# 🎯 Lead Scoring System - Complete Implementation Plan

## 📋 **Executive Summary**

This document outlines the implementation of a lead scoring system for the RMC Dialler that prioritizes leads based on freshness, agent interactions, and queue transitions. The system uses a **0-200 scoring range** where **0 = highest priority** and **200 = give up threshold**.

### **Key Principles**
- **Lower scores = Higher priority** (0 is hottest lead)
- **Fresh starts on queue transitions** (reset to score 0)
- **Daily aging** (+5 points per day, skip Sundays)
- **Callbacks always override** scoring system
- **Safety nets prevent lost users**

---

## 🏗️ **System Architecture**

### **Database Structure**

#### **Enhanced user_call_scores Table (PostgreSQL)**
```sql
user_call_scores:
- id (UUID PRIMARY KEY)
- user_id (BigInt) ← Links to MySQL replica users.id
- current_score (Int) ← 0-200 scoring system (0 = highest priority)
- is_active (Boolean) ← Currently eligible for queues?
- current_queue_type (String) ← 'unsigned_users', 'outstanding_requests', 'callback'
- last_reset_date (DateTime) ← When score was last reset to 0
- last_queue_check (DateTime) ← When we last verified eligibility
- total_attempts (Int) ← Total call attempts made
- last_call_at (DateTime) ← When last call was attempted
- last_outcome (String) ← 'no_answer', 'callback_requested', 'not_interested', etc.
- created_at (DateTime)
- updated_at (DateTime)
```

#### **Enhanced call_queue Table (PostgreSQL)**
```sql
call_queue:
- id (UUID PRIMARY KEY)
- user_id (BigInt) ← Links to MySQL replica users.id
- queue_type (String) ← 'unsigned_users', 'outstanding_requests', 'callback'
- priority_score (Int) ← Copied from user_call_scores.current_score
- queue_position (Int) ← Position within queue type
- status (String) ← 'pending', 'assigned', 'completed'
- queue_reason (String) ← Human-readable explanation
- created_at (DateTime)
- updated_at (DateTime)
```

### **Database Relationships**
```
MySQL Replica (Read-Only)          PostgreSQL Dialer (Read-Write)
┌─────────────────┐                ┌─────────────────┐
│     users       │                │ user_call_scores│
│  id (BigInt)    │◄──────────────►│  user_id        │
│  signature_file │                │  current_score  │
│  is_enabled     │                │  is_active      │
└─────────────────┘                │  queue_type     │
                                   └─────────────────┘
┌─────────────────┐                        │
│     claims      │                        ▼
│  user_id        │                ┌─────────────────┐
│  status         │                │   call_queue    │
└─────────────────┘                │  user_id        │
                                   │  queue_type     │
┌─────────────────┐                │  priority_score │◄── Copied from user_call_scores
│ requirements    │                │  status         │
│  claim_id       │                └─────────────────┘
│  status         │
└─────────────────┘
```

---

## ⚙️ **Core Processes**

### **1. Hourly Discovery & Scoring Process**

**Runs:** Every hour via Vercel cron (`0 * * * *`)  
**Location:** `/api/cron/discover-new-leads`

#### **Step 1: Discover Eligible Users**
```sql
-- Unsigned Users (Missing Signature)
SELECT users.* FROM users 
WHERE is_enabled = true 
  AND current_signature_file_id IS NULL
  AND EXISTS (
    SELECT 1 FROM claims 
    WHERE user_id = users.id AND status != 'complete'
  )

-- Outstanding Requests (Pending Requirements)  
SELECT users.* FROM users
WHERE is_enabled = true
  AND current_signature_file_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM claims c
    JOIN claim_requirements cr ON c.id = cr.claim_id
    WHERE c.user_id = users.id AND cr.status = 'PENDING'
  )

-- Due Callbacks
SELECT users.* FROM callbacks cb
JOIN users ON cb.user_id = users.id
WHERE cb.status = 'pending' 
  AND cb.scheduled_for <= NOW()
  AND users.is_enabled = true
```

#### **Step 2: Score Management Logic**
```
For each eligible user:

IF user_call_scores record doesn't exist:
  → Create new record (score: 0, is_active: TRUE)

ELSE IF record exists but is_active = FALSE:
  → Reactivate (score: 0, is_active: TRUE, reset_date: NOW)

ELSE IF current_queue_type changed:
  → Reset score to 0, update queue_type, reset_date: NOW

ELSE IF same queue type:
  → Age score normally (see aging rules below)

Mark is_active = FALSE for users no longer eligible
```

#### **Step 3: Daily Aging Rules**
```
Aging Logic:
- Add +5 points per day since last_reset_date
- Skip Sundays (no aging on Sundays)
- Maximum score: 200 (users removed from queues at this threshold)
- Minimum score: 0 (never go below zero)

Example:
Monday: Score 0 → Tuesday: Score 5 → Wednesday: Score 10
→ Sunday: Score 10 (no change) → Monday: Score 15
```

#### **Step 4: Queue Population**
```
For each active user (is_active = TRUE, current_score < 200):
1. Clear existing queue entries for this user
2. Insert into call_queue:
   - priority_score = current_score from user_call_scores
   - queue_type = current_queue_type
   - status = 'pending'
3. Sort queues by priority_score ASC (0 first)
```

### **2. Agent Call Process**

#### **Queue Display Logic**
```
Agent Queue View:
1. Get call_queue entries WHERE status = 'pending'
2. Special handling: Callbacks ALWAYS first (ignore score)
3. Otherwise: ORDER BY priority_score ASC (0 = highest priority)
4. Then by created_at ASC (oldest first for ties)
```

#### **Pre-Call Validation (Existing System)**
```
Before each call:
1. Real-time validation against MySQL replica
2. Verify user still meets queue criteria
3. If invalid: Remove from queue, get next user
4. If valid: Present to agent
```

#### **Post-Call Scoring Updates**
```
When agent logs call outcome:

Update user_call_scores:
- last_call_at = NOW()
- total_attempts += 1
- last_outcome = agent_input
- current_score = calculate_outcome_penalty(outcome)

Update call_queue:
- priority_score = new current_score
- status = 'completed' (if successful outcome)
```

### **3. Outcome-Based Scoring**

#### **Score Adjustments by Outcome**
```
Positive Outcomes (Lower Score = Higher Priority):
- "callback_requested" → Score -10 (they want to talk!)
- "answered_but_busy" → Score +2 (minor bump)
- "interested_will_callback" → Score -5 (promising!)
- "partial_completion" → Score -15 (making progress!)

Negative Outcomes (Higher Score = Lower Priority):
- "no_answer" → Score +10 (harder to reach)
- "voicemail_left" → Score +5 (slight bump)
- "wrong_number" → Score +50 (big problem)
- "not_interested" → Score +100 (very low priority)
- "hostile_aggressive" → Score +150 (remove from queue soon)

Completion Outcomes:
- "requirements_completed" → is_active = FALSE (success!)
- "opted_out" → is_active = FALSE (respect their choice)
- "already_completed" → is_active = FALSE (data sync issue)
```

---

## 🚨 **Potential Problems & Solutions**

### **Problem 1: Lost Users During Transitions**
**Risk:** Users could disappear from scoring system when transitioning between queues

**Solution: Safety Net Approach**
```
✅ Never delete user_call_scores records
✅ Use is_active flag instead of deletion
✅ Hourly job reactivates users who become eligible again
✅ Complete audit trail preserved
```

### **Problem 2: Timing Gaps & Stale Data**
**Risk:** User completes requirements but system doesn't know for up to 59 minutes

**Solution: Pre-Call Validation (Already Implemented)**
```
✅ Real-time validation before every call
✅ Direct MySQL replica queries catch stale data
✅ Invalid users automatically removed from queue
✅ Agents never call users with outdated information
```

### **Problem 3: System Failures & Data Loss**
**Risk:** Hourly job crashes, users miss scoring updates

**Solution: Robust Error Handling**
```
✅ Database transactions prevent partial updates
✅ Comprehensive logging of all scoring changes
✅ Health monitoring alerts on job failures
✅ Manual recovery procedures documented
```

### **Problem 4: Score Inflation Over Time**
**Risk:** All users gradually get high scores, losing prioritization

**Solution: Queue Transitions Reset Scores**
```
✅ Users get fresh start (score 0) when changing queue types
✅ New requirements reset existing users to score 0
✅ Maximum score threshold (200) removes stale leads
✅ Continuous influx of fresh leads maintains balance
```

### **Problem 5: Weekend Aging Inconsistency**
**Risk:** Confusion about which days count for aging

**Solution: Clear Sunday Skip Rule**
```
✅ Sundays explicitly skipped in aging calculation
✅ Monday-Saturday all count as aging days
✅ Consistent behavior regardless of processing time
✅ Well-documented rule for support team
```

### **Problem 6: Queue Type Priority Conflicts**
**Risk:** Callbacks might get deprioritized by scoring system

**Solution: Callback Override Rule**
```
✅ Callbacks ALWAYS displayed first, regardless of score
✅ Respects user-scheduled appointment times
✅ Maintains good customer experience
✅ Clear business rule implementation
```

---

## 📊 **Business Rules Summary**

### **Queue Priority Hierarchy**
1. **Callbacks** (Always first, honor scheduled times)
2. **Unsigned Users** (Critical path - blocks all progress)
3. **Outstanding Requests** (Important - needed for completion)

### **Scoring Ranges**
```
Score 0-10:   🔥 Hot leads (new/responsive users)
Score 11-25:  ⚡ Warm leads (recent, some attempts)
Score 26-50:  🌡️ Cool leads (older, multiple attempts)
Score 51-100: ❄️ Cold leads (difficult to reach)
Score 101-200: 🧊 Very cold (last attempts before removal)
Score 200+:   ❌ Removed from queues (give up threshold)
```

### **Reset Triggers**
- **Queue transitions** (unsigned → outstanding)
- **New requirements** (completed → active again)
- **Successful callbacks** (fresh start for follow-up)

### **Aging Schedule**
- **Monday-Saturday:** +5 points per day
- **Sunday:** No aging (skip)
- **Bank holidays:** Normal aging (no special handling)

---

## 🔧 **Implementation Checklist**

### **Phase 1: Database Schema Updates**
- [ ] Add new fields to user_call_scores table
- [ ] Create database migration script
- [ ] Update Prisma schema definitions
- [ ] Test schema changes in development

### **Phase 2: Scoring Logic Implementation**
- [ ] Enhance QueueDiscoveryService with new scoring logic
- [ ] Implement outcome-based score adjustments
- [ ] Add Sunday skip logic to aging calculations
- [ ] Create score reset handling for queue transitions

### **Phase 3: Queue Management Updates**
- [ ] Update queue population to use priority_score
- [ ] Implement callback override logic
- [ ] Enhance pre-call validation integration
- [ ] Add queue health monitoring

### **Phase 4: Agent Interface Updates**
- [ ] Display scores in agent queue view
- [ ] Add outcome selection interface
- [ ] Show queue transition history
- [ ] Implement score-based queue filtering

### **Phase 5: Monitoring & Analytics**
- [ ] Add scoring metrics to dashboards
- [ ] Create score distribution reports
- [ ] Implement aging trend analysis
- [ ] Add conversion rate by score range

---

## 📈 **Success Metrics**

### **Operational Metrics**
- **Average score at contact** (target: <20)
- **Queue freshness** (% of calls to score 0-10 leads)
- **Agent efficiency** (calls per hour improvement)
- **System reliability** (scoring job success rate >99%)

### **Business Metrics**
- **Conversion rate by score range** (validate scoring accuracy)
- **Time to contact** (how quickly new leads get called)
- **Customer satisfaction** (fewer "already completed" complaints)
- **Revenue optimization** (higher value leads prioritized)

### **Quality Metrics**
- **Data accuracy** (pre-call validation success rate)
- **Queue transition accuracy** (correct queue assignments)
- **Score reset precision** (appropriate fresh starts)
- **System uptime** (hourly job reliability)

---

## 🎯 **Expected Business Impact**

### **Agent Experience**
- ✅ Always work freshest, most responsive leads first
- ✅ Reduced frustration from difficult/stale leads
- ✅ Clear priority guidance for call sequence
- ✅ Better conversion rates and job satisfaction

### **Customer Experience**
- ✅ Faster contact for new requirements
- ✅ No calls about already-completed items
- ✅ Respected callback preferences
- ✅ Consistent, professional interactions

### **Business Results**
- ✅ Higher conversion rates from better prioritization
- ✅ Improved operational efficiency
- ✅ Better resource allocation
- ✅ Enhanced competitive advantage through responsiveness

---

**Document Version:** 1.0  
**Created:** January 2024  
**Next Review:** After Phase 1 implementation 