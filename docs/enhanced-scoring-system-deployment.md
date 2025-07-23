# 🎯 Enhanced Call Scoring System - Updated Implementation Guide

## 📋 **Updated Requirements Based on Your Feedback**

Thank you for the clarifications! The implementation has been updated to reflect:

1. **✅ Callbacks within queues** - No separate callback queue, prioritized within existing queues
2. **✅ Event-based scoring only** - Removed daily aging, scores change only on call outcomes  
3. **✅ Enhanced conversions system** - Track successful outcomes with agent attribution

---

## 🏗️ **Updated System Architecture**

### **Queue Types (Simplified)**
```typescript
// Only two main queue types now
export type QueueType = 
  | 'unsigned_users'      // Users missing signatures
  | 'outstanding_requests'; // Users with pending requirements

// Callbacks exist WITHIN these queues, not as separate queue
```

### **Callback Handling**
Callbacks are now handled as **priority flags within existing queues**:

```sql
-- Queue entries with callback priority
SELECT * FROM call_queue 
WHERE queue_type = 'unsigned_users'
ORDER BY 
  callback_id IS NOT NULL DESC,  -- Callbacks first
  priority_score ASC,             -- Then by score
  queue_position ASC;
```

### **Event-Based Scoring**
Scores only change based on call outcomes (no time-based aging):

```typescript
// Scoring triggers:
- Fresh user enters queue → Score 0
- Queue type changes → Reset to Score 0  
- Call outcome recorded → Adjust score based on outcome
- Conversion achieved → Mark inactive, create conversion record
```

---

## 🎯 **Enhanced Conversions System**

### **Conversion Tracking**
When users achieve their goals, comprehensive conversion records are created:

```typescript
interface ConversionRecord {
  userId: number;
  conversionType: 'signed' | 'info_received' | 'requirements_completed';
  primaryAgentId: number;        // Agent who closed the conversion
  contributingAgents: number[];  // Other agents who helped (last 30 days)
  documentsReceived: string[];   // What was completed
  signatureObtained: boolean;    // Did they sign?
  claimValue: number;           // Business value
  estimatedCommission: number;   // Agent commission
}
```

### **Agent Attribution Logic**
```typescript
// Primary Agent: Who recorded the conversion outcome
// Contributing Agents: Others who called this user in last 30 days
// Commission Tracking: Business value and estimated commission
```

---

## 📊 **Updated Database Schema**

### **Key Changes**
```sql
-- 1. Enhanced UserCallScore (simplified)
user_call_scores:
+ is_active              -- Currently eligible for calling?
+ current_queue_type     -- Which queue they belong to
+ last_reset_date        -- When score was last reset to 0
- daily_aging fields     -- REMOVED (no longer needed)

-- 2. Enhanced CallQueue (callback support)  
call_queue:
+ callback_id            -- Link to callback if exists
+ has_callback           -- Quick flag for sorting
+ callback_scheduled_for -- When callback is due
+ callback_reason        -- Why callback was requested

-- 3. Enhanced Conversions (agent attribution)
conversions:
+ primary_agent_id       -- Main agent who achieved conversion  
+ contributing_agents    -- JSON array of helper agent IDs
+ signature_obtained     -- Did they sign?
+ documents_received     -- What was completed
+ claim_value           -- Business value
+ estimated_commission  -- Agent earnings
```

---

## 🔄 **Updated Process Flow**

### **1. User Entry & Queue Assignment**
```
1. User needs signature → unsigned_users queue (Score 0)
2. User has signature but needs docs → outstanding_requests queue (Score 0)  
3. User requests callback → Add callback_id to existing queue entry
```

### **2. Queue Ordering (Priority Logic)**
```
Within each queue type:
1. Callbacks first (callback_id IS NOT NULL)
2. Then by priority score (lower = higher priority)
3. Then by queue position
```

### **3. Call Outcomes & Scoring**
```
Event-based score adjustments:
- "callback_requested" → -10 points (higher priority)
- "contacted" → -5 points  
- "no_answer" → +10 points
- "not_interested" → +100 points
- "requirements_completed" → Create conversion, mark inactive
```

### **4. Conversion Process**
```
When conversion outcome is recorded:
1. Create detailed conversion record
2. Identify primary agent (who recorded outcome)
3. Find contributing agents (last 30 days of calls)
4. Track business value and commission potential
5. Mark user as inactive (removed from queues)
```

---

## 🚀 **Deployment Instructions**

### **Step 1: Database Migration**
```bash
# Apply updated schema with callback support and conversions
npx prisma migrate dev --name simplified-scoring-with-conversions
npx prisma generate
```

### **Step 2: Update Call Interface**
Add conversion outcome types to your call outcome modal:

```typescript
// New outcome types for conversions
const CONVERSION_OUTCOMES = [
  'signature_obtained',
  'documents_received', 
  'requirements_completed',
  'claim_completed'
];
```

### **Step 3: Configure Callback Handling**
Update queue display to show callback priority:

```typescript
// Queue display with callback indicators
{entries.map(entry => (
  <div key={entry.id} className={entry.hasCallback ? 'callback-priority' : ''}>
    {entry.hasCallback && <CallbackIcon />}
    {entry.user.name} - Score: {entry.priorityScore}
  </div>
))}
```

### **Step 4: Conversion Dashboard**
Create agent performance tracking:

```typescript
// Agent conversion dashboard
const AgentConversions = () => {
  const conversions = useQuery(['agent-conversions'], () =>
    api.conversions.getByAgent.query({ agentId })
  );

  return (
    <div>
      <h3>Your Conversions This Month</h3>
      <p>Primary: {conversions.primary?.length}</p>
      <p>Contributing: {conversions.contributing?.length}</p>
      <p>Total Commission: £{conversions.totalCommission}</p>
    </div>
  );
};
```

---

## 📈 **Expected Benefits**

### **For Agents**
- **Callbacks clearly prioritized** within their respective queues
- **No stale leads** - scores only change based on actual events
- **Clear conversion tracking** - see which conversions you've achieved
- **Fair attribution** - contributing agents get recognition

### **For Business**
- **Complete conversion funnel** - track every successful outcome
- **Agent performance insights** - who's converting and contributing
- **Commission accuracy** - proper attribution for payouts
- **Simplified operations** - no complex time-based aging

### **For System**
- **Simpler logic** - event-based only, easier to understand and debug
- **Better performance** - no hourly aging calculations needed
- **Clear audit trail** - every conversion properly documented

---

## 🎯 **Success Metrics**

### **Immediate (Day 1)**
- ✅ Callbacks appear first in agent queues
- ✅ Fresh users get score 0 priority
- ✅ Conversion outcomes create proper records

### **Week 1**
- ✅ Agent conversion dashboard showing results
- ✅ No complaints about stale leads
- ✅ Simplified queue management

### **Month 1**  
- ✅ Complete conversion analytics
- ✅ Agent performance insights
- ✅ Commission calculation accuracy

---

Your updated system now perfectly matches your clarified requirements: **callbacks within queues**, **event-based scoring only**, and **comprehensive conversion tracking with agent attribution**! 🚀 