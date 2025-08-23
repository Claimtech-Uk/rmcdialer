# 🎭 **Hume EVI Setup - Complete Checklist**

## 🎯 **Goal: Get Hume EVI Ready for Testing with Real Business Functions**

---

## 📋 **HUME PLATFORM ACTIONS (You Need To Do)**

### **1. Create Hume AI Account**
- [ ] Go to [https://dev.hume.ai](https://dev.hume.ai)
- [ ] Sign up for developer account
- [ ] Verify email and complete setup
- [ ] Navigate to API Keys section
- [ ] Generate new API key
- [ ] **Save API key** (you'll need this for AWS Secrets Manager)

### **2. Store API Key in AWS Secrets Manager**
```bash
# Add to your existing AWS secret or create new one
aws secretsmanager create-secret \
  --name "dev/hume/voice" \
  --description "Hume AI API key for voice services" \
  --secret-string '{"HUME_API_KEY":"your-actual-hume-api-key"}'

# Or update existing secret
aws secretsmanager update-secret \
  --secret-id "dev/hume/voice" \
  --secret-string '{"HUME_API_KEY":"your-actual-hume-api-key"}'
```

### **3. Create EVI Configuration in Hume Dashboard**
- [ ] Go to **EVI Configurations** in Hume dashboard
- [ ] Click **"Create New Configuration"**
- [ ] **Configuration Settings:**
  - [ ] **Name:** `RMC Motor Finance Claims AI`
  - [ ] **Language Model:** Select **Claude 3.5 Sonnet** (supports function calling)
  - [ ] **Voice:** Choose/create British voice for UK customers
  - [ ] **Language:** English (UK)
  - [ ] **Enable Interruptions:** Yes (natural conversation)

### **4. Configure Voice Personality**
Add this persona prompt to your EVI configuration:
```
You are a helpful AI assistant for Resolve My Claim, helping UK customers with motor finance compensation claims.

SPEAKING STYLE:
- Use modern British English with professional, friendly tone
- Be empathetic and understanding - many customers are frustrated
- Sound natural and conversational, not robotic
- Use contractions naturally (I'll, we're, that's)
- Adapt emotional tone based on customer's mood

KNOWLEDGE FOCUS:
- Motor finance mis-selling 2007-2021
- PCP and HP agreement claims
- FCA investigations and rulings
- Compensation process and timelines
- Document requirements and portal access

APPROACH:
- Listen actively and respond to emotional cues
- Provide clear, helpful information
- Offer specific next steps and actions
- Maintain professional empathy throughout
```

### **5. Add Function Tools to EVI Configuration**
In the **Tools** section of your configuration, add these function definitions:

#### **schedule_callback**
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

#### **check_user_details**
```json
{
  "name": "check_user_details",
  "description": "Look up customer information and claims status",
  "parameters": {
    "type": "object",
    "properties": {
      "phone_number": {
        "type": "string",
        "description": "Customer phone number to lookup"
      },
      "claim_reference": {
        "type": "string",
        "description": "Optional claim reference for context"
      }
    },
    "required": ["phone_number"]
  }
}
```

#### **send_portal_link**
```json
{
  "name": "send_portal_link", 
  "description": "Send a secure portal access link via SMS",
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
        "description": "Type of portal access"
      }
    },
    "required": ["method"]
  }
}
```

#### **check_claim_details**
```json
{
  "name": "check_claim_details",
  "description": "Get detailed information about a specific claim", 
  "parameters": {
    "type": "object",
    "properties": {
      "claim_reference": {
        "type": "string",
        "description": "The claim reference number"
      }
    },
    "required": ["claim_reference"]
  }
}
```

#### **Additional Tools:**
- [ ] Add `send_review_link` (Trustpilot reviews)
- [ ] Add `check_requirements` (outstanding documents)
- [ ] Add `send_document_link` (document uploads)

### **6. Configure Emotional Intelligence Settings**
- [ ] **Emotion Detection:**
  - [ ] Enable frustration detection
  - [ ] Enable satisfaction/happiness detection  
  - [ ] Enable confusion detection
- [ ] **Response Adaptation:**
  - [ ] Increase empathy when frustration detected
  - [ ] Celebrate positive emotions
  - [ ] Provide extra clarity when confusion detected
- [ ] **Cultural Settings:**
  - [ ] British professional communication style
  - [ ] Formal but friendly approach
  - [ ] UK business context awareness

### **7. Test Configuration**
- [ ] Use **EVI Playground** to test your configuration
- [ ] Test each function call manually
- [ ] Verify voice personality and emotional responses
- [ ] Check function calling works correctly
- [ ] **GET CONFIGURATION ID** - copy this from the dashboard

---

## 🔧 **TECHNICAL DEPLOYMENT (Code Already Updated)**

### **8. Environment Variables on EC2**
```bash
# Required environment variables
export HUME_API_KEY=your-hume-api-key           # Or fetch from AWS Secrets
export HUME_CONFIG_ID=your-evi-configuration-id  # From Hume dashboard  
export VOICE_PROVIDER=hume                       # Switch to Hume
export REPLICA_DATABASE_URL=your-mysql-replica   # For database lookups
export TWILIO_ACCOUNT_SID=your-twilio-sid       # SMS integration
export TWILIO_AUTH_TOKEN=your-twilio-token      # SMS integration  
export TWILIO_FROM_NUMBER=your-twilio-number    # SMS integration
```

### **9. Deploy Updated Hume Server**
```bash
# On your EC2 instance
cd rmcdialer
git pull origin main  # Get the updated Hume code

cd services/voice-ws
npm run start:hume    # Start Hume EVI server
```

### **10. Update Twilio Webhook URL**
Update your Twilio phone number webhook to point to your EC2 instance:
```
http://54.155.120.236:8080/twilio/media
```

---

## 🧪 **TESTING CHECKLIST**

### **11. Basic Connection Test**
```bash
# Check Hume service status
curl http://54.155.120.236:8080/health

# Should return:
{
  "ok": true,
  "provider": "hume-evi",
  "humeConfigured": true,
  "configId": "SET"
}
```

### **12. Function Testing**
Test each voice function by making calls and asking for:
- [ ] **User lookup:** "Can you check my details? My number is..."
- [ ] **Claim status:** "What's the status of claim 12345?"
- [ ] **Callback:** "Can you call me back tomorrow at 2pm?"
- [ ] **Portal access:** "Can you send me the portal link via text?"
- [ ] **Requirements:** "What documents do I still need to provide?"
- [ ] **Review request:** "I want to leave a review"

### **13. Emotional Intelligence Test**
- [ ] **Test frustration handling:** Speak in an upset/frustrated tone
- [ ] **Test satisfaction:** Express happiness with service
- [ ] **Test confusion:** Ask unclear or confusing questions
- [ ] **Verify adaptation:** Check if AI adjusts response style

### **14. Audio Quality Test**
- [ ] **Clarity:** Is the voice clear and understandable?
- [ ] **Latency:** Are responses fast enough?
- [ ] **Interruptions:** Can you interrupt the AI naturally?
- [ ] **British accent:** Does it sound appropriately British?

---

## 🚨 **TROUBLESHOOTING**

### **Common Issues & Solutions:**

#### **❌ "Config ID not found"**
- Check your `HUME_CONFIG_ID` matches exactly what's in Hume dashboard
- Ensure configuration is published/active in Hume

#### **❌ "API Key invalid"**  
- Verify API key in AWS Secrets Manager
- Check API key hasn't expired in Hume dashboard

#### **❌ "Function not found"**
- Ensure all functions are added to your EVI configuration
- Check function names match exactly (case-sensitive)

#### **❌ "Audio issues"**
- Audio conversion between Twilio (g711_ulaw) and Hume (linear16) 
- May need more robust audio conversion library for production

#### **❌ "Database connection failed"**
- Check `REPLICA_DATABASE_URL` is set correctly
- Ensure Prisma client is generated: `npx prisma generate`

---

## 🎯 **SUCCESS CRITERIA**

**Your Hume EVI is ready when:**
- [ ] ✅ Health check shows all services configured
- [ ] ✅ Voice calls connect to Hume instead of OpenAI
- [ ] ✅ AI responds with British accent and professional tone
- [ ] ✅ Function calls execute real business operations:
  - [ ] Real user lookups from database
  - [ ] Real claim status from database  
  - [ ] Real SMS confirmations sent
  - [ ] Real portal links generated
- [ ] ✅ Emotional intelligence adapts to customer mood
- [ ] ✅ Interruptions work naturally
- [ ] ✅ Audio quality is clear and low-latency

---

## 💡 **PRODUCTION OPTIMIZATIONS**

### **After Basic Testing Works:**
- [ ] **Audio Quality:** Implement professional audio conversion library
- [ ] **Error Handling:** Add retry logic for Hume API failures
- [ ] **Monitoring:** Set up Hume usage/cost monitoring
- [ ] **Performance:** Optimize audio buffer sizes
- [ ] **Scaling:** Load balancer for multiple concurrent calls
- [ ] **A/B Testing:** Compare Hume vs OpenAI performance

---

**🎭 Ready to configure Hume and test with real emotional intelligence!**
