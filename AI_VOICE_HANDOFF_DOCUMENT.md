# AI Voice Agent - Technical Handoff Document

## 📋 Executive Summary

This document provides complete technical context for the AI Voice Agent integration between Twilio, PartyKit, and Hume EVI. The system is currently experiencing a critical audio issue where no sound reaches the caller, despite all services connecting successfully.

---

## 🔴 Current Issue Status

### The Problem
- **Symptom**: Complete silence on calls - no AI voice heard
- **Connection Status**: All services connect ✅
- **Audio Flow**:
  - Twilio → PartyKit: ✅ Audio arriving (μ-law 8kHz)
  - PartyKit → Hume: ✅ Messages sent (linear16 PCM)
  - Hume → PartyKit: ❌ No responses (no audio_output events)
  - PartyKit → Twilio: ❌ No audio to send back

### Root Cause (Likely)
Hume is not processing our audio input. Possible reasons:
1. **Audio format mismatch** - Wrong encoding/sample rate
2. **Base64 encoding issue** - Double encoding or byte order problems
3. **Audio levels too low** - Telephony audio (-20dB) vs browser mic (0dB)
4. **Message format incorrect** - Missing or extra fields
5. **Buffering needed** - Sending packets too small/frequently

---

## 🏗️ System Architecture

### Component Overview
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│                 │     │                  │     │                 │     │              │
│  Twilio Phone   │────▶│  Next.js App     │────▶│  PartyKit WS    │────▶│   Hume EVI   │
│  Call (PSTN)    │     │  (Vercel)        │     │  (Edge Runtime) │     │  (AI Voice)  │
│                 │◀────│                  │◀────│                 │◀────│              │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └──────────────┘
    μ-law 8kHz             TwiML Response          WebSocket Bridge        Linear16 PCM
```

### Data Flow
1. **Incoming Call** → Twilio receives call
2. **Webhook** → POST to `/api/webhooks/twilio/voice-ai`
3. **TwiML Response** → Returns `<Stream>` directive pointing to PartyKit
4. **WebSocket Connection** → Twilio connects to PartyKit room
5. **Hume Connection** → PartyKit establishes WebSocket to Hume EVI
6. **Audio Conversion**:
   - Twilio → PartyKit: μ-law 8kHz (base64)
   - PartyKit converts: μ-law → linear16 PCM
   - PartyKit → Hume: linear16 PCM 8kHz (base64)
   - Hume → PartyKit: WAV 48kHz → needs downsampling + μ-law conversion
   - PartyKit → Twilio: μ-law 8kHz

---

## 📁 Project Structure

### Main Application (Next.js)
```
/RMC Dialler/
├── app/
│   └── api/
│       └── webhooks/
│           └── twilio/
│               └── voice-ai/          # AI voice webhook endpoint
│                   └── route.ts       # Generates TwiML for PartyKit
├── middleware.ts                      # Feature flag enforcement
├── lib/
│   └── config/
│       └── features.ts                # ENABLE_AI_VOICE_AGENT flag
└── modules/
    └── ai-voice-agent/                # AI voice services (planned)
```

### PartyKit Service (WebSocket Bridge)
```
/partykit-voice/
├── src/
│   └── voice-party-fixed.ts          # Main WebSocket handler
├── party.json                         # PartyKit configuration
├── package.json                       # Dependencies
└── .env                              # Environment variables
```

---

## 🔧 Key Files & Their Roles

### 1. **`app/api/webhooks/twilio/voice-ai/route.ts`**
- **Purpose**: Handles incoming Twilio webhooks for AI voice calls
- **Responsibilities**:
  - Feature flag check (`ENABLE_AI_VOICE_AGENT`)
  - Generate TwiML response with `<Stream>` directive
  - Point to PartyKit WebSocket URL
- **Critical Code**:
```typescript
const wsUrl = `wss://rmc-voice-bridge.jamesclaimtechio.partykit.dev/parties/voice/${callSid}`;
const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsUrl}">
      <Parameter name="callSid" value="${callSid}"/>
    </Stream>
  </Start>
  <Pause length="3600"/>
</Response>`;
```

### 2. **`partykit-voice/src/voice-party-fixed.ts`**
- **Purpose**: WebSocket bridge between Twilio and Hume
- **Key Classes**:
  - `VoiceParty`: Main PartyKit server class
  - Handles dual WebSocket connections (Twilio + Hume)
- **Key Functions**:
  - `onConnect()`: Establishes connections
  - `handleTwilioMessage()`: Processes Twilio media streams
  - `handleHumeMessage()`: Processes Hume responses
  - `convertMulawToLinear16()`: μ-law → PCM conversion
  - `convertLinear16ToMulaw()`: PCM → μ-law conversion
  - `sendAudioToTwilio()`: Sends audio back to caller

### 3. **`middleware.ts`**
- **Purpose**: Enforces feature flags globally
- **Critical**: Blocks AI voice in production when `ENABLE_AI_VOICE_AGENT=false`

---

## 🔑 Environment Variables

### Vercel (Next.js App)
```bash
ENABLE_AI_VOICE_AGENT=true          # Feature flag (dev only)
TWILIO_ACCOUNT_SID=xxx              # Twilio credentials
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+447...         # AI voice test number
ENVIRONMENT_NAME=staging-development
```

### PartyKit Service
```bash
HUME_API_KEY=xxx                    # Hume authentication
HUME_CONFIG_ID=d5e403eb-9a95-4821-8b95-e1dd4702f0d5
```

---

## 🌐 API Endpoints & Services

### Twilio Webhooks
- **Voice AI**: `POST /api/webhooks/twilio/voice-ai`
- **Status**: `POST /api/webhooks/twilio/call-status`
- **Fallback**: `POST /api/webhooks/twilio/voice-fallback`

### PartyKit WebSocket
- **URL**: `wss://rmc-voice-bridge.jamesclaimtechio.partykit.dev`
- **Room Pattern**: `/parties/voice/{callSid}`
- **Deployment**: Edge runtime, global distribution

### Hume EVI
- **WebSocket**: `wss://api.hume.ai/v0/evi/chat`
- **Config ID**: `d5e403eb-9a95-4821-8b95-e1dd4702f0d5`
- **Documentation**: https://dev.hume.ai/docs/speech-to-speech-evi

---

## 🔄 Audio Conversion Pipeline

### Current Implementation

#### Twilio → Hume (μ-law to Linear16)
```typescript
convertMulawToLinear16(base64MulawAudio: string): string {
  // 1. Decode base64 → binary
  const mulawData = Uint8Array.from(atob(base64MulawAudio), c => c.charCodeAt(0));
  
  // 2. Convert each μ-law sample → 16-bit PCM
  const pcmSamples = new Int16Array(mulawData.length);
  for (let i = 0; i < mulawData.length; i++) {
    pcmSamples[i] = mulawToLinear16Sample(mulawData[i]);
  }
  
  // 3. Encode PCM → base64
  return btoa(String.fromCharCode(...new Uint8Array(pcmSamples.buffer)));
}
```

#### Hume → Twilio (WAV to μ-law)
```typescript
convertLinear16ToMulaw(base64WavAudio: string): string {
  // 1. Parse WAV header, extract PCM data
  // 2. Downsample 48kHz → 8kHz
  // 3. Convert Linear16 → μ-law
  // 4. Encode → base64
}
```

---

## 🐛 Debugging Tools & Commands

### PartyKit Logs
```bash
# View real-time logs
cd partykit-voice
npx partykit tail --name rmc-voice-bridge

# Deploy changes
npm run deploy
```

### Test Call Flow
1. Call the test number: `+447727656195`
2. Monitor PartyKit logs for connection
3. Check for Hume responses
4. Verify audio conversion logs

### Key Log Indicators
- ✅ Good: `"✅ Hume EVI WebSocket opened successfully!"`
- ✅ Good: `"📋 Session ready - type: chat_metadata"`
- ❌ Bad: No `audio_output` events from Hume
- ❌ Bad: No `user_message` or `assistant_message` from Hume

---

## 🔧 Attempted Fixes (Chronological)

1. **Removed blocking TwiML `<Say>` verb** ✅
2. **Fixed μ-law encoding algorithm** ✅
3. **Added comprehensive logging** ✅
4. **Fixed error handling in conversions** ✅
5. **Verified WebSocket connections** ✅
6. **Confirmed audio format requirements** ✅
7. **Added test tone generator** ✅

---

## 🎯 Next Steps to Fix Audio

### Priority 1: Verify Audio Format
```javascript
// Test with known working format
const testAudio = {
  type: "audio_input",
  data: "BASE64_LINEAR16_PCM_8KHZ_MONO"
};
```

### Priority 2: Add Audio Buffering
```javascript
// Buffer 100ms of audio before sending
const BUFFER_SIZE = 5; // 5 packets = 100ms
```

### Priority 3: Amplify Audio Levels
```javascript
// Boost telephony audio by 6dB
pcmSamples[i] = Math.min(32767, Math.max(-32768, pcmSamples[i] * 2));
```

### Priority 4: Test with Hume's Example Code
Compare our implementation with:
https://github.com/HumeAI/hume-api-examples/tree/main/evi

---

## 🚀 Deployment & Testing

### Development Environment
- **Vercel Preview**: https://dev.solvosolutions.co.uk
- **PartyKit**: Auto-deploys from Git
- **Feature Flag**: `ENABLE_AI_VOICE_AGENT=true`

### Production Safety
- **Feature Flag**: `ENABLE_AI_VOICE_AGENT=false`
- **Middleware**: Blocks all AI voice endpoints
- **Separate Resources**: Different Twilio numbers/apps

---

## 📞 Support & Resources

### Documentation
- **Twilio Media Streams**: https://www.twilio.com/docs/voice/media-streams
- **Hume EVI**: https://dev.hume.ai/docs/speech-to-speech-evi
- **PartyKit**: https://docs.partykit.io

### Known Issues
1. **Audio Format**: Hume not responding to our audio_input
2. **No Voice Activity**: Hume not detecting speech
3. **Silent Output**: No audio_output events from Hume

### Contact Points
- **PartyKit Dashboard**: https://www.partykit.io/parties/rmc-voice-bridge
- **Hume Support**: support@hume.ai (mention error I0100 if seen)
- **Twilio Console**: Check Voice Insights for call details

---

## 💡 Critical Insights

1. **Hume expects continuous streaming** - not file uploads
2. **Telephony audio lacks browser features** - no echo cancellation, noise suppression
3. **Audio levels matter** - telephony is quieter than browser mics
4. **Byte order matters** - little-endian for web audio
5. **Message size matters** - might need minimum chunk sizes

---

## 📝 Testing Checklist

- [ ] Verify PartyKit is deployed with latest code
- [ ] Check environment variables are set correctly
- [ ] Test with browser-based Hume example first
- [ ] Compare audio formats between working example and our code
- [ ] Monitor all WebSocket messages in browser DevTools
- [ ] Check Twilio Voice Insights for call quality
- [ ] Verify feature flag is enabled in dev environment

---

## 🔴 CRITICAL WARNING

**DO NOT** modify `/api/webhooks/twilio/voice/` - this is the production voice system.
**ALL** AI voice code must be behind the `ENABLE_AI_VOICE_AGENT` feature flag.

---

*Document prepared: August 28, 2025*
*Last audio test: Silent output - Hume not responding to audio_input*
