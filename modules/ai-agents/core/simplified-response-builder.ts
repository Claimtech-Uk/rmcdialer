// Simplified conversational response builder with AI-controlled actions
// Gives AI full autonomy to decide messages and actions naturally

import { chat } from './llm.client'
import { getConversationInsights, type ConversationInsights } from './memory.store'
import { checkLinkConsent } from './consent-manager'

export type SimplifiedAgentResponse = {
  messages: string[]           // 1-3 natural messages decided by AI
  actions: AgentActionWithReasoning[]  // Actions aligned with conversation
  conversationTone: 'helpful' | 'reassuring' | 'informative' | 'encouraging' | 'consultative'
  reasoning?: string          // AI's decision rationale for debugging
}

export type AgentActionWithReasoning = {
  type: 'send_magic_link' | 'send_review_link' | 'schedule_followup' | 'none'
  reasoning: string          // Why this action was chosen
  timing?: 'immediate' | 'after_messages'
  params?: {
    userId?: number
    phoneNumber?: string
    linkType?: 'claimPortal' | 'documentUpload'
    delaySeconds?: number
    message?: string
  }
}

export type SimplifiedResponseContext = {
  userMessage: string
  userName?: string
  recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}>
  conversationInsights?: ConversationInsights
  knowledgeContext?: string
  userStatus?: string
  userContext: {
    found: boolean
    userId?: number
    queueType?: string
    hasSignature?: boolean | null
    pendingRequirements?: number
  }
}

export async function buildSimplifiedResponse(
  phoneNumber: string,
  context: SimplifiedResponseContext
): Promise<SimplifiedAgentResponse> {
  
  // Get conversation insights for intelligent decision making
  const insights = context.conversationInsights || await getConversationInsights(phoneNumber)
  
  // Build comprehensive context for AI decision making
  const recentTranscript = context.recentMessages
    .slice(-6) // Last 6 messages for context
    .map(m => `${m.direction === 'inbound' ? 'User' : 'Sophie'}: ${m.body}`)
    .join('\n')

  // Check consent context for link decisions
  const consentStatus = await checkLinkConsent(phoneNumber, context.userMessage, {
    messageCount: insights?.messageCount || 0,
    recentMessages: context.recentMessages
  })

  const systemPrompt = buildIntelligentSystemPrompt(context, consentStatus, insights)
  const userPrompt = buildIntelligentUserPrompt(context, recentTranscript)

  try {
    console.log('AI SMS | 🧠 Starting intelligent response generation')
    
    const response = await chat({
      system: systemPrompt,
      user: userPrompt,
      model: process.env.AI_SMS_MODEL || 'gpt-4o-mini',
      responseFormat: { type: 'json_object' }
    })

    const parsed = JSON.parse(response || '{}') as SimplifiedAgentResponse
    
    // Validate and enhance the response
    const validatedResponse = validateAndEnhanceResponse(parsed, context)
    
    console.log('AI SMS | ✅ Intelligent response generated', {
      messageCount: validatedResponse.messages.length,
      actionCount: validatedResponse.actions.length,
      primaryAction: validatedResponse.actions[0]?.type || 'none',
      reasoning: validatedResponse.reasoning?.substring(0, 100) + '...'
    })

    return validatedResponse

  } catch (error) {
    console.error('AI SMS | ❌ Error generating intelligent response:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length
    })
    
    // Fallback response
    return {
      messages: ["I understand your question. How can I help you with your motor finance claim?"],
      actions: [{ type: 'none', reasoning: `Fallback due to error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      conversationTone: 'helpful'
    }
  }
}

function buildIntelligentSystemPrompt(
  context: SimplifiedResponseContext, 
  consentStatus: any, 
  insights: ConversationInsights | null
): string {
  const userReadiness = assessUserReadiness(context, insights)
  const conversationGoal = determineConversationGoal(context)
  
  return `You are Sophie from RMC, helping with motor finance claims (PCP, HP, car loans).

🚨 MANDATORY: If your action is "none", your FINAL sentence MUST be ONE of these EXACT phrases:
• "Do you have any more questions or should we get you signed up?"
• "All we need to get started is your signature - should I send you the link?"
• "Ready to get started? Should I send you the link to get signed up?"
• "Should we get you signed up now?"

CRITICAL: Respond with valid JSON in the exact format below:
{
  "messages": ["message1", "message2?", "message3?"],
  "actions": [
    {
      "type": "send_magic_link|send_review_link|schedule_followup|none",
      "reasoning": "Why you chose this action",
      "timing": "immediate|after_messages",
      "params": { /* action-specific parameters */ }
    }
  ],
  "conversationTone": "helpful|reassuring|informative|encouraging|consultative",
  "reasoning": "Your overall strategy for this response"
}

CONVERSATION INTELLIGENCE:
- User Context: ${context.userContext.found ? 'Known customer' : 'New prospect'}
- User Status: ${context.userStatus || 'Unknown'}
- Conversation Goal: ${conversationGoal}
- User Readiness: ${userReadiness}
- Previous Link Activity: ${consentStatus.hasConsent ? 'Has given consent' : 'No recent consent'}

🎯 MANDATORY: Every response where action=none MUST end with one of these EXACT phrases:
   • "Do you have any more questions or should we get you signed up?"
   • "All we need to get started is your signature - should I send you the link?"
   • "Ready to get started? Should I send you the link to get signed up?"
   • "Should we get you signed up now?"

❌ FORBIDDEN endings: "let me know", "any questions", "more information", "how can I help"

ACTION DECISION FRAMEWORK:

🔍 FIRST: ANALYZE CONVERSATION HISTORY
Before choosing any action, carefully review the "Recent conversation" section:
- Has an ACTUAL portal link URL been provided? Look for "claim.resolvemyclaim.co.uk" or "mlid=" 
- Look for phrases like "here's your secure portal link:" or "here's your link:"
- What was the last action taken? Don't repeat it unless user explicitly requests again
- Has user already received what they're asking for?
- Is this a continuation of a previous topic or a new request?

🔗 SEND_MAGIC_LINK when:
- User has CONFIRMED they want the link: "yes", "send it", "ready", "let's do it"
- User has explicitly said "yes" to a previous offer to send the link
- User has given explicit consent: ${consentStatus.hasConsent}
- CRITICAL: ONLY if no ACTUAL portal link URL was provided in recent conversation
- NEVER if you see "claim.resolvemyclaim.co.uk" or "mlid=" (actual links) in recent messages
- This action means you are ACTUALLY SENDING the link, not asking about it

⭐ SEND_REVIEW_LINK when:
- User expresses satisfaction: "great", "thanks", "sorted"
- User indicates completion or success  
- Conversation naturally concludes positively
- ONLY if no review link sent recently

📅 SCHEDULE_FOLLOWUP when:
- User needs time to think
- Promised to check back later
- User requested specific timing

🚫 NONE when (but ALWAYS end with conversion-focused CTA):
- User has concerns to address first → Answer concern, then: "Do you have any more questions or should we get you signed up?"
- More information needed → Provide info, then: "All we need to get started is your signature - should I send you the link?"
- Building trust and rapport → Build trust, then: "Ready to get started? Should I send you the link to get signed up?"
- User asks about next steps or process → Answer, then: "All we need to get started is your signature - should I send you the link?"
- ACTUAL portal link URL was ALREADY provided in recent conversation (answer questions instead)
- Any action was recently completed (provide support instead)
- MANDATORY: Every "none" action MUST end with a signup-focused question unless link already sent

MESSAGE GUIDELINES:
- Use 1-3 messages naturally based on complexity
- NEVER repeat the same information within your response (e.g., don't mention "30% + VAT" twice)
- Always end with a STRONG call-to-action that drives toward conversion/signup
- Be warm, professional, and use customer name when available: "${context.userName || 'there'}"
- Focus on motor finance claims expertise
- If ACTUAL portal link URL was already provided, focus on helping with the portal or answering questions
- Don't repeat information that was just provided in recent conversation
- Distinguish: Asking "want the link?" vs actually providing "claim.resolvemyclaim.co.uk/..."

🚨 CRITICAL RULE: Your final sentence MUST be a conversion-focused question.

If action is "none" - Your response MUST end with this EXACT template:
"[Answer their question]. [ONE of these exact phrases]:"
• "Do you have any more questions or should we get you signed up?"
• "All we need to get started is your signature - should I send you the link?"
• "Ready to get started? Should I send you the link to get signed up?"
• "Should we get you signed up now?"

If action is "send_magic_link" - Use: "Perfect! I'll send your secure portal link right away."

❌ DO NOT USE: "let me know", "any questions?", "more information", "how can I help", "feel free to ask"

CONTEXT AWARENESS: Always acknowledge what was already discussed or provided.
Don't ask to send something that was just sent. Don't repeat actions that just happened.
KEY: Only consider a link "sent" when you see the actual URL (claim.resolvemyclaim.co.uk), not when asking about sending.

Be intelligent, natural, action-oriented, and contextually aware.`
}

function buildIntelligentUserPrompt(
  context: SimplifiedResponseContext,
  recentTranscript: string
): string {
  const lines: string[] = []
  
  if (context.userName) lines.push(`Customer: ${context.userName}`)
  if (context.userStatus) lines.push(`Status: ${context.userStatus}`)
  if (context.knowledgeContext) lines.push(`Relevant info: ${context.knowledgeContext}`)
  
  lines.push(`Recent conversation:\n${recentTranscript}`)
  lines.push(`User: ${context.userMessage}`)
  
  return lines.join('\n')
}

function assessUserReadiness(
  context: SimplifiedResponseContext, 
  insights: ConversationInsights | null
): string {
  const msg = context.userMessage.toLowerCase()
  
  // Strong readiness signals
  if (/(yes|send|ready|let's|go ahead|proceed|start)/i.test(msg)) return 'ready'
  
  // Interest signals
  if (/(how|what|when|process|next)/i.test(msg)) return 'interested'
  
  // Concern signals  
  if (/(but|however|worried|concerned|unsure)/i.test(msg)) return 'hesitant'
  
  // Default based on message count
  const messageCount = insights?.messageCount || 0
  if (messageCount > 3) return 'interested'
  if (messageCount > 1) return 'curious'
  
  return 'curious'
}

function determineConversationGoal(context: SimplifiedResponseContext): string {
  if (!context.userContext.found) return 'inform_and_assess'
  if (context.userContext.hasSignature === false) return 'guide_to_portal'
  if ((context.userContext.pendingRequirements || 0) > 0) return 'guide_to_uploads'
  
  const msg = context.userMessage.toLowerCase()
  if (/(done|finished|sorted|complete|thanks)/i.test(msg)) return 'collect_feedback'
  
  return 'provide_support'
}

function validateAndEnhanceResponse(
  response: any, 
  context: SimplifiedResponseContext
): SimplifiedAgentResponse {
  // Ensure we have valid messages
  let messages = Array.isArray(response.messages) ? response.messages : [response.message || "How can I help with your motor finance claim?"]
  messages = messages.filter((msg: any) => typeof msg === 'string' && msg.trim())
  if (messages.length === 0) messages = ["How can I help with your motor finance claim?"]
  
  // Enforce strong CTAs for 'none' actions
  const hasNoneAction = response.actions?.some((action: any) => action.type === 'none')
  if (hasNoneAction && messages.length > 0) {
    const lastMessage = messages[messages.length - 1]
    const requiredCTAs = [
      "Do you have any more questions or should we get you signed up?",
      "All we need to get started is your signature - should I send you the link?", 
      "Ready to get started? Should I send you the link to get signed up?",
      "Should we get you signed up now?"
    ]
    
    const hasRequiredCTA = requiredCTAs.some(cta => lastMessage.includes(cta))
    if (!hasRequiredCTA) {
      // Force add the CTA if missing
      messages[messages.length - 1] = lastMessage + " Do you have any more questions or should we get you signed up?"
    }
  }
  
  // Ensure we have valid actions
  let actions = Array.isArray(response.actions) ? response.actions : []
  if (actions.length === 0) {
    actions = [{ type: 'none', reasoning: 'Continue conversation without specific action' }]
  }
  
  // Validate action structure
  actions = actions.map((action: any) => ({
    type: action.type || 'none',
    reasoning: action.reasoning || 'No reasoning provided',
    timing: action.timing || 'immediate',
    params: action.params || {}
  }))
  
  // Enhance with user context
  actions = actions.map((action: any) => {
    if (action.type === 'send_magic_link' && context.userContext.userId) {
      action.params = {
        ...action.params,
        userId: context.userContext.userId,
        linkType: action.params.linkType || 'claimPortal'
      }
    }
    return action
  })
  
  return {
    messages,
    actions,
    conversationTone: response.conversationTone || 'helpful',
    reasoning: response.reasoning
  }
}
