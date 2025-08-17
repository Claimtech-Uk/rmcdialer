# 🎯 SMS Smart Routing - Phased Deployment Plan

## ⚠️ **Critical Insight**
We need to deploy this in **2 phases** because database schema changes must happen before TypeScript can recognize new fields.

---

## 🚀 **Phase 1: Schema Migration (Safe & Minimal)**

### **What We Deploy**
- ✅ Database schema update (adds `destination_number` field)
- ✅ Migration script and rollback capability
- ✅ Updated webhook to capture destination number
- ❌ **NO smart routing logic yet** (keeps current behavior)

### **Why This is Safe**
- New field is nullable - no breaking changes
- Current routing behavior remains unchanged
- Gives us time to validate schema update works
- Easy to rollback if any issues

### **Phase 1 Commands**
```bash
# 1. Run migration against production database
npx tsx scripts/migrate-sms-destination-number.ts

# 2. Commit ONLY schema changes
git add prisma/schema.prisma app/api/webhooks/twilio/sms/route.ts
git commit -m "feat(sms): add destination number tracking to SMS schema

- Add destinationNumber field to SmsMessage model
- Update webhook to capture original Twilio destination
- Safe nullable field - no breaking changes
- Includes migration script with rollback capability"

# 3. Deploy schema-only changes
vercel --prod --yes
```

---

## 🎯 **Phase 2: Smart Routing Logic (After Schema Validation)**

### **What We Deploy**
- ✅ Smart routing logic in batch processor
- ✅ Comprehensive testing suite
- ✅ Enhanced logging and monitoring
- ✅ Fallback mechanisms

### **Why This Approach Works**
- Database already has destination numbers captured
- TypeScript will recognize the new field
- Can test routing logic thoroughly
- Immediate rollback if routing fails

### **Phase 2 Commands**
```bash
# 1. Generate updated Prisma client
npm run db:generate

# 2. Add smart routing logic
# (routing code will work now that field exists)

# 3. Test thoroughly
npx tsx scripts/test-sms-routing.ts

# 4. Deploy routing logic
vercel --prod --yes
```

---

## 🛡️ **Safety Features**

### **Rollback Plans**
- **Phase 1 Rollback**: `npx tsx scripts/migrate-sms-destination-number.ts rollback`
- **Phase 2 Rollback**: Revert to hardcoded AI test number

### **Monitoring**
- Watch for `Smart routing analysis` logs
- Monitor for routing failures or unknown numbers
- Verify responses come from correct numbers

### **Testing Between Phases**
1. Send test SMS to both numbers
2. Verify destination numbers are captured in database
3. Confirm current routing still works
4. Only proceed to Phase 2 if Phase 1 is stable

---

## 🎯 **Current Status: Ready for Phase 1**

All components are ready:
- ✅ Migration script created
- ✅ Schema updated  
- ✅ Webhook updated to capture destinations
- ✅ Testing suite ready
- ✅ Rollback plan ready

**Recommended Action**: Deploy Phase 1 now, validate for 30 minutes, then proceed to Phase 2.
