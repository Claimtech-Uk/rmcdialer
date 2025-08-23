# 🎭 **Hume EVI - Correct Schema Format**

Based on Hume's example format, here are the parameter schemas for each function:

## **schedule_callback**
```json
{
  "type": "object",
  "required": ["preferred_time"],
  "properties": {
    "preferred_time": {
      "type": "string",
      "description": "When the customer wants to be called back (e.g., 'tomorrow at 2pm', 'Monday morning')"
    },
    "reason": {
      "type": "string",
      "description": "Why they need a callback"
    }
  }
}
```

## **check_user_details**
```json
{
  "type": "object",
  "required": ["phone_number"],
  "properties": {
    "phone_number": {
      "type": "string",
      "description": "Customer phone number to lookup"
    },
    "claim_reference": {
      "type": "string",
      "description": "Optional claim reference for additional context"
    }
  }
}
```

## **check_claim_details**
```json
{
  "type": "object",
  "required": ["claim_reference"],
  "properties": {
    "claim_reference": {
      "type": "string",
      "description": "The claim reference number or ID"
    }
  }
}
```

## **send_portal_link**
```json
{
  "type": "object",
  "required": ["method"],
  "properties": {
    "method": {
      "type": "string",
      "description": "How to send the link (sms or email)"
    },
    "link_type": {
      "type": "string",
      "description": "Type of portal access needed (claims, documents, or status)"
    }
  }
}
```

## **check_requirements**
```json
{
  "type": "object",
  "required": ["claim_reference"],
  "properties": {
    "claim_reference": {
      "type": "string",
      "description": "The claim reference number to check requirements for"
    }
  }
}
```

## **send_review_link**
```json
{
  "type": "object",
  "required": ["method"],
  "properties": {
    "method": {
      "type": "string",
      "description": "How to send the review link (sms or email)"
    }
  }
}
```

## **send_document_link**
```json
{
  "type": "object",
  "required": ["method"],
  "properties": {
    "method": {
      "type": "string",
      "description": "How to send the upload link (sms or email)"
    },
    "document_type": {
      "type": "string",
      "description": "Type of documents needed (optional)"
    }
  }
}
```

---

## 📝 **Instructions:**
1. In Hume dashboard, you'll probably enter:
   - **Function Name:** `schedule_callback` (separate field)
   - **Function Description:** `Schedule a callback for the customer at their preferred time` (separate field)
   - **Parameters Schema:** Copy the JSON schema above (just the schema part)

2. The function name and description are likely separate fields from the parameters schema in Hume's interface.
