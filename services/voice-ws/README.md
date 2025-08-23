# 🎙️ Voice Actions System - Complete Business Integration

## 📋 **Overview**

This is a complete voice actions system that provides **real business functionality** for both OpenAI Realtime API and Hume EVI voice services. All voice functions now connect to your actual database, send real SMS messages, and perform genuine business operations.

## 🏗️ **Architecture**

### **Voice Actions Registry**
- **Location:** `voice-actions/voice-action-registry.js`
- **Purpose:** Central registry for all voice business functions
- **Integration:** Works with both OpenAI and Hume EVI providers

### **Business Actions**
- **Schedule Callback:** Creates database entries + SMS confirmations
- **Send Portal Link:** Generates secure links + SMS delivery  
- **Check User Details:** Real database user lookups
- **Check Claim Details:** Live claim status from database
- **Check Requirements:** Outstanding document requirements
- **Send Review Link:** Trustpilot review links via SMS
- **Send Document Link:** Secure document upload portals

### **Supporting Services**
- **Voice Database Service:** Direct MySQL connections for voice operations
- **Voice SMS Service:** Twilio SMS integration for voice-triggered messages
- **Action Logging:** Complete audit trail of all voice actions

## 🔧 **Key Features**

### **✅ Real Business Logic**
- **Database Operations:** Direct MySQL queries and updates
- **SMS Integration:** Real Twilio SMS sending with confirmations
- **Error Handling:** Comprehensive error handling and fallbacks
- **Audit Logging:** Complete tracking of all voice actions

### **✅ Dual Provider Support**
- **OpenAI Realtime API:** Full function calling integration
- **Hume EVI:** Same functions with emotional intelligence
- **Shared Business Logic:** Identical functionality across providers

### **✅ Production Ready**
- **Environment Safety:** Development vs production configurations
- **Error Recovery:** Graceful fallbacks when services unavailable
- **Security:** Phone number masking, secure database connections
- **Monitoring:** Detailed logging and performance tracking

## 📁 **File Structure**

```
services/voice-ws/
├── server.js                    # OpenAI Realtime API server
├── hume-server.js               # Hume EVI server  
├── provider-selector.js         # Auto provider selection
├── voice-actions/
│   ├── voice-action-registry.js # Central action registry
│   ├── services/
│   │   ├── voice-database.js    # Database operations
│   │   └── voice-sms.js         # SMS sending service
│   └── actions/
│       ├── schedule-callback.js
│       ├── send-portal-link.js
│       ├── check-user-details.js
│       ├── check-claim-details.js
│       ├── check-requirements.js
│       ├── send-review-link.js
│       └── send-document-link.js
└── package.json                 # Updated with mysql2 dependency
```

## 🚀 **Setup Instructions**

### **1. Install Dependencies**

```bash
cd services/voice-ws
npm install
```

### **2. Environment Variables**

Add these to your EC2 environment:

```bash
# Database Configuration
export DB_HOST=your-database-host
export DB_PORT=3306
export DB_USER=your-db-user
export DB_PASSWORD=your-db-password
export DB_NAME=rmc_dialler

# Twilio Configuration (existing)
export TWILIO_ACCOUNT_SID=your-twilio-sid
export TWILIO_AUTH_TOKEN=your-twilio-token
export TWILIO_FROM_NUMBER=your-twilio-number

# Voice Provider Selection
export VOICE_PROVIDER=openai          # or 'hume' for Hume EVI
export ENABLE_REAL_SMS=true           # Enable actual SMS sending

# Optional: Main app URL for portal links
export MAIN_APP_URL=https://dev.solvosolutions.co.uk
```

### **3. Provider Selection**

#### **Auto Provider Selection**
```bash
npm run start:auto    # Uses VOICE_PROVIDER env var
```

#### **Specific Providers**
```bash
npm run start:openai  # OpenAI Realtime API
npm run start:hume    # Hume EVI (requires Hume setup)
npm start             # Default: OpenAI
```

## 🎯 **Available Voice Functions**

### **Customer Management**
- `schedule_callback(preferred_time, reason)`
- `check_user_details(phone_number, claim_reference?)`
- `send_portal_link(method, link_type?)`
- `send_document_link(method, document_type?)`

### **Claim Operations**
- `check_claim_details(claim_reference)`
- `check_requirements(claim_reference)`

### **Customer Experience**
- `send_review_link(method)`

### **Knowledge Base**
- `search_knowledge_base(query, category?)` *(OpenAI only)*

## 🔄 **Integration Points**

### **Database Tables Used**
- `users` - Customer information lookup
- `user_claims` - Claim details and status
- `missed_calls` - Callback scheduling
- `claim_requirements` - Outstanding requirements
- `voice_action_logs` - Action audit trail

### **External Services**
- **Twilio SMS API** - Message delivery
- **AWS Secrets Manager** - API key management  
- **Your Main App** - Portal link generation

## 🧪 **Testing**

### **Development Mode**
- Set `ENABLE_REAL_SMS=false` for mock SMS sending
- Uses test phone numbers for safe testing
- All database operations use real connections

### **Function Testing**
```bash
# Test callback scheduling
curl -X POST localhost:8080/health
# Should show all services configured

# Voice calls will now perform real actions:
# - Database lookups and updates
# - SMS confirmations sent
# - Portal links generated
# - Requirements checked
```

## 📊 **Monitoring**

### **Logs to Watch**
- `🔧 [VOICE-ACTION] Executing {action}` - Action starts
- `✅ [VOICE-ACTION] Completed {action}` - Action success
- `❌ [VOICE-ACTION] Failed {action}` - Action errors
- `📱 [VOICE-SMS] SMS sent successfully` - SMS delivery
- `👤 [VOICE-DB] Error finding user` - Database issues

### **Performance Tracking**
- All actions include `execution_time_ms`
- Database connection pooling for efficiency
- Error rates tracked per action type

## 🚨 **Error Handling**

### **Graceful Fallbacks**
- **Database Unavailable:** Returns helpful error messages
- **SMS Delivery Failed:** Still completes core action
- **User Not Found:** Suggests verification steps
- **Service Errors:** Generic fallback responses

### **Production Safety**
- Phone numbers masked in all logs
- Database passwords via environment variables
- SMS rate limiting built-in
- Action audit trail for accountability

## 💡 **Next Steps**

1. **Deploy to EC2:** Use the new action system
2. **Test Voice Calls:** Verify real business operations
3. **Monitor Performance:** Watch logs and execution times
4. **Add New Actions:** Extend the registry as needed
5. **Hume EVI Setup:** Configure emotional intelligence features

---

**Your voice AI now has the same powerful business capabilities as your SMS system!** 🎙️✨

Real callbacks, real portal links, real database operations - no more placeholders!
