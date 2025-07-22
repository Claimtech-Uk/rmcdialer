# 🔍 Inbound Call Flow Diagnostic Report

## Problem Summary
**Issue**: Inbound calls reach the automated agent but cannot connect to human agents.
**Symptoms**: Callers get the automated response but calls don't reach agents.

---

## 📞 Complete Inbound Call Flow Analysis

### **Step 1: Twilio Webhook Entry Point**
```
Inbound Call → Twilio → POST /api/webhooks/twilio/voice/route.ts
```
- ✅ **WORKING**: Automated agent response is playing (this confirms webhook is working)
- ✅ **WORKING**: Call routing logic identifies inbound calls correctly

### **Step 2: Agent Discovery Query**
```sql
-- This is the critical query that finds available agents
SELECT * FROM agent_sessions 
WHERE status = 'available' 
  AND logout_at IS NULL 
  AND agent.is_active = true
ORDER BY last_activity ASC
LIMIT 1;
```

**CRITICAL REQUIREMENTS:**
1. Agent must be **logged into the system**
2. Agent session status must be **'available'** (not 'offline', 'break', or 'on_call')
3. Agent session must have **logoutAt = null**
4. Agent record must have **isActive = true**

### **Step 3: Twilio Client Identity Generation**
```typescript
const agentClientName = `agent_${validatedAgent.agentId}`;
// Example: "agent_123" for agent ID 123
```

### **Step 4: TwiML Dial Command**
```xml
<Dial timeout="30">
    <Client>agent_123</Client>
</Dial>
```

---

## 🚨 Most Likely Issues (In Order of Probability)

### **1. NO AGENTS WITH STATUS 'AVAILABLE'** ⭐ MOST LIKELY
**Problem**: Agents are logged in but their session status is not set to 'available'

**Check:**
```sql
-- Run this query to see current agent sessions
SELECT 
    s.id,
    s.agent_id,
    s.status,
    s.logout_at,
    s.last_activity,
    a.first_name,
    a.last_name,
    a.email,
    a.is_active
FROM agent_sessions s
JOIN agents a ON s.agent_id = a.id
WHERE s.logout_at IS NULL
ORDER BY s.last_activity DESC;
```

**Fix**: Ensure agents' status is set to 'available' when they log in.

### **2. TWILIO DEVICE NOT REGISTERED** ⭐ VERY LIKELY  
**Problem**: Agents exist in database but haven't registered their Twilio devices

**What Should Happen:**
1. Agent logs into web interface
2. Browser loads Twilio Voice SDK
3. Device registers with identity `agent_{agentId}`
4. Device stays connected and listening

**Check**: Have agents open browser console and look for:
- ✅ `"Twilio Device ready"` message
- ❌ Any Twilio connection errors

### **3. ACCESS TOKEN ISSUES**
**Problem**: Twilio access tokens aren't being generated correctly

**Check Access Token Generation:**
```bash
# Test token generation for agent ID 1
curl -X POST https://rmcdialer.vercel.app/api/twilio/access-token \
  -H "Content-Type: application/json" \
  -d '{"agentId": "1", "agentEmail": "agent@example.com"}'
```

**Expected Response:**
```json
{
  "success": true,
  "accessToken": "eyJ...",
  "development": false,
  "agentId": "1"
}
```

### **4. AGENT ID FORMAT MISMATCH**
**Problem**: Mismatch between database agent ID and Twilio client identity

**Critical Chain:**
```
Database Agent ID: 123
↓
Agent Session agentId: 123  
↓
Twilio Client Identity: "agent_123"
↓
TwiML Dial: <Client>agent_123</Client>
```

**Any break in this chain will cause call failures.**

---

## 🔧 Immediate Troubleshooting Steps

### **Step 1: Check Agent Availability (PRIORITY)**
1. Log into admin panel or run database query
2. Verify agents have active sessions with status 'available'
3. If not available, have agents log in again

### **Step 2: Verify Device Registration**
1. Have agent open the dialler app in browser
2. Check browser console for Twilio Device messages
3. Look for "Twilio Device ready" confirmation
4. Test with browser developer tools network tab

### **Step 3: Test Access Token**
1. Use the curl command above to test token generation
2. Verify tokens are being created successfully
3. Check for any Twilio credential issues

### **Step 4: Test Complete Flow**
1. Ensure at least one agent is 'available'
2. Have agent confirm device is registered
3. Make test inbound call
4. Monitor webhook logs for detailed error messages

---

## 📊 Key Monitoring Points

### **Agent Session Table:**
```sql
-- Monitor this query for available agents
SELECT COUNT(*) as available_agents
FROM agent_sessions s
JOIN agents a ON s.agent_id = a.id
WHERE s.status = 'available' 
  AND s.logout_at IS NULL 
  AND a.is_active = true;
```

### **Recent Inbound Call Status:**
```sql
-- Check recent inbound call outcomes
SELECT 
    status,
    COUNT(*) as count,
    (COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()) as percentage
FROM call_sessions 
WHERE direction = 'inbound' 
  AND started_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

---

## 🎯 Quick Fix Checklist

- [ ] **At least one agent logged in with status 'available'**
- [ ] **Agent has opened dialler app in browser**  
- [ ] **Browser console shows "Twilio Device ready"**
- [ ] **Access tokens generating successfully**
- [ ] **No Twilio credential errors**
- [ ] **Webhook receiving inbound calls correctly**

---

## 🚀 Production Testing Commands

### Test Agent Setup:
```bash
# Test specific agent setup (replace with actual agent ID)
curl -X POST https://rmcdialer.vercel.app/api/test-agent-twilio-setup \
  -H "Content-Type: application/json" \
  -d '{"agentId": 1}'
```

### Monitor Webhook Logs:
```bash
# Check Vercel function logs for webhook details
vercel logs --app=rmcdialer --limit=50
```

---

## 💡 Next Steps

1. **Immediate**: Check agent availability status in database
2. **Quick**: Have available agents refresh browser and check console
3. **Testing**: Make test inbound call with monitoring
4. **Long-term**: Set up alerts for when no agents are available

The most common issue is agents being logged in but not having 'available' status, or Twilio devices not being properly registered in the browser. 