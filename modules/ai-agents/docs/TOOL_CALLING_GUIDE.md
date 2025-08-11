# SMS Agent Tool Calling Implementation Guide

## Overview

The SMS Agent now supports modern OpenAI tool calling alongside the legacy JSON response system. This provides a more natural and powerful way for the AI to perform actions while maintaining complete backward compatibility.

## Key Features

### ✅ **Backward Compatibility**
- Existing JSON response system continues to work
- Gradual migration via feature flags
- Automatic fallback if tool calling fails
- No breaking changes to existing functionality

### ✅ **Modern Tool Calling**
- Native OpenAI function calling support
- Structured argument validation
- Better error handling and monitoring
- More natural AI behavior

### ✅ **Robust Fallback System**
- Automatic fallback to JSON response if tool calling fails
- Comprehensive error logging and monitoring
- Graceful degradation under all conditions

## Environment Variables

Add these environment variables to enable and configure tool calling:

```bash
# Enable modern tool calling (default: false)
AI_SMS_ENABLE_TOOL_CALLING=true

# Enable enhanced response generation (default: true)
AI_SMS_ENHANCE_RESPONSES=true

# Enable smart personalization features (default: true)  
AI_SMS_SMART_PERSONALIZATION=true

# Enable AI-powered knowledge selection (default: true)
AI_SMS_AI_KNOWLEDGE_SELECTION=true

# Enable conversation insights tracking (default: true)
AI_SMS_CONVERSATION_INSIGHTS=true

# Enable verbose logging for debugging (default: false)
AI_SMS_VERBOSE_LOGGING=true

# Enable debug mode (default: false)
AI_SMS_DEBUG=true
```

## Available Tools

The SMS Agent has 4 primary tools available:

### 1. `send_portal_link`
Sends a secure portal link to the user for document signing or uploads.

**Parameters:**
- `userId` (number, required): User ID to send the portal link to
- `linkType` (string, required): Type of portal link (`claimPortal` | `documentUpload`)  
- `reason` (string, required): Brief reason why the link is being sent
- `urgency` (string, optional): Urgency level (`low` | `medium` | `high`)

### 2. `send_followup_sms`
Sends a follow-up SMS message to the user.

**Parameters:**
- `phoneNumber` (string, required): Phone number to send SMS to
- `message` (string, required): SMS message content
- `delaySeconds` (number, optional): Delay before sending (0-86400 seconds)

### 3. `send_review_link`
Sends a review link (Trustpilot) to the user for feedback.

**Parameters:**
- `phoneNumber` (string, required): Phone number to send review link to
- `trigger` (string, required): What triggered the review request (`claim_completed` | `user_satisfied` | `explicit_request`)

### 4. `schedule_callback`
Schedules a callback or follow-up action.

**Parameters:**
- `phoneNumber` (string, required): Phone number for the callback
- `callbackType` (string, required): Type of callback (`status_update` | `document_reminder` | `general_followup`)
- `delayHours` (number, required): Hours to wait before callback (1-168)
- `message` (string, required): Message to send with the callback

## How It Works

### 1. **Hybrid Approach**
```typescript
const llmResponse = await hybridChat({
  systemPrompt: system,
  userPrompt,
  tools: useToolCalling ? SMS_AGENT_TOOLS : undefined,
  enableToolCalling: useToolCalling,
  model: process.env.AI_SMS_MODEL || 'gpt-4o-mini'
})
```

### 2. **Automatic Fallback**
- If `AI_SMS_ENABLE_TOOL_CALLING=false`: Uses legacy JSON response
- If tool calling fails: Automatically falls back to JSON response
- If both fail: Returns safe default response

### 3. **Backward Compatibility**
- Tool calls are converted to existing `AgentAction` format
- All existing action handling continues to work
- No changes needed to SMS service or routing logic

## Response Handling

### Tool Calling Response
```typescript
{
  type: 'tool_calling',
  content: "I'll send your portal link now.",
  toolCalls: [
    {
      id: "call_123",
      name: "send_portal_link",
      arguments: {
        userId: 12345,
        linkType: "claimPortal",
        reason: "User requested portal access",
        urgency: "medium"
      }
    }
  ],
  fallbackUsed: false
}
```

### JSON Response (Legacy)
```typescript
{
  type: 'json_response',
  content: '{"reply": "I\'ll send your portal link now.", "actions": [{"type": "send_magic_link"}]}',
  toolCalls: [],
  fallbackUsed: false
}
```

## Monitoring & Debugging

### Log Messages
```bash
# Tool calling enabled
AI SMS | 🔧 Using modern tool calling { model: 'gpt-4o-mini', toolCount: 4 }

# Tool calling successful  
AI SMS | 🔧 Tool calling successful { toolCallsCount: 1, hasContent: true, durationMs: 1200 }

# Fallback used
AI SMS | ⚠️ Tool calling failed, falling back to JSON response

# Legacy mode
AI SMS | 📜 Using legacy JSON response (tool calling disabled)
```

### Feature Flags Status
When `AI_SMS_VERBOSE_LOGGING=true`:
```bash
AI SMS | 🏁 Feature flags status: {
  toolCalling: true,
  responseEnhancement: true,
  smartPersonalization: true,
  aiKnowledgeSelection: true,
  conversationInsights: true,
  verboseLogging: true,
  debugMode: false
}
```

## Migration Strategy

### Phase 1: Testing (Recommended)
```bash
# Test environment
AI_SMS_ENABLE_TOOL_CALLING=true
AI_SMS_VERBOSE_LOGGING=true
AI_SMS_DEBUG=true
```

### Phase 2: Staged Rollout
```bash
# Production with fallback
AI_SMS_ENABLE_TOOL_CALLING=true
AI_SMS_VERBOSE_LOGGING=false
```

### Phase 3: Full Deployment
```bash
# Production optimized
AI_SMS_ENABLE_TOOL_CALLING=true
AI_SMS_VERBOSE_LOGGING=false
AI_SMS_DEBUG=false
```

## Benefits of Tool Calling

### 🎯 **More Natural AI Behavior**
- AI can decide when and how to use tools
- No complex prompt engineering for action generation
- Better reasoning about when actions are appropriate

### 🛡️ **Better Error Handling**
- Structured argument validation
- Clear tool call success/failure feedback
- Robust fallback mechanisms

### 📊 **Enhanced Monitoring**
- Detailed tool call logging
- Performance metrics (duration, token usage)
- Fallback usage tracking

### 🔧 **Future-Proof Architecture**
- Ready for new OpenAI features
- Extensible tool system
- Modern development patterns

## Troubleshooting

### Tool Calling Not Working
1. Check `AI_SMS_ENABLE_TOOL_CALLING=true` is set
2. Verify OpenAI API key has tool calling access
3. Check logs for fallback usage
4. Enable verbose logging for debugging

### High Fallback Usage
1. Check model compatibility (gpt-4o-mini supports tools)
2. Review system prompt complexity
3. Monitor token usage and limits
4. Check for API rate limiting

### Performance Issues
1. Monitor `durationMs` in logs
2. Consider using gpt-4o for better performance
3. Optimize system prompts
4. Review tool parameter complexity

## Security Considerations

### ✅ **Input Validation**
- All tool arguments are validated by OpenAI
- Type checking prevents invalid parameters
- Required fields enforced

### ✅ **Action Validation**
- Tool calls converted to existing action types
- All existing security checks remain in place
- Idempotency keys generated for consistency

### ✅ **Error Handling**
- No sensitive information in error logs
- Graceful degradation prevents system failures
- Comprehensive fallback system

## Performance Metrics

Expected performance with tool calling enabled:

- **Response Time**: +100-300ms (tool validation overhead)
- **Token Usage**: +10-20% (tool definitions in context)
- **Success Rate**: 95%+ (with automatic fallback)
- **Fallback Rate**: <5% in normal operation

## Next Steps

1. **Test in Development**: Enable tool calling in dev environment
2. **Monitor Metrics**: Watch fallback rates and performance
3. **Gradual Rollout**: Enable for small percentage of traffic
4. **Full Deployment**: Roll out to all users once stable
5. **Add New Tools**: Extend system with additional capabilities

This implementation provides a solid foundation for modern AI agent capabilities while maintaining the reliability and compliance requirements of your SMS system.
