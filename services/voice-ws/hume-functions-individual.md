# 🎭 **Hume EVI Function Definitions - Individual Format**

Copy and paste each function definition separately into Hume's dashboard:

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
      },
      "claim_reference": {
        "type": "string",
        "description": "Optional claim reference for additional context"
      }
    },
    "required": ["phone_number"]
  }
}
```

## **Function 3: check_claim_details**
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

## **Function 4: send_portal_link**
```json
{
  "name": "send_portal_link",
  "description": "Send a secure portal access link to the customer via SMS",
  "parameters": {
    "type": "object",
    "properties": {
      "method": {
        "type": "string",
        "enum": ["sms", "email"],
        "description": "How to send the link"
      },
      "link_type": {
        "type": "string",
        "enum": ["claims", "documents", "status"],
        "description": "Type of portal access needed"
      }
    },
    "required": ["method"]
  }
}
```

## **Function 5: check_requirements**
```json
{
  "name": "check_requirements",
  "description": "Check what documents or information are still needed for a claim",
  "parameters": {
    "type": "object",
    "properties": {
      "claim_reference": {
        "type": "string",
        "description": "The claim reference number to check requirements for"
      }
    },
    "required": ["claim_reference"]
  }
}
```

## **Function 6: send_review_link**
```json
{
  "name": "send_review_link",
  "description": "Send a Trustpilot review link to satisfied customers",
  "parameters": {
    "type": "object",
    "properties": {
      "method": {
        "type": "string",
        "enum": ["sms", "email"],
        "description": "How to send the review link"
      }
    },
    "required": ["method"]
  }
}
```

## **Function 7: send_document_link**
```json
{
  "name": "send_document_link", 
  "description": "Send a secure document upload link to customers",
  "parameters": {
    "type": "object",
    "properties": {
      "method": {
        "type": "string",
        "enum": ["sms", "email"],
        "description": "How to send the upload link"
      },
      "document_type": {
        "type": "string",
        "description": "Type of documents needed"
      }
    },
    "required": ["method"]
  }
}
```

---

## 📋 **Instructions:**
1. Copy each function JSON block individually
2. Paste into Hume EVI dashboard function/tool section
3. Add them one by one rather than as a single array
4. Validate each one before moving to the next
