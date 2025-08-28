# AI Voice Agent - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- Node.js 18+
- npm or yarn
- Access to Twilio Console
- Access to Hume Dashboard
- PartyKit account (GitHub auth)

---

## Step 1: Clone & Install

```bash
# Main application
git clone [repository]
cd "RMC Dialler"
npm install

# PartyKit service
cd partykit-voice
npm install
```

---

## Step 2: Environment Setup

### Main App (.env.local)
```bash
ENABLE_AI_VOICE_AGENT=true
ENVIRONMENT_NAME=staging-development
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+447727656195
```

### PartyKit (.env)
```bash
HUME_API_KEY=your_hume_api_key
HUME_CONFIG_ID=d5e403eb-9a95-4821-8b95-e1dd4702f0d5
```

---

## Step 3: Deploy PartyKit

```bash
cd partykit-voice
npm run deploy
# Note the deployment URL - should be:
# https://rmc-voice-bridge.jamesclaimtechio.partykit.dev
```

---

## Step 4: Run Development Server

```bash
cd ..
npm run dev
# Opens http://localhost:3000
```

---

## Step 5: Configure Twilio

1. Go to Twilio Console > Phone Numbers
2. Select the AI test number (+447727656195)
3. Set Voice Webhook:
   - URL: `https://dev.solvosolutions.co.uk/api/webhooks/twilio/voice-ai`
   - Method: POST
4. Save

---

## Step 6: Test Call

1. Call +447727656195
2. Monitor logs:
   ```bash
   cd partykit-voice
   npx partykit tail --name rmc-voice-bridge
   ```

---

## 🔍 What to Look For

### Success Indicators ✅
```
🔌 New connection
📞 Call started
✅ Hume EVI WebSocket opened
📋 Session ready
🎤 Streaming: linear16 PCM
```

### Current Problem ❌
```
❌ No "audio_output" events from Hume
❌ No "assistant_message" from Hume
❌ Caller hears silence
```

---

## 🐛 Debug Commands

### Watch PartyKit Logs
```bash
cd partykit-voice
npx partykit tail --name rmc-voice-bridge
```

### Check Deployment Status
```bash
cd partykit-voice
npx partykit list
```

### Redeploy After Changes
```bash
cd partykit-voice
npm run deploy
```

### Test Audio Conversion Locally
```bash
# In browser console
const testAudio = new Int16Array([0, 16384, 0, -16384]);
const bytes = new Uint8Array(testAudio.buffer);
const base64 = btoa(String.fromCharCode(...bytes));
console.log('Test pattern:', base64);
```

---

## 📊 Current Audio Flow Status

| Stage | Status | Notes |
|-------|--------|-------|
| Twilio → PartyKit | ✅ Working | μ-law audio arriving |
| Audio Conversion | ✅ Running | μ-law → linear16 |
| PartyKit → Hume | ✅ Sending | audio_input messages |
| Hume Processing | ❌ **FAILING** | No responses |
| Hume → PartyKit | ❌ No audio | No audio_output |
| PartyKit → Twilio | ❌ Nothing to send | Waiting for Hume |

---

## 🎯 Focus Area

**The problem is at Stage 4**: Hume is not processing our audio_input messages.

Likely causes:
1. Wrong audio format/encoding
2. Base64 encoding issue
3. Message structure problem
4. Audio levels too low
5. Missing buffering

---

## 📚 Key Documentation Links

- [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams)
- [Hume EVI WebSocket](https://dev.hume.ai/docs/speech-to-speech-evi/websocket)
- [PartyKit Docs](https://docs.partykit.io) 
- [Hume Examples](https://github.com/HumeAI/hume-api-examples/tree/main/evi)

​
To learn more, see the sources I considered:

[[1] Twilio | Hume API](https://dev.hume.ai/docs/integrations/twilio)
​