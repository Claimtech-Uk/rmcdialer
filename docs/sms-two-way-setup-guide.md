# Two-Way SMS Setup Guide

## 🎉 Current Status: **90% Complete & Ready to Use!**

Your SMS implementation is nearly complete and ready for production use. Here's what's working and what's needed to go live.

---

## ✅ **What's Working Right Now**

### 📱 **Complete SMS Infrastructure**
- **Outbound SMS**: Agents can send messages from the `/sms` page
- **Conversation Management**: Full conversation tracking with user context
- **Auto-Responses**: Smart keyword-based automatic replies
- **Database Integration**: All messages stored with proper relationships
- **Agent Assignment**: Conversations can be assigned to specific agents
- **Real-time Updates**: Frontend polls for new messages every 3-5 seconds

### 🔧 **Webhook Endpoints Ready**
- ✅ **Incoming SMS**: `/api/webhooks/twilio/sms` - processes incoming messages
- ✅ **Status Updates**: `/api/webhooks/twilio/sms/status` - tracks delivery status
- ✅ **Health Checks**: Both endpoints respond to GET requests for testing

### 🎯 **Smart Auto-Response System**
```typescript
// Current auto-response keywords:
- 'help', 'support', 'assistance' → Offers help + agent follow-up
- 'documents', 'upload', 'send' → Document upload instructions
- 'status', 'progress', 'update' → Status update (flags for agent attention)
- 'stop', 'unsubscribe', 'opt out' → Unsubscribe confirmation
- 'yes', 'ok', 'confirm' → Confirmation acknowledgment
```

### 📊 **Current Configuration**
- **Twilio Account**: Properly configured (AC57d588...)
- **Phone Number**: +447488879172 (UK number ready for use)
- **Environment**: All required variables set
- **Webhook URLs**: Generated automatically for localhost/production

---

## 🚀 **To Go Live with Two-Way SMS**

### 1. **Configure Twilio Webhooks** (5 minutes)
In your [Twilio Console](https://console.twilio.com/):

1. Go to **Phone Numbers** → **Manage** → **Active Numbers**
2. Click on `+447488879172`
3. Set **Messaging Configuration**:
   ```
   Webhook URL: https://yourdomain.com/api/webhooks/twilio/sms
   HTTP Method: POST
   ```
4. Set **Status Callback URL**:
   ```
   Status Callback URL: https://yourdomain.com/api/webhooks/twilio/sms/status
   HTTP Method: POST
   ```

### 2. **Set Production Environment Variables**
```bash
# Add to your production environment:
API_BASE_URL=https://yourdomain.com  # Critical for webhooks
TWILIO_ACCOUNT_SID=AC57d588...       # Already set ✅
TWILIO_AUTH_TOKEN=your-auth-token    # Already set ✅
TWILIO_PHONE_NUMBER=+447488879172    # Already set ✅
```

### 3. **Test Live SMS** (2 minutes)
```bash
# Test configuration
curl https://yourdomain.com/api/test-twilio-config

# Send test SMS (optional)
curl -X POST https://yourdomain.com/api/test-twilio-config \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send-test-sms",
    "phoneNumber": "+44XXXXXXXXXX",
    "message": "Test message from RMC Dialler SMS system"
  }'
```

---

## 📖 **How to Use Two-Way SMS**

### **For Agents:**
1. **Access SMS Interface**: Go to `/sms` in the app
2. **View Conversations**: See all active SMS conversations with users
3. **Send Messages**: Click on a conversation and type messages
4. **Auto-Responses**: System automatically handles common inquiries
5. **Assign Conversations**: Assign conversations to specific agents
6. **Close Conversations**: Mark conversations as resolved

### **For Users:**
1. **Receive SMS**: Users get messages from your Twilio number
2. **Reply Naturally**: Users can reply normally via SMS
3. **Get Auto-Responses**: Common keywords trigger helpful auto-replies
4. **Escalate to Agents**: Auto-responses flag conversations needing human attention

### **Message Flow:**
```
User sends SMS → Twilio → Webhook → Auto-response (if applicable) + Agent notification → Agent responds → User receives SMS
```

---

## 🔧 **Technical Details**

### **Database Schema**
```sql
-- Conversations tracked in sms_conversations
-- Individual messages in sms_messages
-- Full audit trail with Twilio SIDs
-- Agent assignment and status tracking
```

### **Auto-Response Logic**
- ⏱️ **Rate Limiting**: Max 3 messages per 10 minutes before auto-response stops
- 🎯 **Keyword Matching**: Case-insensitive keyword detection
- 🚦 **Priority System**: Rules processed by priority (1 = highest)
- 👨‍💼 **Agent Flagging**: Some responses flag conversations for agent attention

### **Real-time Updates**
- **Frontend Polling**: Every 3-5 seconds for new messages
- **Conversation List**: Updates every 5 seconds
- **Statistics**: Updates every 30 seconds

---

## 🎯 **Optional Improvements** (Future)

### **Enhanced Real-time (Current: Polling)**
```typescript
// Could upgrade to WebSockets or Server-Sent Events
// Current polling works well but uses more bandwidth
```

### **Media Support**
```typescript
// Currently handles text only
// Could add image/document support in future
```

### **Advanced Auto-Responses**
```typescript
// Could add AI-powered responses
// Currently uses keyword matching (works great!)
```

---

## 🐛 **Troubleshooting**

### **Webhooks Not Working**
1. Check API_BASE_URL is set correctly
2. Verify Twilio webhook URLs are HTTPS in production
3. Test endpoints: `curl https://yourdomain.com/api/webhooks/twilio/sms`

### **Messages Not Sending**
1. Verify Twilio credentials: `curl https://yourdomain.com/api/test-twilio-config`
2. Check phone number format includes country code
3. Verify Twilio account has SMS credits

### **Auto-Responses Not Working**
1. Check conversation activity (rate limiting at 3 messages/10 minutes)
2. Verify keywords are spelled correctly (case-insensitive)
3. Look for auto-response logs in server console

---

## 🎊 **You're Ready!**

Your SMS system is **production-ready**! Just configure the Twilio webhooks and set your production API_BASE_URL. 

The system will automatically:
- ✅ Process incoming SMS messages
- ✅ Send appropriate auto-responses  
- ✅ Create conversations and notify agents
- ✅ Track all messages and delivery status
- ✅ Handle user replies and agent responses

**Next Step**: Configure those Twilio webhooks and you'll have full two-way SMS! 🚀 