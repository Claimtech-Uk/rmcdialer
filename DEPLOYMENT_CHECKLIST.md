# ✅ Production Deployment Checklist - Phase 1

## 🛡️ **PRE-DEPLOYMENT SAFETY CHECKS**

### **Database Backup & Verification**
- [ ] **Create production backup**
  ```bash
  pg_dump $PROD_DATABASE > backup_phase1_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] **Test migration on dev database**
  ```bash
  psql -d $DEV_DATABASE < scripts/add-agent-heartbeat-fields.sql
  psql -d $DEV_DATABASE < scripts/verify-migration-safety.sql
  ```
- [ ] **Verify dev migration success** (all checks pass)

### **Code Preparation**
- [ ] **Build passes without errors**
  ```bash
  npm run build
  ```
- [ ] **Feature flags configured for safe deployment**
  ```bash
  export FEATURE_AGENT_HEARTBEAT=false
  export FEATURE_ENHANCED_DISCOVERY=false
  export INBOUND_CALL_DEBUG=true
  ```
- [ ] **Staging deployment tested**

### **Team Coordination**
- [ ] **Deployment window scheduled** (recommended: off-peak hours)
- [ ] **Team notified** of deployment timeline
- [ ] **Emergency contacts** available during deployment
- [ ] **Rollback procedure** reviewed and understood

---

## 🚀 **DEPLOYMENT EXECUTION**

### **Step 1: Deploy Application (Features Disabled)**
```bash
# Deploy new code with features OFF
export FEATURE_AGENT_HEARTBEAT=false
export FEATURE_ENHANCED_DISCOVERY=false
export INBOUND_CALL_DEBUG=true

npm run build
npm run deploy  # or your deployment command
```
- [ ] **Application deployed successfully**
- [ ] **Health check passes**
  ```bash
  curl -s https://your-domain.com/health | jq .
  ```
- [ ] **Existing functionality verified** (make test call)

### **Step 2: Execute Database Migration**
```bash
# Run pre-migration verification
psql -d $PROD_DATABASE < scripts/verify-migration-safety.sql

# Execute the SAFE migration
psql -d $PROD_DATABASE < scripts/add-agent-heartbeat-fields.sql

# Run post-migration verification
psql -d $PROD_DATABASE < scripts/verify-migration-safety.sql
```
- [ ] **Migration executed without errors**
- [ ] **Record count unchanged**
- [ ] **New columns added successfully**
- [ ] **Indexes created**
- [ ] **Sample data looks correct**

### **Step 3: Enable Agent Heartbeat System**
```bash
# Enable heartbeat feature
export FEATURE_AGENT_HEARTBEAT=true
# Keep enhanced discovery disabled for now
```
- [ ] **Heartbeat feature enabled**
- [ ] **Heartbeat API endpoint responding**
  ```bash
  curl -s https://your-domain.com/api/agent-heartbeat | jq .
  ```
- [ ] **No errors in application logs**

### **Step 4: Monitor Heartbeat System (48 Hours)**
- [ ] **Monitor agent sessions for heartbeat data**
  ```sql
  SELECT COUNT(*) FROM agent_sessions WHERE last_heartbeat > NOW() - INTERVAL '1 hour';
  ```
- [ ] **Check for any performance issues**
- [ ] **Verify existing call flow unaffected**
- [ ] **No increase in error rates**

### **Step 5: Enable Enhanced Discovery (After 48 Hours)**
```bash
# Enable enhanced agent discovery
export FEATURE_ENHANCED_DISCOVERY=true
```
- [ ] **Enhanced discovery enabled**
- [ ] **Monitor call routing logs** for enhanced discovery usage
- [ ] **Verify improved agent selection** in logs
- [ ] **No call routing failures**

---

## 📊 **POST-DEPLOYMENT MONITORING**

### **Week 1: Intensive Monitoring**
- [ ] **Daily health checks**
  - Call success rates
  - Agent availability accuracy
  - Database performance
  - Error rates

- [ ] **Daily log review**
  ```bash
  # Check for enhanced discovery usage
  grep "enhanced agent discovery" logs/combined.log | tail -20
  
  # Check for heartbeat activity
  grep "Heartbeat received" logs/combined.log | tail -10
  ```

### **Week 2: Validation & Metrics**
- [ ] **Compare baseline metrics**
  - Call connection rate (target: +30%)
  - Agent availability accuracy (target: >95%)
  - Missed call reduction (target: -50%)

- [ ] **Gather agent feedback**
  - Heartbeat system impact
  - Any connectivity issues
  - Performance observations

---

## 🚨 **ROLLBACK PROCEDURES**

### **Immediate Rollback (If Issues Occur)**
```bash
# INSTANT: Disable all new features
export FEATURE_AGENT_HEARTBEAT=false
export FEATURE_ENHANCED_DISCOVERY=false

# Restart application to apply changes
pm2 restart app  # or your restart command
```
- [ ] **Features disabled**
- [ ] **System restored to original behavior**
- [ ] **Issue documented**

### **Full Rollback (If Needed)**
```bash
# Revert to previous code version
git checkout previous-stable-version
npm run build && npm run deploy

# Database: No changes needed - new columns remain but unused
```
- [ ] **Previous code version deployed**
- [ ] **System functionality restored**
- [ ] **Incident report created**

---

## ✅ **SUCCESS CRITERIA**

### **Technical Success**
- [ ] **Zero data loss** - All existing data intact
- [ ] **Zero downtime** - Service remains available
- [ ] **Enhanced features working** - Heartbeat and discovery operational
- [ ] **Performance maintained** - No degradation in response times
- [ ] **Backward compatibility** - Old code could still work if needed

### **Business Success** (Measured Over 2 Weeks)
- [ ] **Call connection rate improved** by at least 20%
- [ ] **Agent availability accuracy** above 90%
- [ ] **Customer complaints** not increased
- [ ] **Agent productivity** maintained or improved

---

## 📞 **EMERGENCY CONTACTS**

### **During Deployment Window**
- **Technical Lead**: [Your contact]
- **Database Admin**: [Your contact]
- **Product Owner**: [Your contact]

### **Escalation Thresholds**
- **5 minutes**: Technical issues not resolved
- **15 minutes**: Customer-facing impact
- **30 minutes**: Executive notification

---

## 📝 **POST-DEPLOYMENT REPORT**

### **Template for Completion**
```
Deployment Date: ___________
Deployment Duration: ___________
Issues Encountered: ___________
Rollback Required: [ ] Yes [ ] No
Features Enabled: 
  - [ ] Heartbeat System
  - [ ] Enhanced Discovery
  
Performance Impact:
  - Call Success Rate: Before: __% After: __%
  - Database Response Time: Before: __ms After: __ms
  - Error Rate: Before: __% After: __%

Next Steps:
  - [ ] Continue monitoring for 1 week
  - [ ] Gather metrics for Phase 2 planning
  - [ ] Schedule Phase 2 development
  
Team Feedback:
___________
```

---

**Remember: This checklist ensures a safe, monitored, and reversible deployment. Every step is designed to protect your production data while adding valuable new capabilities.**