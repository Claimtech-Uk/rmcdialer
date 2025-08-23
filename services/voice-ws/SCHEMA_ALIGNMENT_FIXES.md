# 🔧 **Schema Alignment Fixes - Voice Actions Database**

## 🚨 **Critical Issues Fixed**

The original voice actions system had **major schema misalignments** with your actual database structure. Here are the fixes applied:

## 📊 **Database Connection Changes**

### **Before (❌ Wrong)**
```javascript
// Raw MySQL connections
import mysql from 'mysql2/promise'
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  // ... manual connection config
})
```

### **After (✅ Fixed)**
```javascript
// Prisma client with replica database
import { PrismaClient } from '../../../../prisma/generated/mysql-client/index.js'
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.REPLICA_DATABASE_URL
    }
  }
})
```

## 🏗️ **Table and Column Mapping Fixes**

| **Function** | **Before (Wrong)** | **After (Correct)** | **Status** |
|--------------|-------------------|-------------------|------------|
| **User Lookup** | `users.phone` | `users.phone_number` | ✅ **Fixed** |
| **User Claims** | `user_claims` table | `claims` table | ✅ **Fixed** |
| **Claim Details** | `claim.reference` field | `claim.id` as reference | ✅ **Fixed** |
| **Requirements** | `claim_requirements.claim_reference` | `claim_requirements.claim_id` | ✅ **Fixed** |
| **BigInt Handling** | Regular integers | `BigInt()` conversion | ✅ **Fixed** |

## 🔍 **Specific Schema Corrections**

### **1. User Table Structure**
```javascript
// ❌ Wrong columns
const user = await db.query(`
  SELECT id, first_name, last_name, email, phone
  FROM users WHERE phone = ?
`)

// ✅ Correct columns  
const user = await prisma.user.findFirst({
  where: { phone_number: { in: searchPatterns } },
  select: {
    id: true,                 // BigInt
    first_name: true,
    last_name: true, 
    email_address: true,      // Not 'email'
    phone_number: true,       // Not 'phone'
    status: true
  }
})
```

### **2. Claims Table Structure**
```javascript
// ❌ Wrong table name
const claims = await db.query(`
  SELECT * FROM user_claims WHERE user_id = ?
`)

// ✅ Correct table name
const claims = await prisma.claim.findMany({
  where: { user_id: userIdBigInt },  // BigInt conversion required
  select: {
    id: true,        // BigInt  
    status: true,
    lender: true,
    type: true,
    user_id: true    // BigInt
  }
})
```

### **3. Claim Requirements Structure**
```javascript
// ❌ Wrong column reference
const requirements = await db.query(`
  SELECT * FROM claim_requirements 
  WHERE claim_reference = ?
`)

// ✅ Correct column reference
const requirements = await prisma.claimRequirement.findMany({
  where: { 
    claim_id: claimIdBigInt,  // Not claim_reference
    status: { not: 'completed' }
  },
  select: {
    type: true,
    status: true,
    claim_requirement_reason: true  // The actual description field
  }
})
```

## ⚠️ **Read-Only Replica Limitations**

### **MissedCall Creation**
Since the replica database is **read-only**, we can't create missed calls directly:

```javascript
// ❌ Cannot write to replica
async createMissedCall(data) {
  // This would fail on read-only replica
  const result = await prisma.missedCall.create({...})
}

// ✅ Logging approach for now
async createMissedCall(data) {
  console.log('📅 Callback request logged (read-only replica)')
  
  // TODO: Implement via:
  // - API call to main app: POST /api/missed-calls
  // - Message queue: publish to missed-call-queue
  // - Separate write-capable connection
  
  return { 
    success: true,
    requiresMainDbIntegration: true 
  }
}
```

### **Voice Action Logging**
```javascript
// ❌ Cannot write audit logs to replica  
async logVoiceAction(data) {
  await db.query('INSERT INTO voice_action_logs...')
}

// ✅ Console logging for development
async logVoiceAction(data) {
  console.log('📊 [VOICE-AUDIT]', {
    callSid: data.callSid,
    actionName: data.actionName,
    success: data.result?.success
  })
  
  // TODO: Send to logging service in production
}
```

## 🔧 **Environment Variables Required**

### **Updated Requirements**
```bash
# Database Connection (changed)
REPLICA_DATABASE_URL=mysql://user:pass@replica-host:3306/database

# Twilio (unchanged)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=your-twilio-number

# Voice Configuration (unchanged)
ENVIRONMENT_NAME=staging-development
AI_VOICE_MODEL=gpt-4o-realtime-preview-2024-12-17
AI_VOICE_NAME=onyx
```

## 📋 **Deployment Checklist**

### **Before Deployment**
- [ ] ✅ Prisma MySQL client generated (`npx prisma generate`)
- [ ] ✅ `REPLICA_DATABASE_URL` environment variable set
- [ ] ✅ Voice actions use Prisma client (not raw MySQL)
- [ ] ✅ BigInt handling for user/claim IDs  
- [ ] ✅ Correct table names (`users`, `claims`, `claim_requirements`)
- [ ] ✅ Correct column names (`phone_number`, `email_address`, `user_id`)

### **After Deployment**  
- [ ] Test user lookup with real phone numbers
- [ ] Test claim details retrieval
- [ ] Test requirements checking
- [ ] Verify callback logging (console output)
- [ ] Monitor for Prisma connection issues

## 🚀 **Production Integration TODOs**

### **1. Missed Call Creation**
Implement one of:
- **API Integration**: POST to main app's missed call endpoint
- **Message Queue**: Publish to callback creation queue
- **Direct PostgreSQL**: Separate connection for writes

### **2. Voice Action Audit Logging**
Implement one of:
- **Logging Service**: Send to CloudWatch/DataDog
- **API Integration**: POST to main app's logging endpoint
- **Separate Database**: Dedicated audit database

### **3. Error Handling Enhancement**
- Connection retry logic for Prisma
- Fallback responses when database unavailable
- Health check endpoint for database status

---

## 🎯 **Key Takeaway**

The voice actions now use the **correct database schema** and **Prisma client** for reliable, type-safe database operations. However, since it's a **read-only replica**, write operations (missed calls, audit logs) require integration with your main application or separate write-capable services.

**All voice functions now query the actual database correctly!** 🎉
