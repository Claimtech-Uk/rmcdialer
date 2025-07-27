# 🚀 Production Deployment Checklist - Enhanced Queue System

## ✅ **Pre-Deployment (COMPLETED)**
- [x] Enhanced queue generation services implemented
- [x] 2-hour cooling period + newest-first ordering added
- [x] Dynamic auto-regeneration system built
- [x] All code committed and pushed to main branch
- [x] Local testing successful (100 eligible users found)
- [x] Build tests passed

---

## 🎯 **PRODUCTION DEPLOYMENT STEPS**

### **Step 1: Database Backup & Migration** ⚠️ CRITICAL
```bash
# 1.1 Backup production database
pg_dump $PRODUCTION_DATABASE_URL > backup-before-queue-migration-$(date +%Y%m%d_%H%M%S).sql

# 1.2 Run the database migration
psql $PRODUCTION_DATABASE_URL < prisma/migrations/001_create_separated_queues.sql

# 1.3 Verify tables were created
psql $PRODUCTION_DATABASE_URL -c "\dt *queue*"
psql $PRODUCTION_DATABASE_URL -c "SELECT COUNT(*) FROM unsigned_users_queue;"
psql $PRODUCTION_DATABASE_URL -c "SELECT COUNT(*) FROM outstanding_requests_queue;"
```

### **Step 2: Deploy Code to Production** 
```bash
# 2.1 Deploy via your normal process (Vercel/Docker/etc.)
# Code is already pushed to main branch

# 2.2 Verify deployment successful
curl -I https://your-production-domain.com/api/health/queues

# 2.3 Check new endpoints are available
curl -I https://your-production-domain.com/api/cron/populate-separated-queues
curl -I https://your-production-domain.com/api/cron/queue-level-check
```

### **Step 3: Production Testing**
```bash
# 3.1 Test enhanced queue generation
curl -X GET https://your-production-domain.com/api/cron/populate-separated-queues

# 3.2 Test queue level monitoring  
curl -X GET https://your-production-domain.com/api/cron/queue-level-check

# 3.3 Health check
curl -X POST https://your-production-domain.com/api/cron/queue-level-check \
  -H "Content-Type: application/json" \
  -d '{"action": "healthCheck"}'

# 3.4 Verify queue data in database
psql $PRODUCTION_DATABASE_URL -c "SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM unsigned_users_queue;"
psql $PRODUCTION_DATABASE_URL -c "SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM outstanding_requests_queue;"
```

### **Step 4: Configure Production Cron Jobs**
```bash
# 4.1 Add to your production cron scheduler:

# Queue level monitoring (every 5 minutes)
*/5 * * * * curl -s -X GET https://your-production-domain.com/api/cron/queue-level-check >> /var/log/queue-monitor.log 2>&1

# Full hourly refresh (backup/safety net)
0 * * * * curl -s -X GET https://your-production-domain.com/api/cron/populate-separated-queues >> /var/log/queue-generation.log 2>&1

# 4.2 Verify cron jobs are scheduled
crontab -l | grep queue
```

### **Step 5: Enable Enhanced Features**
```bash
# 5.1 Feature flags are already enabled in the code:
# USE_SEPARATED_QUEUES=true
# USE_NEW_QUEUE_SERVICES=true  
# MIGRATION_MODE='new-only'

# 5.2 Verify feature flags via API
curl -X POST https://your-production-domain.com/api/cron/queue-level-check \
  -d '{"action": "healthCheck"}' | jq '.health.config'
```

### **Step 6: Monitor First Production Run**
```bash
# 6.1 Watch the first queue generation
curl -X GET https://your-production-domain.com/api/cron/populate-separated-queues | jq

# 6.2 Check for users in queues
psql $PRODUCTION_DATABASE_URL -c "
SELECT 
  'unsigned_users' as queue_type, 
  COUNT(*) as total_users,
  MIN(created_at) as oldest_entry,
  MAX(created_at) as newest_entry
FROM unsigned_users_queue
UNION ALL
SELECT 
  'outstanding_requests' as queue_type,
  COUNT(*) as total_users, 
  MIN(created_at) as oldest_entry,
  MAX(created_at) as newest_entry  
FROM outstanding_requests_queue;"

# 6.3 Verify enhanced ordering (newest first for tied scores)
psql $PRODUCTION_DATABASE_URL -c "
SELECT priority_score, created_at, queue_position 
FROM unsigned_users_queue 
ORDER BY priority_score, queue_position 
LIMIT 10;"
```

### **Step 7: Validate Queue Quality**
```bash
# 7.1 Check 2-hour cooling period is working
psql $PRODUCTION_DATABASE_URL -c "
SELECT 
  COUNT(*) as total_in_user_call_scores,
  COUNT(CASE WHEN created_at <= NOW() - INTERVAL '2 hours' THEN 1 END) as eligible_after_cooling,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '2 hours' THEN 1 END) as blocked_by_cooling
FROM user_call_scores 
WHERE current_queue_type = 'unsigned_users' AND is_active = true;"

# 7.2 Verify newest-first ordering within same scores
psql $PRODUCTION_DATABASE_URL -c "
SELECT priority_score, COUNT(*) as users_at_score
FROM unsigned_users_queue 
GROUP BY priority_score 
ORDER BY priority_score;"
```

---

## 🚨 **Rollback Plan (If Needed)**

### **Emergency Rollback Steps**:
```bash
# 1. Disable new queues via feature flags
export USE_SEPARATED_QUEUES=false
export MIGRATION_MODE='off'

# 2. Remove new cron jobs
crontab -l | grep -v queue-level-check | crontab -

# 3. Restore database if needed (LAST RESORT)
psql $PRODUCTION_DATABASE_URL < backup-before-queue-migration-YYYYMMDD_HHMMSS.sql
```

---

## 📊 **Success Metrics**

### **Expected Results After Deployment**:
- ✅ **Queue Population**: 50-100+ users in unsigned_users_queue
- ✅ **Enhanced Ordering**: Newest users first for tied scores
- ✅ **Cooling Period**: No users < 2 hours old in queues  
- ✅ **Auto-Regeneration**: Triggers when queues < 20 users
- ✅ **Performance**: Queue generation < 30 seconds
- ✅ **Agent Experience**: Never run out of users to call

### **Monitoring Commands**:
```bash
# Check queue levels
curl -s https://your-production-domain.com/api/cron/queue-level-check | jq '.summary'

# Check queue generation health  
curl -s https://your-production-domain.com/api/cron/populate-separated-queues | jq '.health'

# Database queue stats
psql $PRODUCTION_DATABASE_URL -c "
SELECT 
  'Total Queued Users' as metric,
  (SELECT COUNT(*) FROM unsigned_users_queue) + 
  (SELECT COUNT(*) FROM outstanding_requests_queue) as value;"
```

---

## ✅ **Post-Deployment Tasks**

### **After 24 Hours**:
- [ ] Monitor queue levels are stable (>20 users)
- [ ] Verify auto-regeneration triggers correctly
- [ ] Confirm agent feedback on lead quality
- [ ] Check system performance metrics

### **After 1 Week**:
- [ ] Remove deprecated services (QueueGenerationService, PreCallValidationService)
- [ ] Clean up old documentation files
- [ ] Update monitoring dashboards

---

## 🎯 **READY FOR DEPLOYMENT!**

**The enhanced queue system is fully tested and ready for production.** 

Execute the steps above in order, monitoring carefully at each stage.

**Expected outcome**: Significantly improved lead quality with newer leads prioritized, proper 2-hour cooling period, and never-ending queue availability for agents! 🚀 