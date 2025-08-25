# 🔴 Hume I0100 Error Report

## Issue Summary

We're experiencing consistent `I0100` errors when attempting to use Hume EVI via WebSocket integration with Twilio voice calls.

## Error Details

### Error Code
- **Code**: `I0100` 
- **Type**: Internal Hume service error (I-prefix indicates internal issue)
- **Message**: Various, including "config_not_found" and "Unexpected service error occurred"

### Configuration
- **Config ID**: `d5e403eb-9a95-4821-8b95-e1dd4702f0d5`
- **API Key**: Set correctly (verified multiple times)
- **Connection Method**: WebSocket to `wss://api.hume.ai/v0/evi/chat`
- **Authentication**: Using `api_key` query parameter

## Our Setup

### Architecture
```
Twilio Phone Call (μ-law 8kHz)
    ↓
Vercel Webhook
    ↓
PartyKit WebSocket Bridge
    ↓
Audio Converter (μ-law → linear16 PCM)
    ↓
Hume EVI WebSocket
```

### What We've Implemented
1. **Audio Conversion**: Converting Twilio's μ-law to linear16 PCM (as Hume doesn't support μ-law)
2. **Continuous Streaming**: Sending all audio chunks as they arrive per Hume's requirements
3. **Session Management**: Waiting for session ready signals before sending audio
4. **Error Handling**: Comprehensive logging and error recovery

## Timeline of Events

1. **Initial Connection**: WebSocket connects successfully to Hume
2. **Session Ready**: Receive `session_settings` or `chat_metadata` indicating ready state
3. **Audio Streaming**: Begin sending converted audio (linear16 PCM)
4. **Immediate Error**: Receive `I0100` error immediately after sending audio

## What We've Tried

1. ✅ Fixed doubled config ID in environment variables
2. ✅ Added audio format conversion (μ-law → linear16)
3. ✅ Implemented continuous streaming (no buffering)
4. ✅ Used correct authentication format
5. ✅ Trimmed whitespace from all credentials
6. ✅ Verified config exists in Hume dashboard

## Current Status

- The WebSocket connection establishes successfully
- Authentication appears to work (no auth errors)
- The error occurs specifically when audio is sent
- Error code `I0100` indicates this is an internal Hume issue

## Questions for Hume Support

1. Is there a current service outage or known issue with EVI?
2. Is our config ID (`d5e403eb-9a95-4821-8b95-e1dd4702f0d5`) properly configured on your end?
3. Are there specific audio format requirements beyond linear16 PCM?
4. Is there a rate limit or audio chunk size limit we should be aware of?

## Contact Information

- **Project**: RMC Dialler - Motor Finance Claims AI Assistant
- **Environment**: Development/Testing
- **Integration**: Twilio voice calls with Hume EVI

## Logs Sample

```
📞 Call started: CA123...
🔗 Connecting to Hume EVI WebSocket...
✅ Hume EVI WebSocket opened successfully!
📋 Session ready - type: session_settings
✅ Now accepting audio input (continuous stream)
🎵 Audio conversion: μ-law → linear16 PCM active
🔄 Audio conversion #1: μ-law (172 chars) → linear16 (344 chars)
❌ Hume error message: {type: 'error', code: 'I0100', ...}
🔴 I0100 is a HUME INTERNAL ERROR - Not our issue!
```

---

**Please advise on resolution. Happy to provide additional logs or debugging information as needed.**

Contact: [Your contact information]
Date: 2025-08-24
