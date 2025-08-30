# 🔧 **Corrected Hume Tool Definitions - No Phone Required**

Since we now **automatically use the phone number from the call context**, update these in your Hume Dashboard:

## ✅ **Tool 1: check_user_details** (CORRECTED)
```json
{
  "name": "check_user_details",
  "description": "Look up the caller's information using their phone number from the call",
  "parameters": {
    "type": "object",
    "properties": {
      "claim_reference": {
        "type": "string",
        "description": "Optional claim reference for additional context"
      }
    },
    "required": []
  }
}
```
**KEY CHANGE:** ❌ Removed `phone_number` from required fields - we get it from the call!

## ✅ **Tool 2: send_portal_link** (Already Correct)
```json
{
  "name": "send_portal_link",
  "description": "Send a secure portal link via SMS to the caller's phone",
  "parameters": {
    "type": "object",
    "properties": {
      "method": {
        "type": "string",
        "description": "Always use 'sms' for voice calls"
      },
      "link_type": {
        "type": "string",
        "description": "Type of portal: 'claims', 'documents', or 'status'"
      }
    },
    "required": ["method"]
  }
}
```
**NO CHANGE NEEDED:** Already doesn't require phone number

## ✅ **Tool 3: schedule_callback** (Already Correct)
```json
{
  "name": "schedule_callback",
  "description": "Schedule a callback to the caller's phone",
  "parameters": {
    "type": "object",
    "properties": {
      "preferred_time": {
        "type": "string",
        "description": "When the customer wants to be called back"
      },
      "reason": {
        "type": "string",
        "description": "Why they need a callback"
      }
    },
    "required": ["preferred_time"]
  }
}
```
**NO CHANGE NEEDED:** Already uses caller's phone automatically

## ✅ **Tool 4: check_claim_details** (No Phone Needed)
```json
{
  "name": "check_claim_details",
  "description": "Get detailed information about a specific claim",
  "parameters": {
    "type": "object",
    "properties": {
      "claim_reference": {
        "type": "string",
        "description": "The claim reference number or ID"
      }
    },
    "required": ["claim_reference"]
  }
}
```

---

## 🚨 **CRITICAL UPDATE NEEDED**

### **Old (Incorrect)**
```json
// check_user_details
"required": ["phone_number"]  // ❌ WRONG
```

### **New (Correct)**
```json
// check_user_details
"required": []  // ✅ CORRECT - Phone comes from call
```

## 📋 **How to Update in Hume Dashboard**

1. **Log into Hume**: https://dev.hume.ai
2. **Find your EVI Config** (matching your `HUME_CONFIG_ID`)
3. **Go to Tools/Functions section**
4. **Find `check_user_details`**
5. **Update the parameters** to remove `phone_number` from required
6. **Save the configuration**

## 🎯 **Why This Matters**

Without this update:
- ❌ Hume might try to pass `phone_number` parameter
- ❌ Could cause errors or confusion
- ❌ AI might ask for phone number unnecessarily

With this update:
- ✅ Automatic phone usage from call context
- ✅ No redundant questions
- ✅ Smooth conversation flow

---

**Remember:** The phone number is ALWAYS available from `this.callerContext.phone` in PartyKit!
