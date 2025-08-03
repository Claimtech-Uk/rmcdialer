# 🚀 Quick Start Guide - Phase 1 Enhanced Agent Availability

## **TL;DR - What We Built**

✅ **Real-time agent heartbeat system** - Agents ping server every 30s to prove they're online  
✅ **Device connectivity validation** - Check if agents can actually receive calls  
✅ **Enhanced agent discovery** - Smart agent selection with readiness scoring  
✅ **Fallback mechanisms** - Graceful degradation if enhanced features fail  

---

## **🔧 To Deploy Phase 1**

### **1. Database Update (Required)**
```bash
# Option A: Run our migration script
psql -d your_database < scripts/add-agent-heartbeat-fields.sql

# Option B: Use Prisma (if you prefer)
npx prisma db push
```

### **2. Enable Features (Gradual Rollout)**
```bash
# Start with heartbeat only
export FEATURE_AGENT_HEARTBEAT=true

# After testing, enable device connectivity  
export FEATURE_DEVICE_CONNECTIVITY=true

# Finally enable enhanced discovery
export FEATURE_ENHANCED_DISCOVERY=true
```

### **3. Frontend Integration (Next Sprint)**
Agents need to send heartbeats - add this to your agent dashboard:
```javascript
// Send heartbeat every 30 seconds
setInterval(() => {
  fetch('/api/agent-heartbeat', {
    method: 'POST',
    body: JSON.stringify({
      agentId: currentUser.id,
      deviceConnected: true
    })
  });
}, 30000);
```

---

## **🔍 How to Test**

### **Verify It's Working**
```bash
# Check agent heartbeat status
curl "https://your-domain.com/api/agent-heartbeat"

# Should return something like:
{
  "success": true,
  "stats": {
    "totalAgents": 5,
    "onlineAgents": 3,
    "availableAgents": 2
  }
}
```

### **Test Enhanced Discovery**
1. Have an agent log in and send heartbeats
2. Make an inbound call
3. Check logs for "🔍 Using enhanced agent discovery"
4. Verify agent gets the call

---

## **🚨 Troubleshooting**

### **Build Errors**
- ✅ **Already Fixed**: Schema updated, TypeScript errors resolved
- ✅ **Already Fixed**: Prisma client regenerated

### **Feature Not Working**
```bash
# Check if feature flags are enabled
echo $FEATURE_AGENT_HEARTBEAT
echo $FEATURE_ENHANCED_DISCOVERY

# Check logs for enhanced discovery
tail -f logs/combined.log | grep "enhanced agent discovery"
```

### **Agents Not Showing Online**
1. Verify agents are sending heartbeats to `/api/agent-heartbeat`
2. Check database: `SELECT * FROM agent_sessions WHERE last_heartbeat IS NOT NULL`
3. Verify feature flag: `FEATURE_AGENT_HEARTBEAT=true`

---

## **📊 What to Monitor**

### **Key Metrics**
- **Agent availability accuracy** - Are "available" agents actually answering?
- **Call connection rate** - Did inbound calls reach agents successfully?
- **Heartbeat response rate** - Are agents consistently sending heartbeats?

### **Alerts to Set Up**
- ⚠️ **No agents online** for >5 minutes during business hours
- ⚠️ **Heartbeat failure rate** >10%
- ⚠️ **Enhanced discovery failures** >5%

---

## **🎯 Success = Ready for Phase 2**

**Green Light Criteria:**
- ✅ Agents sending heartbeats consistently
- ✅ Enhanced discovery working >95% of the time  
- ✅ Call connection rate improved vs. baseline
- ✅ No performance degradation

**Once Phase 1 is stable → Start Phase 2: Queue System**

---

## **🆘 Need Help?**

**Common Issues:**
1. **"Enhanced discovery disabled"** → Check feature flags
2. **"No candidate agents found"** → Verify agents are logged in with status='available'
3. **"Validation failed"** → Check heartbeat timing and device connectivity

**Debug Mode:**
```bash
export INBOUND_CALL_DEBUG=true
# Will show detailed logs for agent discovery process
```