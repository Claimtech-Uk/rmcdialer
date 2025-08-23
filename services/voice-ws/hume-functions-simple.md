# 🎭 **Hume EVI Functions - Simplified Format (No Enums)**

Try these simplified versions if the enum arrays are causing issues:

## **Function 1: schedule_callback**
```json
{
  "name": "schedule_callback",
  "description": "Schedule a callback for the customer at their preferred time",
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

## **Function 2: check_user_details**
```json
{
  "name": "check_user_details",
  "description": "Look up customer information and claims status by phone number",
  "parameters": {
    "type": "object",
    "properties": {
      "phone_number": {
        "type": "string",
        "description": "Customer phone number to lookup"
      }
    },
    "required": ["phone_number"]
  }
}
```

## **Function 3: send_portal_link**
```json
{
  "name": "send_portal_link",
  "description": "Send a secure portal access link to the customer via SMS",
  "parameters": {
    "type": "object",
    "properties": {
      "method": {
        "type": "string",
        "description": "How to send the link (sms or email)"
      }
    },
    "required": ["method"]
  }
}
```

## **Function 4: check_claim_details**
```json
{
  "name": "check_claim_details",
  "description": "Get detailed information about a specific claim by reference number",
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

## 🔧 **What I Changed:**
1. **Removed `enum` arrays** - these might not be supported by Hume
2. **Simplified descriptions** - made them more concise
3. **Reduced optional parameters** - kept only essential ones
4. **Validated JSON syntax** - confirmed all are syntactically correct

## 📝 **Try This Approach:**
1. **Start with just 1-2 functions** to test if Hume accepts the format
2. **Use the simplified versions above**
3. **Add functions one at a time** rather than all at once
4. **If these work, add the remaining functions**

## 🚨 **Alternative Format (If Above Fails):**
Some APIs expect the schema without the outer `parameters` wrapper:

```json
{
  "name": "schedule_callback",
  "description": "Schedule a callback for the customer at their preferred time",
  "type": "object",
  "properties": {
    "preferred_time": {
      "type": "string",
      "description": "When the customer wants to be called back"
    }
  },
  "required": ["preferred_time"]
}
```

Try the main format first, then this alternative if needed!
