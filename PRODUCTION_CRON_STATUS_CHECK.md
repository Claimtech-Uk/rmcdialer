# 🔍 Production Cron Status Check & Fix Plan

## 📊 **Current Status Analysis**

### **✅ Cron Jobs Now Configured**
The `vercel.json` has been updated with all critical cron jobs:

| Cron Job | Schedule | Status | Purpose |
|----------|----------|--------|---------|
| `callback-notifications` | Every minute | ✅ Active | Process user callbacks |
| `queue-level-check` | Every 5 minutes | 🆕 **ADDED** | **Auto-regeneration (CRITICAL)** |
| `signature-conversion-cleanup` | Hourly (0 min) | ✅ Active | Clean signature conversion |
| `smart-new-users-discovery` | Hourly (5 min) | ✅ Active | Discover new users |
| `outstanding-requirements-conversion-cleanup` | Hourly (10 min) | ✅ Active | Clean outstanding reqs |
| `discover-new-requirements` | Hourly (15 min) | ✅ Active | Find new requirements |
| `scoring-maintenance` | Hourly (20 min) | 🆕 **ADDED** | **Maintain user scores** |
| `populate-separated-queues` | Hourly (30 min) | ✅ Active | Full queue refresh |
| `daily-cleanup` | Daily at 2 AM | 🆕 **ADDED** | **Database cleanup** |

### **🚨 Critical Issues to Fix**

#### **1. Domain & Authentication Issues**
- **Production URL**: `https://rmcdialer.vercel.app` (requires Vercel auth)
- **Custom Domain**: `https://dialler.resolvemyclaim.co.uk` (NOT WORKING)
- **Cron Authentication**: May fail due to auth requirements

#### **2. Deployment Required**
- Updated `vercel.json` needs to be deployed to production
- Missing cron jobs won't run until deployment

## 🔧 **Immediate Action Plan**

### **Step 1: Deploy Updated Configuration**
```bash
# Deploy to production (via main branch)
git add vercel.json
git commit -m "fix: add missing critical cron jobs (queue-level-check, scoring-maintenance, daily-cleanup)"
git push origin main
# Vercel will auto-deploy from main branch
```

### **Step 2: Verify Cron Endpoints Work**
```bash
# Test critical endpoints (may require auth bypass for crons)
curl -X GET "https://rmcdialer.vercel.app/api/cron/queue-level-check"
curl -X GET "https://rmcdialer.vercel.app/api/cron/scoring-maintenance" 
curl -X GET "https://rmcdialer.vercel.app/api/cron/daily-cleanup"
```

### **Step 3: Fix Custom Domain**
Either:
- **Option A**: Configure `dialler.resolvemyclaim.co.uk` in Vercel project settings
- **Option B**: Update all documentation to use `rmcdialer.vercel.app`

### **Step 4: Fix Authentication for Crons**
Cron jobs should bypass authentication. Check:
- Cron endpoints don't require auth middleware
- Or add cron-specific auth bypass

## 🔍 **Verification Commands**

### **After Deployment, Test Each Cron:**
```bash
# Test queue monitoring (most critical)
curl -s "https://rmcdialer.vercel.app/api/cron/queue-level-check" | grep -E "(success|error)"

# Test scoring maintenance
curl -s "https://rmcdialer.vercel.app/api/cron/scoring-maintenance" | grep -E "(success|error)"

# Test daily cleanup
curl -s "https://rmcdialer.vercel.app/api/cron/daily-cleanup" | grep -E "(success|error)"

# Test health check
curl -s "https://rmcdialer.vercel.app/api/cron/health" | grep -E "(status|error)"
```

### **Database Verification:**
```bash
# Check queues are being maintained
curl -s "https://rmcdialer.vercel.app/api/health/queues"

# Or check database directly if accessible
psql $PRODUCTION_DATABASE_URL -c "
SELECT 
  'unsigned_users' as queue,
  COUNT(*) as total_users,
  MAX(created_at) as latest_entry
FROM unsigned_users_queue
UNION ALL
SELECT 
  'outstanding_requests' as queue,
  COUNT(*) as total_users,
  MAX(created_at) as latest_entry
FROM outstanding_requests_queue;"
```

## 🎯 **Expected Results After Fix**

### **Auto-Regeneration Working:**
- Queue levels checked every 5 minutes
- Auto-regeneration when < 20 users
- Never empty queues for agents

### **System Maintenance:**
- User scores maintained (hourly at 20 min)
- Daily cleanup runs at 2 AM
- All systems self-healing

### **Performance:**
- Queue response times < 1 second
- Zero wrong calls maintained
- 100+ users always available

## 🚨 **Next Steps**

1. **Deploy the updated `vercel.json`** ← **DO THIS FIRST**
2. **Test cron endpoints** after deployment
3. **Fix domain/auth issues** if endpoints fail
4. **Monitor for 24 hours** to ensure all crons execute
5. **Verify queue levels remain above 20 users**

## ⚠️ **Rollback Plan**

If issues arise, revert to backup:
```bash
cp vercel.json.backup-prod vercel.json
git add vercel.json
git commit -m "rollback: revert to previous cron configuration"
git push origin main
```

---

**Status**: ⏳ **AWAITING DEPLOYMENT** - Updated cron config ready for production deployment 