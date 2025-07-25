# AI Voice Agent Module

This module provides integration with AI voice providers for RMC Dialler, currently supporting Hume EVI for natural conversational AI.

## Setup Instructions

### 1. Hume EVI Configuration

To use Hume EVI for inbound calls, you need to:

1. **Create a Hume account** at [Hume AI Platform](https://platform.hume.ai/)
2. **Get your API key** from the Settings > Keys section
3. **Create an EVI configuration** in the EVI Configs section
4. **Set environment variables**:

```bash
# Add these to your .env.local file
HUME_API_KEY=your_hume_api_key_here
HUME_EVI_CONFIG_ID=your_hume_config_id_here
```

### 2. How It Works

When an inbound call comes in:

1. The system performs caller lookup (existing functionality)
2. Checks if AI agent should handle the call (currently all calls use AI)
3. If using AI: Redirects the call to Hume's Twilio endpoint
4. If not using AI: Falls back to human agent routing (existing functionality)

### 3. Hume Configuration

The Hume EVI configuration is set up in the Hume platform and includes:
- **System prompt**: How the AI should behave and respond
- **Voice**: Which voice to use (Hume has very natural voices)
- **Context**: Any background information about your business
- **Tools**: Any functions the AI can call (optional)

### 4. Benefits of Hume EVI

- **Natural conversation**: Hume specializes in emotionally intelligent voice AI
- **Low latency**: Direct Twilio integration for optimal performance  
- **No server required**: Hume handles all the voice processing
- **Easy fallback**: Can transfer to human agents when needed

## Current Implementation

- ✅ Hume EVI provider added to AI voice service
- ✅ Direct Twilio integration via Hume's webhook endpoint
- ✅ Automatic caller context passing (name, user ID if known)
- ✅ Fallback to human agents if AI fails
- ✅ All inbound calls currently route to AI (configurable)

## Next Steps

You can customize the AI behavior by:
1. Modifying the `shouldUseAIAgent()` function in the Twilio webhook
2. Updating your Hume EVI configuration in the Hume platform
3. Adding conditional logic based on caller info, time of day, etc. 