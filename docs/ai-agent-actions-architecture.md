# AI Agent Actions Architecture

## Overview

The AI Agent Actions system provides a modular, extensible framework for AI agents to execute real-world actions. Built around an action registry pattern, it enables intelligent action selection, execution, and tracking.

## Architecture

### **🏗️ Action Registry Pattern**

```typescript
// Central registry for all AI actions
export class ActionRegistry {
  execute(type: ActionType, context: ActionExecutionContext, params: any)
  register(action: ActionDefinition)
  getCapabilities() // For AI discovery
}
```

### **🎯 Available Actions**

| Action Type | Description | AI Decision Context |
|-------------|-------------|-------------------|
| `send_portal_link` | Send secure portal links | User readiness, next steps |
| `send_sms` | Follow-up messages | Delayed responses, information |
| `send_review_link` | Trustpilot reviews | User satisfaction signals |
| `schedule_followup` | Future interactions | User needs time to think |
| `none` | Continue conversation | Building trust, more info needed |

## Portal Link Action

### **✨ Features**

- **Intelligent Generation**: Uses MagicLinkService or AI fallback
- **Context-Aware Messaging**: Customizes SMS based on link type
- **Full Tracking**: Provides tracking IDs and analytics
- **Error Handling**: Graceful fallbacks and detailed logging
- **AI Integration**: Records actions for machine learning

### **🔧 Usage**

```typescript
import { actionRegistry } from '@/modules/ai-agents/actions'

const result = await actionRegistry.execute('send_portal_link', {
  smsService,
  magicLinkService,
  userContext: { userId, phoneNumber, userName, found: true },
  conversationContext: { reasoning: 'User ready to proceed', confidence: 0.9 }
})
```

### **📱 Message Intelligence**

The portal link action crafts intelligent messages based on context:

```typescript
// Claim Portal (default)
"Hi James, here's your secure portal link:
claim.resolvemyclaim.co.uk/claims?mlid=...
Click to provide your signature, ID, and required information. Questions? Just reply!"

// Document Upload
"Hi James, here's your secure portal to upload required documents:
claim.resolvemyclaim.co.uk/claims?mlid=...
Click to upload your ID, proof of address, or other required items. Questions? Just ask!"
```

## AI Integration

### **🧠 Conversational Integration**

The AI decides actions naturally through conversation context:

```json
{
  "messages": [
    "Hi James, Our fees are capped at 30% plus VAT on a sliding scale.",
    "This means you only pay when we succeed, and the rate decreases as compensation increases.",
    "Would you like me to send your portal link to get started?"
  ],
  "actions": [
    {
      "type": "send_portal_link",
      "reasoning": "User asked about fees and seems ready to proceed",
      "confidence": 0.8
    }
  ]
}
```

### **⚡ Execution Flow**

1. **AI Decision**: AI analyzes conversation and decides actions
2. **Registry Lookup**: Action retrieved from registry by type
3. **Context Building**: Execution context built from user/conversation data
4. **Action Execution**: Action executed with full error handling
5. **Result Processing**: Results logged and converted for system compatibility

## Extensibility

### **➕ Adding New Actions**

```typescript
actionRegistry.register({
  type: 'send_appointment_reminder',
  name: 'Send Appointment Reminder',
  description: 'Send appointment reminder to user',
  requiredParams: ['userId', 'appointmentDate'],
  optionalParams: ['customMessage'],
  execute: async (context, params) => {
    // Implementation
    return { success: true, actionType: 'send_appointment_reminder' }
  }
})
```

### **🎯 AI Action Selection**

The AI uses action capabilities to make informed decisions:

```typescript
const capabilities = actionRegistry.getCapabilities()
// Returns: [{ type, name, description, params: { required, optional } }]
```

## Benefits

### **🚀 For AI Development**
- **Modular**: Actions are self-contained and reusable
- **Discoverable**: AI can query available actions and their requirements
- **Traceable**: Full logging and reasoning capture
- **Extensible**: Easy to add new actions without core changes

### **🔧 For System Integration**
- **Consistent Interface**: All actions follow the same pattern
- **Error Handling**: Comprehensive error management
- **Backward Compatible**: Maintains legacy action support
- **Performance**: Efficient execution with proper logging

### **📊 For Analytics**
- **Action Tracking**: Every action execution is logged
- **AI Reasoning**: Capture AI decision-making process
- **Success Metrics**: Track action success/failure rates
- **User Journey**: Understand user interaction patterns

## Future Enhancements

1. **Action Chaining**: Link multiple actions in sequences
2. **Conditional Actions**: Execute actions based on complex conditions
3. **A/B Testing**: Test different action implementations
4. **Machine Learning**: Learn optimal action selection from outcomes
5. **External Integrations**: Connect to third-party services

## Example: Complete AI Action Flow

```typescript
// 1. AI decides action during conversation
const conversationalResponse = await buildConversationalResponse(phoneNumber, context)

// 2. Action extracted from AI response
const aiAction = conversationalResponse.actions[0]
// { type: 'send_portal_link', reasoning: 'User ready to proceed', confidence: 0.9 }

// 3. Action executed through registry
const result = await actionRegistry.execute(
  aiAction.type,
  executionContext,
  { reasoning: aiAction.reasoning }
)

// 4. Result processed and logged
if (result.success) {
  console.log('AI SMS | ✅ Portal link sent', { 
    trackingId: result.trackingId,
    reasoning: result.reasoning 
  })
}
```

This architecture enables truly intelligent agents that can take meaningful actions based on natural conversation context while maintaining system reliability and extensibility.
