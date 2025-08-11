# Multi-Turn Conversation Planning

## Overview

The multi-turn conversation planning system enables the AI SMS agent to strategically plan and execute follow-up message sequences that maximize conversions while feeling natural and helpful to users.

## Key Features

### 🧠 **AI-Driven Strategy Selection**
- Analyzes conversation context to determine optimal follow-up approach
- Considers user sentiment, conversation phase, and engagement level
- References proven conversation strategies for consistent results

### 🎯 **Goal-Oriented Planning**
- **Signature**: Guide users to sign up via portal link
- **Document Upload**: Help signed users complete document requirements  
- **Objection Handling**: Address concerns and build trust
- **Retention**: Keep engaged users interested and moving forward

### ⏰ **Intelligent Timing**
- Respects business hours (8:00-20:00 UK time)
- Adapts timing based on user psychology and conversation context
- Natural delays that don't feel pushy or automated

### 📊 **Context-Aware Decisions**
- Uses conversation insights (sentiment, topics, objections)
- Considers user status and queue type
- Personalizes based on previous interactions

## How It Works

### 1. **Planning Phase**
```typescript
const planningContext: PlanningContext = {
  userMessage: "What are your fees?",
  currentResponse: "Our fee is up to 30% + VAT on a sliding scale...",
  userFound: true,
  userName: "John",
  queueType: "unsigned_users",
  recentMessages: [...conversation history]
}

const plan = await conversationPlanner.planConversation(phoneNumber, planningContext)
```

### 2. **AI Strategy Generation**
The AI analyzes the context and generates a strategic sequence:
```json
{
  "shouldPlan": true,
  "strategy": "Address fee concerns with value proposition and differentiation",
  "messages": [
    {
      "text": "Quick follow-up - many clients appreciate that our sliding scale means the more we recover, the lower percentage we charge. It keeps our interests aligned.",
      "delayHours": 3,
      "purpose": "Address fee concerns with value proposition"
    },
    {
      "text": "Worth mentioning - we investigate 3 different types of claims to maximise your compensation. Most firms only look at one. Ready to get started?",
      "delayHours": 24,
      "purpose": "Differentiate and offer next step"
    }
  ]
}
```

### 3. **Execution**
The system schedules each message with:
- Intelligent timing adjustments for business hours
- Personalization based on user context
- Metadata tracking for analytics

## Configuration

### Feature Flag
```bash
# Enable/disable conversation planning
AI_SMS_CONVERSATION_PLANNING=true  # default: true
```

### Environment Variables
- `AI_SMS_CONVERSATION_PLANNING`: Enable multi-turn planning (default: true)
- `AI_SMS_MODEL`: LLM model for planning (default: gpt-4o-mini)

## Strategy Examples

### Signature Nurture
For users hesitant about signing up:
```
Turn 1 (3h): Address specific objection with value proposition
Turn 2 (24h): Provide differentiation and gentle call-to-action
```

### Objection Resolution  
For users with trust concerns:
```
Turn 1 (2h): Provide credibility and social proof
Turn 2 (24h): Offer choice between call or testimonials
```

### Document Completion
For signed users who haven't uploaded documents:
```
Turn 1 (6h): Helpful guidance with tips for success
Turn 2 (48h): Remove friction and offer support
```

## Monitoring & Analytics

### Logs
```
AI SMS | 🧠 Planning multi-turn conversation sequence
AI SMS | 📋 Generated conversation plan: {planId, goal, strategy, messageCount}
AI SMS | ✅ Executed conversation plan: {planId, goal, strategy, messagesScheduled}
AI SMS | ⏰ Scheduled planned message: {messageId, purpose, delaySec, planId}
```

### Key Metrics to Track
- **Plan Generation Rate**: % of conversations that generate follow-up plans
- **Plan Completion Rate**: % of planned messages that get sent
- **Conversion Improvement**: Comparison vs single-turn responses
- **User Response Rate**: Engagement with planned messages

## Integration with Existing System

### Backwards Compatibility
- Graceful fallback to legacy followup system
- Feature flag control for safe deployment
- Preserves existing followup.store.ts functionality

### Data Flow
```
SMS Message → Agent Runtime → Conversation Planning → Message Scheduling → Followup Store
```

### Dependencies
- **LLM Client**: For AI-driven strategy generation
- **Memory Store**: For conversation insights and context
- **Followup Store**: For message scheduling and delivery
- **Feature Flags**: For controlled rollout

## Best Practices

### Message Quality
- 1-3 messages maximum per plan
- Each message adds distinct value
- Natural, consultative tone
- Respect user sentiment and context

### Timing Strategy
- First follow-up: 2-4 hours for questions, 4-8 hours for objections
- Second follow-up: 1-2 days if no response  
- Final follow-up: 3-5 days with different approach

### Testing Approach
1. Start with conversation planning enabled in development
2. Monitor logs for plan generation and execution
3. A/B test against legacy system in production
4. Gradually increase rollout based on performance

## Future Enhancements

- **Learning from Outcomes**: Track which strategies convert best
- **Dynamic Timing**: Adjust based on user response patterns
- **A/B Testing**: Automatically test different approaches
- **Cross-Channel**: Extend to email and other channels
- **Predictive Triggers**: Proactive outreach based on behavior patterns
