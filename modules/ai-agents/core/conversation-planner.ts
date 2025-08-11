// Multi-turn conversation planning with AI-driven strategy
// Builds on existing followup.store.ts with intelligent sequencing

import { chat } from './llm.client'
import { getConversationInsights, type ConversationInsights } from './memory.store'
import { scheduleFollowup, withinBusinessHours, secondsUntilBusinessOpen } from './followup.store'
import { redactPII } from './guardrails'
import { getAllStrategiesContext } from '../planning/conversation-strategies'

export type ConversationGoal = 
  | 'signature'           // Get user to sign up
  | 'document_upload'     // Get user to upload documents  
  | 'retention'           // Keep engaged user interested
  | 'objection_handling'  // Address concerns and hesitations
  | 'status_update'       // Provide information and maintain relationship

export type MessagePlan = {
  id: string
  text: string
  delaySec: number
  conditions?: string[]  // Conditions that must be met to send (e.g., "no_reply_received")
  metadata: {
    purpose: string
    conversationGoal: ConversationGoal
    sequenceIndex: number    // 1, 2, 3 in the sequence
    planId: string          // Links messages in same plan
    strategy: string        // Strategy description
  }
}

export type ConversationPlan = {
  planId: string
  goal: ConversationGoal
  strategy: string
  messages: MessagePlan[]
  createdAt: number
  context: {
    userSentiment: string
    conversationPhase: string
    recentTopics: string[]
    objectionsSeen: string[]
  }
}

export type PlanningContext = {
  userMessage: string
  currentResponse: string
  conversationInsights?: ConversationInsights
  userFound: boolean
  userName?: string
  queueType?: string | null
  recentMessages?: Array<{direction: 'inbound' | 'outbound', body: string}>
}

export class ConversationPlanner {
  
  /**
   * Plans a strategic multi-turn sequence based on conversation context
   */
  async planConversation(
    phoneNumber: string,
    context: PlanningContext
  ): Promise<ConversationPlan | null> {
    try {
      // Get conversation insights for planning context
      const insights = context.conversationInsights || await getConversationInsights(phoneNumber)
      
      // Determine conversation goal based on context
      const goal = this.determineConversationGoal(context, insights)
      
      // Skip planning if goal doesn't need follow-up sequences
      if (goal === 'status_update' && !this.needsFollowUp(context, insights)) {
        return null
      }
      
      // Generate AI-planned sequence
      const plan = await this.generatePlanWithAI(phoneNumber, context, insights, goal)
      
      if (!plan || plan.messages.length === 0) {
        return null
      }
      
      console.log('AI SMS | 📋 Generated conversation plan:', {
        planId: plan.planId,
        goal: plan.goal,
        strategy: plan.strategy,
        messageCount: plan.messages.length
      })
      
      return plan
      
    } catch (error) {
      console.error('AI SMS | ❌ Error planning conversation:', error)
      return null
    }
  }
  
  /**
   * Executes a conversation plan by scheduling the messages
   */
  async executePlan(
    phoneNumber: string, 
    plan: ConversationPlan,
    userName?: string,
    userFound: boolean = false
  ): Promise<void> {
    try {
      for (const message of plan.messages) {
        // Personalize message if user found
        let text = message.text
        if (userFound && userName && !text.toLowerCase().startsWith('hi ')) {
          // Only add name if not already personalized
          text = `Hi ${userName}, ${text}`
        }
        
        // Adjust timing for business hours
        let delaySec = message.delaySec
        if (!withinBusinessHours()) {
          // If we're outside business hours, delay until business opens
          const businessDelay = secondsUntilBusinessOpen()
          delaySec = Math.max(delaySec, businessDelay)
        }
        
        await scheduleFollowup(phoneNumber, {
          id: message.id,
          text,
          delaySec,
          metadata: {
            ...message.metadata,
            originalText: message.text,
            personalized: userFound && userName ? true : false
          }
        })
        
        console.log('AI SMS | ⏰ Scheduled planned message:', {
          messageId: message.id,
          purpose: message.metadata.purpose,
          delaySec,
          planId: plan.planId
        })
      }
    } catch (error) {
      console.error('AI SMS | ❌ Error executing plan:', error)
    }
  }
  
  /**
   * Determines conversation goal based on user context and insights
   */
  private determineConversationGoal(
    context: PlanningContext, 
    insights: ConversationInsights | null
  ): ConversationGoal {
    // Handle null insights gracefully
    if (!insights) {
      console.log('AI SMS | ⚠️ No conversation insights available, defaulting to signature goal')
      return context.userFound ? 'retention' : 'signature'
    }
    
    // Check for objections first
    if (insights.objectionsSeen?.length > 0 || insights.userSentiment === 'cautious' || insights.userSentiment === 'frustrated') {
      return 'objection_handling'
    }
    
    // Determine based on user status
    if (!context.userFound) {
      return 'signature'
    }
    
    if (context.queueType === 'unsigned_users') {
      return 'signature'
    }
    
    if (context.queueType === 'outstanding_requests') {
      return 'document_upload'
    }
    
    // If user is asking questions and seems engaged
    if (insights.engagementLevel === 'high' && insights.conversationPhase === 'discovery') {
      return context.userFound ? 'document_upload' : 'signature'
    }
    
    // Default to retention for existing users
    return 'retention'
  }
  
  /**
   * Check if context suggests we need follow-up planning
   */
  private needsFollowUp(context: PlanningContext, insights: ConversationInsights | null): boolean {
    if (!insights) return false
    // Always follow up on objections
    if (insights.objectionsSeen.length > 0) return true
    
    // Follow up if user seems engaged but hasn't taken action
    if (insights.engagementLevel === 'high' && insights.conversationPhase === 'decision_making') return true
    
    // Follow up if user asked complex questions
    if (context.userMessage.split(' ').length > 10) return true
    
    return false
  }
  
  /**
   * Generate conversation plan using AI
   */
  private async generatePlanWithAI(
    phoneNumber: string,
    context: PlanningContext,
    insights: ConversationInsights | null,
    goal: ConversationGoal
  ): Promise<ConversationPlan | null> {
    
    // Use default values for null insights
    const safeInsights = insights || {
      userSentiment: 'neutral',
      conversationPhase: 'discovery',
      topicsDiscussed: [],
      objectionsSeen: []
    }
    const systemPrompt = `You are a conversation planning AI for Sophie at Resolve My Claim (RMC). 

Your job is to plan strategic follow-up message sequences that maximize conversions while feeling natural and helpful.

CONVERSATION GOALS:
- signature: Get user to sign up via portal link
- document_upload: Get signed user to upload required documents  
- objection_handling: Address concerns and build trust
- retention: Keep user engaged and interested

PLANNING PRINCIPLES:
1. Plan 1-3 messages maximum (quality over quantity)
2. Each message should add value or address psychology
3. Timing should feel natural (not pushy)
4. Respect user sentiment and conversation phase
5. Build momentum toward the goal

TIMING GUIDELINES:
- First follow-up: 2-4 hours for questions, 4-8 hours for objections
- Second follow-up: 1-2 days if no response
- Final follow-up: 3-5 days with different approach

PROVEN STRATEGIES:
${getAllStrategiesContext()}

TONE: Professional, helpful, consultative. No emojis. Brief but valuable.

OUTPUT: JSON only, with this structure:
{
  "shouldPlan": boolean,
  "strategy": "description of approach",
  "messages": [
    {
      "text": "message content",
      "delayHours": number,
      "purpose": "why this message"
    }
  ]
}`

    const userPrompt = `CONTEXT:
Goal: ${goal}
User message: "${redactPII(context.userMessage)}"
Current response: "${context.currentResponse}"
User sentiment: ${safeInsights.userSentiment}
Conversation phase: ${safeInsights.conversationPhase}
Engagement level: ${safeInsights.engagementLevel || 'medium'}
User found in system: ${context.userFound}
Queue type: ${context.queueType || 'unknown'}
Recent topics: ${safeInsights.topicsDiscussed.slice(-3).join(', ')}
Objections seen: ${safeInsights.objectionsSeen.join(', ')}
Message count: ${safeInsights.messageCount || 0}

Recent conversation:
${context.recentMessages?.slice(-3).map(m => `${m.direction === 'inbound' ? 'User' : 'Sophie'}: ${redactPII(m.body)}`).join('\n') || 'No recent messages'}

Plan a strategic follow-up sequence that addresses the user's needs and moves them toward the goal.`

    try {
      const response = await chat({
        system: systemPrompt,
        user: userPrompt,
        model: 'gpt-4o-mini',
        responseFormat: { type: 'json_object' }
      })
      
      const parsed = JSON.parse(response)
      
      if (!parsed.shouldPlan || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
        return null
      }
      
      const planId = `plan_${Date.now()}_${phoneNumber.slice(-4)}`
      
      const messages: MessagePlan[] = parsed.messages.map((msg: any, index: number) => ({
        id: `${planId}_msg_${index + 1}`,
        text: msg.text,
        delaySec: (msg.delayHours || 4) * 3600, // Convert hours to seconds
        metadata: {
          purpose: msg.purpose || 'Follow-up',
          conversationGoal: goal,
          sequenceIndex: index + 1,
          planId,
          strategy: parsed.strategy
        }
      }))
      
      return {
        planId,
        goal,
        strategy: parsed.strategy,
        messages,
        createdAt: Date.now(),
        context: {
          userSentiment: safeInsights.userSentiment,
          conversationPhase: safeInsights.conversationPhase,
          recentTopics: safeInsights.topicsDiscussed.slice(-3),
          objectionsSeen: safeInsights.objectionsSeen
        }
      }
      
    } catch (error) {
      console.error('AI SMS | ❌ Error generating plan with AI:', error)
      return null
    }
  }
}

// Singleton instance
export const conversationPlanner = new ConversationPlanner()
