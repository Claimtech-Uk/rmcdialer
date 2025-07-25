# HUME INTEGRATION STATE DOCUMENTATION

## Current Active Implementation: Hume TTS

### Call Flow
1. **Entry Point**: `app/api/webhooks/twilio/voice/route.ts:145`
2. **Decision Logic**: `shouldUseAIAgent()` returns `true` (100% of calls)
3. **AI Integration**: Uses Hume TTS for audio generation
4. **Flow**: Twilio → Custom conversation logic → Hume TTS → `<Play>` + `<Gather>`

### Active Files Using Hume TTS
- `app/api/webhooks/twilio/voice/route.ts` (lines 175-184): Greeting generation
- `app/api/webhooks/twilio/voice-response/route.ts` (lines 71-107): Response generation
- `modules/ai-voice-agent/services/hume-tts.service.ts`: Core TTS service
- `modules/ai-voice-agent/services/audio-pipeline.service.ts` (line 264): Pipeline integration

### Dormant Implementation: Hume EVI

#### Defined But Unused
- `modules/ai-voice-agent/services/ai-voice.service.ts:140`: `generateHumeEVITwiML()`
- `modules/ai-voice-agent/config/default-hume-config.ts`: EVI configuration
- **Status**: Configured but never called in current call flow

### API Issues Identified

#### Hume TTS API Format (WRONG)
```typescript
// Current (INCORRECT)
body: JSON.stringify({
  utterances: [utterance],
  format: 'wav'
})
```

#### Should Be (CORRECT per docs)
```typescript
// Correct format
body: JSON.stringify({
  text: "Hello world",
  voice: { id: "voice-id" },
  format: "wav"
})
```

### Environment Variables
- `HUME_API_KEY`: Used by both TTS and EVI (potential conflict)
- `HUME_EVI_CONFIG_ID`: Only for EVI (unused)

### Voice Configuration Conflicts
- `voiceProfiles` in `index.ts`: For TTS
- `defaultHumeConfig`: For EVI  
- Multiple voice settings across services

## Business Impact
- **Current**: ALL calls fail at TTS generation step
- **Severity**: CRITICAL - 100% call failure rate
- **Affected Users**: All inbound callers
- **Duration**: Since last deployment with current Hume TTS format 