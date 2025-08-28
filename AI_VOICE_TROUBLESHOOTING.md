# AI Voice Troubleshooting Guide

## 🔴 Current Issue: Silent Audio

### Symptom
- Call connects successfully
- No AI voice heard
- Call duration normal but silent

### Root Cause
Hume EVI is not responding to our audio_input messages

---

## 🔍 Systematic Debugging Approach

### Step 1: Verify Connections
```bash
cd partykit-voice
npx partykit tail --name rmc-voice-bridge
```

Look for:
- ✅ `New connection` - Twilio connected
- ✅ `Hume EVI WebSocket opened` - Hume connected
- ✅ `Session ready` - Hume ready for audio

### Step 2: Check Audio Flow
In PartyKit logs, verify:
```
🎤 Streaming: linear16 PCM (converted from μ-law)
```
- Should see ~50 messages per second
- Each should show conversion happening

### Step 3: Monitor Hume Responses
Look for these Hume events:
- ❌ Missing: `audio_output`
- ❌ Missing: `user_message`
- ❌ Missing: `assistant_message`
- ✅ Present: `chat_metadata` (only at start)

---

## 🧪 Audio Format Tests

### Test 1: Verify μ-law Conversion
```javascript
// In partykit-voice/src/voice-party-fixed.ts
// Add after line 300 in convertMulawToLinear16

console.log('🔬 Sample values:', {
  firstMulaw: mulawData[0],
  firstPCM: pcmSamples[0],
  lastMulaw: mulawData[mulawData.length-1],
  lastPCM: pcmSamples[pcmSamples.length-1]
});
```

### Test 2: Check Base64 Encoding
```javascript
// Add debug in handleTwilioMessage
console.log('📦 Base64 lengths:', {
  original: message.media.payload.length,
  converted: convertedAudio.length,
  ratio: convertedAudio.length / message.media.payload.length
});
// Ratio should be ~2 (16-bit vs 8-bit)
```

### Test 3: Audio Level Check
```javascript
// In convertMulawToLinear16, after conversion
const maxValue = Math.max(...pcmSamples.map(Math.abs));
console.log('📊 Audio level:', {
  max: maxValue,
  percentage: (maxValue / 32767) * 100 + '%'
});
// Should be > 10% for audible speech
```

---

## 🔧 Progressive Fixes

### Fix 1: Test with Amplification
```javascript
// In convertMulawToLinear16, after creating pcmSamples
for (let i = 0; i < pcmSamples.length; i++) {
  pcmSamples[i] = Math.min(32767, Math.max(-32768, pcmSamples[i] * 3));
}
console.log('🔊 Amplified audio by 3x');
```

### Fix 2: Buffer Multiple Packets
```javascript
// At class level
private audioBuffer: string[] = [];
private readonly BUFFER_SIZE = 5; // 100ms worth

// In handleTwilioMessage
this.audioBuffer.push(convertedAudio);
if (this.audioBuffer.length >= this.BUFFER_SIZE) {
  const combined = this.combineBuffers(this.audioBuffer);
  this.sendToHume({
    type: 'audio_input',
    data: combined
  });
  this.audioBuffer = [];
}
```

### Fix 3: Test Direct PCM (No Base64)
```javascript
// Create test pattern
const testPattern = new Int16Array(1600); // 100ms @ 8kHz
for (let i = 0; i < testPattern.length; i++) {
  testPattern[i] = Math.sin(i * 0.1) * 16384; // Sine wave
}
const testBase64 = btoa(String.fromCharCode(
  ...new Uint8Array(testPattern.buffer)
));

// Send test pattern
this.humeWs.send(JSON.stringify({
  type: 'audio_input',
  data: testBase64
}));
```

---

## 📋 Common Issues & Solutions

### Issue: "Buffer.from is not a function"
**Solution**: PartyKit uses edge runtime, not Node.js
```javascript
// Wrong
Buffer.from(data, 'base64')

// Correct
Uint8Array.from(atob(data), c => c.charCodeAt(0))
```

### Issue: Double Base64 Encoding
**Check**: Log the first few chars of base64 data
```javascript
console.log('Base64 preview:', data.substring(0, 20));
// Should look like: "f39/f39/f39..." (random chars)
// NOT like: "ZjM5L2YzOS9mMzk..." (base64 of base64)
```

### Issue: Wrong Byte Order
**Test**: Create known pattern
```javascript
const test = new Int16Array([0x0100, 0x0200]);
const bytes = new Uint8Array(test.buffer);
console.log('Bytes:', Array.from(bytes));
// Little-endian: [0, 1, 0, 2]
// Big-endian: [1, 0, 2, 0]
```

---

## 🎯 Verification Checklist

### Audio Input Format
- [ ] Format: `linear16` not `pcm16` or `l16`
- [ ] Sample rate: 8000 (matching telephony)
- [ ] Channels: 1 (mono)
- [ ] Byte order: Little-endian
- [ ] Base64: Single encoding, not double

### Message Structure
```javascript
// Exact format Hume expects
{
  "type": "audio_input",
  "data": "base64_encoded_linear16_pcm"
}
// No extra fields!
```

### WebSocket State
- [ ] Connection established before sending
- [ ] Session ready (chat_metadata received)
- [ ] No compression on WebSocket
- [ ] Messages < 1MB size

### Audio Quality
- [ ] Audio level > -40dB
- [ ] Not complete silence
- [ ] Continuous stream, not chunks
- [ ] No long gaps (> 500ms)

---

## 🚨 Emergency Fallback

If nothing works, test with Hume's example:
1. Clone https://github.com/HumeAI/hume-api-examples
2. Run their TypeScript example
3. Compare WebSocket messages in DevTools
4. Look for differences in:
   - Message format
   - Audio encoding
   - Timing/frequency
   - Session setup

---

## 📞 Escalation Path

1. **Check PartyKit Status**: https://www.partykit.io/status
2. **Check Hume Status**: https://status.hume.ai
3. **Hume Support**: support@hume.ai
   - Include Config ID: `d5e403eb-9a95-4821-8b95-e1dd4702f0d5`
   - Mention: "No audio_output events despite audio_input"
4. **Twilio Support**: Check Voice Insights for call quality

---

## 💡 Alternative Approaches

If Hume continues to fail:

### Option 1: Use Hume's Twilio Integration
- Pros: Official support, proven to work
- Cons: No custom tools/functions

### Option 2: Switch to Vapi.ai
- Pros: Built for telephony, easier setup
- Cons: Different pricing, less control

### Option 3: OpenAI Realtime API
- Pros: Native function calling
- Cons: Requires more infrastructure

---

## 📊 Success Metrics

When working correctly, you should see:
1. **Latency**: < 500ms response time
2. **Audio Quality**: Clear, no artifacts
3. **Hume Events**:
   - `user_message` when caller speaks
   - `assistant_message` for AI responses  
   - `audio_output` with WAV data
4. **Conversation Flow**: Natural back-and-forth

---

*Last updated: August 28, 2025*
*Status: Debugging audio_input format issue*
