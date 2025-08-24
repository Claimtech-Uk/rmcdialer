# PartyKit Voice Bridge for Hume EVI

This service bridges Twilio WebSocket connections to Hume EVI for emotionally intelligent voice interactions.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
You need to set these environment variables in PartyKit:

```bash
# Required
npx partykit env add HUME_API_KEY your-hume-api-key
npx partykit env add HUME_CONFIG_ID your-hume-config-id

# Optional (for voice actions with database and SMS)
npx partykit env add REPLICA_DATABASE_URL 'your-database-url'
npx partykit env add TWILIO_ACCOUNT_SID your-twilio-account-sid
npx partykit env add TWILIO_AUTH_TOKEN your-twilio-auth-token
npx partykit env add TWILIO_FROM_NUMBER your-twilio-phone-number
```

### 3. Test Locally
```bash
npm run dev
```

### 4. Deploy to Production
```bash
npm run deploy
```

## 📡 WebSocket URL

After deployment, your WebSocket URL will be:
```
wss://rmc-voice-bridge.YOUR_USERNAME.partykit.dev/parties/voice/CALL_SID
```

## 🔧 How It Works

1. **Twilio Connection**: Receives WebSocket connection from Twilio with audio stream
2. **Audio Conversion**: Converts between Twilio's μ-law and Hume's linear16 encoding
3. **Hume EVI Bridge**: Forwards audio to Hume EVI and receives responses
4. **Voice Actions**: Handles function calls from Hume for business logic
5. **Emotional Intelligence**: Tracks emotional states during conversation

## 🏗️ Architecture

```
Twilio Phone Call
        ↓
Vercel Webhook (returns TwiML)
        ↓
PartyKit WebSocket Bridge
        ↓
Hume EVI (with emotional intelligence)
```

## 📝 Voice Actions

The bridge supports these voice actions:
- `schedule_callback` - Schedule a callback for the customer
- `send_portal_link` - Send portal access link via SMS
- `check_user_details` - Look up user by phone number
- `check_claim_details` - Get claim information
- `check_requirements` - Check outstanding requirements
- `send_review_link` - Send review invitation
- `send_document_link` - Send document upload link

## 🔍 Debugging

View logs:
```bash
npx partykit tail
```

Test WebSocket connection:
```bash
wscat -c wss://rmc-voice-bridge.YOUR_USERNAME.partykit.dev/parties/voice/test
```

## 📚 Resources

- [PartyKit Documentation](https://docs.partykit.io)
- [Hume EVI Documentation](https://dev.hume.ai/docs/speech-to-speech-evi)
- [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams)
