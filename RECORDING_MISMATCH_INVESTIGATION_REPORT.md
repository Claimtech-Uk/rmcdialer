# 🎙️ Twilio Recording Webhook Call Session Mismatch Investigation Report

**Investigation Date**: July 30, 2025  
**Issue**: Twilio call recordings are not finding the call session, causing recording metadata to fail to save to the database

## 🔍 **Root Cause Analysis**

### **Issue #1: Prisma Model Naming Error**
**Location**: `app/api/webhooks/twilio/recording/route.ts` (Lines 42, 85)  
**Problem**: Code uses `prisma.callSession` but should use `prisma.call_sessions` (snake_case)
```javascript
// ❌ CURRENT (BROKEN)
const callSession = await prisma.callSession.findFirst({
  where: { twilioCallSid: CallSid }
});

// ✅ SHOULD BE
const callSession = await prisma.call_sessions.findFirst({
  where: { twilioCallSid: CallSid }
});
```
**Impact**: All recording webhook calls fail with Prisma errors

### **Issue #2: Call SID Mismatch for Inbound Calls** 🚨 **CRITICAL**
**Location**: Recording webhook lookup logic  
**Problem**: For inbound calls with `<Dial><Client>`, Twilio creates **separate call legs**:
- **Original Call SID** (stored in DB): `CAf5af23956df181ca57ecf5034a4fd867`
- **Agent Call SID** (webhook receives): `layout-c86ba49b305af_YLSCyPMKUFeCKdwdb-1`

**Evidence**: Call-status webhook already handles this (lines 54-57):
```javascript
// CRITICAL FIX: Enhanced call session lookup to handle multiple Call SIDs
// For inbound calls with <Dial><Client>, Twilio creates separate call legs:
// - Original Call SID (stored in database): CAf5af23956df181ca57ecf5034a4fd867
// - Agent Call SID (from webhook): layout-c86ba49b305af_YLSCyPMKUFeCKdwdb-1
```

**Impact**: Recording webhooks for inbound calls **always fail** to find the session

### **Issue #3: Missing Fallback Lookup Logic**
**Location**: Recording webhook vs Call-status webhook  
**Problem**: Call-status webhook has sophisticated fallback logic (lines 75-108), but recording webhook doesn't:

**Call-Status Webhook Has**:
- Primary lookup by CallSid
- Secondary lookup for recent inbound sessions (last 5 minutes)
- Detailed logging and diagnostics
- Graceful fallback handling

**Recording Webhook Missing**:
- Any fallback logic
- Alternative lookup strategies
- Diagnostic logging
- Session mapping capabilities

### **Issue #4: Insufficient Diagnostic Logging**
**Location**: Recording webhook error handling  
**Problem**: When recording webhook fails, there's minimal diagnostic information to troubleshoot:
- No SID mismatch detection
- No alternative lookup attempts
- No detailed call context logging

## 📊 **Impact Assessment**

### **Affected Operations**:
- ❌ **All inbound call recordings** - Recording metadata not saved to database
- ❌ **Call compliance tracking** - Missing recording URLs and duration
- ❌ **Agent performance monitoring** - No recording data for analytics  
- ❌ **Customer service quality** - No recording links for review

### **Data Loss Risk**:
- 🔴 **HIGH**: Recording files exist in Twilio but metadata is lost
- 🟡 **MEDIUM**: Recordings can be recovered manually but require Twilio API calls
- 🟢 **LOW**: No actual audio data loss (files safely stored in Twilio/R2)

## 🔧 **Recommended Fixes**

### **Priority 1: Fix Prisma Model Name**
```javascript
// Fix Lines 42, 85 in recording/route.ts
await prisma.call_sessions.findFirst(...)
await prisma.call_sessions.update(...)
```

### **Priority 2: Implement Enhanced Call Session Lookup**
Add the same sophisticated lookup logic from call-status webhook:
1. Primary lookup by CallSid
2. Fallback to recent inbound session mapping
3. Agent call leg SID handling
4. Comprehensive logging

### **Priority 3: Add Diagnostic Logging**
- Log all incoming CallSids
- Track lookup attempts and results
- Record SID mismatch scenarios
- Enable debugging for failed lookups

### **Priority 4: Create Recording Recovery Tool**
- Script to find "orphaned" recordings in Twilio
- Match recordings to call sessions by timing and phone numbers
- Backfill missing recording metadata

## 🚀 **Implementation Plan**

### **Phase 1: Emergency Fix (Immediate)**
1. Fix Prisma model naming errors
2. Deploy critical fix to stop webhook failures

### **Phase 2: Enhanced Lookup (Same Day)**  
1. Port fallback logic from call-status webhook
2. Add comprehensive logging
3. Test with inbound call scenarios

### **Phase 3: Recovery & Monitoring (Next Day)**
1. Create recording recovery script for historical data
2. Add monitoring dashboard for recording webhook health
3. Implement alerting for future mismatches

## 🔍 **Testing Strategy**

### **Test Scenarios**:
1. **Inbound call with agent answer** - Primary test case
2. **Inbound call with agent busy/no-answer** - Edge case
3. **Outbound call recording** - Control case  
4. **Multiple agents dialed** - Complex scenario

### **Success Criteria**:
- ✅ All recording webhooks find correct call session
- ✅ Recording metadata saved to database  
- ✅ No 404 errors in webhook logs
- ✅ R2/cloud storage uploads successful

## 📋 **Monitoring & Alerts**

### **Add Health Checks**:
- Recording webhook success rate
- Call session match rate
- Failed recording lookup alerts
- Daily recording metadata completeness report

---

**Status**: Ready for implementation  
**Severity**: HIGH - Affects all inbound call recordings  
**Estimated Fix Time**: 2-4 hours  
**Risk**: LOW - Changes isolated to webhook handler 