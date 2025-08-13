// Simplified conversational response builder with AI-controlled actions
// Gives AI full autonomy to decide messages and actions naturally

import { chat } from './llm.client'
import { getConversationInsights, type ConversationInsights } from './memory.store'
import { checkLinkConsent } from './consent-manager'
import { FEATURE_FLAGS, isFeatureEnabled } from '../config/feature-flags'

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
    // PHASE 1 ENHANCEMENT: Enhanced model configuration and logging
    const modelConfig = {
      system: systemPrompt,
      user: userPrompt,
      model: process.env.AI_SMS_MODEL || 'gpt-4o-mini',
      responseFormat: { type: 'json_object' as const }
    }
    
    // Enhanced logging for Phase 2 
    const estimatedTokens = (systemPrompt.length + userPrompt.length) / 4 // rough estimate
    console.log('AI SMS | 🧠 Starting intelligent response generation', {
      model: modelConfig.model,
      estimatedInputTokens: Math.round(estimatedTokens),
      phase2Features: {
        fullKB: true,
        structuredPrompt: true,
        enhancedTokenTracking: true
      },
      promptSections: {
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        totalEstimatedTokens: Math.round(estimatedTokens)
      }
    })
    
    const response = await chat(modelConfig)

    const parsed = JSON.parse(response || '{}') as SimplifiedAgentResponse
    
    // Validate and enhance the response
    const validatedResponse = validateAndEnhanceResponse(parsed, context)
    
    // PHASE 1 ENHANCEMENT: Expanded success logging
    const successLog: any = {
      messageCount: validatedResponse.messages.length,
      actionCount: validatedResponse.actions.length,
      primaryAction: validatedResponse.actions[0]?.type || 'none',
      reasoning: validatedResponse.reasoning?.substring(0, 100) + '...'
    }
    
    // Add enhanced tracking if enabled
    if (FEATURE_FLAGS.ENHANCED_TOKEN_TRACKING) {
      successLog.tokenUsage = {
        estimatedInput: Math.round((systemPrompt.length + userPrompt.length) / 4),
        estimatedOutput: Math.round((response?.length || 0) / 4),
        estimatedCost: Math.round(((systemPrompt.length + userPrompt.length) / 4 * 0.15 + (response?.length || 0) / 4 * 0.60) / 1000000 * 100) / 100
      }
    }
    
    // Add knowledge base utilization tracking if enabled
    if (FEATURE_FLAGS.KB_VALIDATION_ENABLED && context.knowledgeContext) {
      successLog.knowledgeUtilization = {
        kbProvided: !!context.knowledgeContext,
        kbLength: context.knowledgeContext?.length || 0,
        fullKBMode: FEATURE_FLAGS.FULL_KNOWLEDGE_BASE_ENABLED
      }
    }
    
    console.log('AI SMS | ✅ Intelligent response generated', successLog)

    return validatedResponse

  } catch (error) {
    // PHASE 1 ENHANCEMENT: Enhanced error logging
    const errorLog: any = {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length
    }
    
    // Add Phase 1 specific error context
    if (FEATURE_FLAGS.ENHANCED_TOKEN_TRACKING) {
      errorLog.tokenAnalysis = {
        estimatedInputTokens: Math.round((systemPrompt.length + userPrompt.length) / 4),
        possibleTokenLimit: errorLog.estimatedInputTokens > 120000,
        modelUsed: process.env.AI_SMS_MODEL || 'gpt-4o-mini'
      }
    }
    
    if (FEATURE_FLAGS.FULL_KNOWLEDGE_BASE_ENABLED) {
      errorLog.knowledgeBaseContext = {
        fullKBEnabled: true,
        kbIncluded: !!context.knowledgeContext,
        possibleKBIssue: !context.knowledgeContext && FEATURE_FLAGS.FULL_KNOWLEDGE_BASE_ENABLED
      }
    }
    
    console.error('AI SMS | ❌ Error generating intelligent response:', errorLog)
    
    // Fallback response
    return {
      messages: ["I understand your question. How can I help you with your motor finance claim?"],
      actions: [{ type: 'none', reasoning: `Fallback due to error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      conversationTone: 'helpful'
    }
  }
}

// OPTIMIZED: Streamlined knowledge base for efficient AI processing
function prepareKnowledgeBase(context: SimplifiedResponseContext): string {
  console.log('AI SMS | 📚 Streamlined KB mode - providing optimized knowledge base')
  
  // Import streamlined knowledge base
  const { KB_SUMMARY } = require('../knowledge/kb-summary')
  
  // Build efficient knowledge context
  const streamlinedKnowledgeBase = [
    '=== KEY FACTS ===',
    ...KB_SUMMARY.facts.map((fact: string, i: number) => `${i + 1}. ${fact}`),
    '',
    '=== VALUE BENEFITS ===',
    ...KB_SUMMARY.benefits.map((benefit: string, i: number) => `${i + 1}. ${benefit}`),
    '',
        '=== OBJECTION PSYCHOLOGY ===',
    'Psychology Framework: Understand emotional and logical drivers behind objections, then address naturally',
    'Core Approaches: Validate concerns, provide verification, respect autonomy, address value questions',
    'Key Psychology Types: legitimacy, autonomy, value, timeline, news-headline concerns',
    'Natural Response: Use conversational intelligence to craft original responses based on psychology understanding',
    '',
    '=== USAGE NOTES ===',,
    '• Use facts to answer questions accurately',
    '• Use benefits to overcome hesitation',
    '• Follow playbook structure for objections',
    '• Always end with conversion-focused confirmations'
  ].join('\n')
  
  const estimatedTokens = Math.ceil(streamlinedKnowledgeBase.length / 4) // Rough token estimation
  console.log('AI SMS | 📊 Streamlined KB token usage:', { estimatedTokens, kbSize: streamlinedKnowledgeBase.length })
  
  return streamlinedKnowledgeBase
}

// OPTIMIZED: Structured 6-step checklist integrated with streamlined prompt
function preparePromptStructure(existingPrompt: string, context: SimplifiedResponseContext): string {
  console.log('AI SMS | 📝 Structured prompt - applying 6-step checklist format')
  
  // Get knowledge base for STEP 3 injection
  const { KB_SUMMARY } = require('../knowledge/kb-summary')
  
  // Build logically structured prompt that follows the 6-step progression
  const structuredPrompt = `
CRITICAL: Respond with valid JSON in the exact format specified in STEP 6.

🎯 FOLLOW THIS 6-STEP DECISION PROCESS IN ORDER:

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 1: ANALYZE CONVERSATION
═══════════════════════════════════════════════════════════════════════════════

${existingPrompt}

💡 STEP 1 COMPLETE: You now understand the conversation context and user situation.
   → PROCEED TO STEP 2

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 2: UNDERSTAND THE REQUEST
═══════════════════════════════════════════════════════════════════════════════

🔍 ANALYZE what the user really needs (may be multiple things):

🔍 INFORMATION SEEKING
• Questions about fees, process, timelines, eligibility
• "What", "How", "When", "Why" questions
• Seeking clarity or understanding

🛡️ CONCERNS OR OBJECTIONS  
• Scam worries, DIY preference, not interested, court ruling concerns
• Skeptical, hesitant, or pushback language
• Underlying fears or doubts

✅ READINESS TO PROCEED
• "Yes", "send it", "ready", "go ahead", "let's do it"
• Clear agreement to move forward
• Action-oriented language

❓ NEEDS CLARIFICATION
• Unclear message, ambiguous intent
• Multiple possible interpretations
• Follow-up questions needed

💡 IMPORTANT: Many messages contain multiple elements (e.g., information request + underlying concern).
   Consider ALL aspects when selecting knowledge in STEP 3.

💡 STEP 2 COMPLETE: You understand what the user really needs.
   → PROCEED TO STEP 3

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 3: SELECT KNOWLEDGE
═══════════════════════════════════════════════════════════════════════════════

🧠 USE YOUR INTELLIGENT JUDGMENT - Select and combine the most relevant knowledge:

📚 FACTS - Direct information about claims, process, timelines:
${KB_SUMMARY.facts.map((fact: string, i: number) => `${i + 1}. ${fact}`).join('\n')}

💼 BENEFITS - Value propositions and advantages of our service:
${KB_SUMMARY.benefits.map((benefit: string, i: number) => `${i + 1}. ${benefit}`).join('\n')}

🎯 OBJECTION PSYCHOLOGY - Understand and address concerns naturally:

PSYCHOLOGY FRAMEWORK:
• Understand emotional and logical drivers behind each objection
• Address the underlying psychology naturally using facts and benefits  
• Adapt your approach to their communication style and energy
• No rigid scripts - use your conversational intelligence

CORE OBJECTION PSYCHOLOGIES:
• LEGITIMACY CONCERNS: Fear of scams → Validate caution, provide verification (FCA regulation, Prowse Phillips Law)
• AUTONOMY CONCERNS: "I'll do it myself" → Respect capability, highlight practical challenges  
• VALUE CONCERNS: "Is it worth it?" → Acknowledge practical mindset, clarify no-win-no-fee value
• TIMELINE CONCERNS: "Takes too long" → Empathize with frustration, provide realistic expectations
• NEWS CONCERNS: Supreme Court confusion → Acknowledge confusing coverage, clarify current status

INTELLIGENT RESPONSE APPROACH:
• Acknowledge their concern as valid and smart
• Address the underlying fear/need, not just surface objection
• Use relevant facts/benefits to build confidence naturally
• Guide toward next steps when conversation context supports it
• Craft original responses - no templates or repeated phrases

COMPLIANCE REQUIREMENTS:
• No outcome guarantees • No legal/financial advice • Keep PII in portal • Respect consent/cooldowns

💡 KNOWLEDGE SELECTION STRATEGY:
• Choose the most relevant information for THIS specific user and situation
• Combine different knowledge types if that creates a better response
• Consider both explicit questions AND underlying concerns
• Match the depth of response to the user's demonstrated knowledge level
• Prioritize information that moves the conversation toward conversion
• ALWAYS verify accuracy - use only factual information from the knowledge base
• If unsure about any detail, stick to what's explicitly stated in the facts

🔒 COMPLIANCE RULES (ALWAYS FOLLOW):
• No guarantees or promises of specific outcomes
• No legal or financial advice
• Keep PII discussions in portal
• Ask permission before sending links
• ENSURE nothing goes against the facts - all information must be accurate and consistent with knowledge base

💡 STEP 3 COMPLETE: You've intelligently selected the most relevant knowledge.
   → PROCEED TO STEP 4

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 4: CHOOSE ACTION
═══════════════════════════════════════════════════════════════════════════════

🎯 INTELLIGENT ACTION DECISION based on STEP 1 context and STEP 2 understanding:

🔗 SEND_MAGIC_LINK when:
• User demonstrates genuine readiness to proceed based on conversation context and positive engagement
• CRITICAL CONTEXT CHECK: Analyze what YOU just asked in your last message - does their positive response logically relate to moving forward with the portal?
• Examples of RELEVANT positive responses:
  - If you asked about sending the portal link → "Yes", "Send it", "Go ahead" = CLEAR readiness
  - If you asked about getting started → "I'm ready", "Let's do it" = CLEAR readiness
  - If you asked about next steps → "What do I need to do?" = ACTION-ORIENTED readiness
• Examples of IRRELEVANT positive responses:
  - If you asked about fees → "That's reasonable" = POSITIVE but not necessarily ready for portal
  - If you asked about process → "That makes sense" = UNDERSTANDING but not necessarily ready to proceed
  - If you asked about timelines → "Sounds good" = AGREEMENT but context doesn't indicate portal readiness
• CRITICAL: Only if no actual portal URL was sent recently (check STEP 1 conversation history)
• This means you're ACTUALLY SENDING the link, not asking about it

🚫 NONE for all other scenarios:
• User has questions that need answering first
• User has concerns or objections to address
• User needs clarification or more information
• Building trust and rapport is needed
• You're offering to send a link (asking permission)
• Positive response doesn't relate to portal/next steps based on conversation context

💡 CONVERSATION COHERENCE: Always check what YOU just asked before interpreting their response. Positive sentiment about fees, timelines, or process understanding does NOT automatically mean readiness for portal link unless the conversation context clearly indicates next-step intent.

💡 STEP 4 COMPLETE: You've chosen the appropriate action based on user readiness.
   → PROCEED TO STEP 5

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 5: CRAFT MESSAGE
═══════════════════════════════════════════════════════════════════════════════

👋 NOW become Sophie from RMC, helping with motor finance claims (PCP, HP, car loans).

Using knowledge from STEP 3 and action from STEP 4, craft your message as Sophie:

📝 MESSAGE STRUCTURE & FORMAT:

🔄 FOR OBJECTIONS - Use LAARC-LITE format:
1. **Listen/Acknowledge**: Show understanding of their concern
2. **Align/Ask**: Brief empathy or clarifying question if needed
3. **Respond**: Provide 1 key benefit/fact from STEP 3 knowledge
4. **Confirm**: Strong conversion-focused next step


📋 FOR INFORMATION REQUESTS - Use ANSWER + VALUE ADD + CTA format:
1. **Answer**: Direct response using facts from STEP 3
2. **Value Add**: Include 1 relevant benefit that enhances the answer
3. **CTA**: Strong conversion-focused call-to-action

📝 GENERAL MESSAGE REQUIREMENTS:
• Use warm, professional tone with their name: ${context.userName || 'there'}
• Use name sparingly - once at greeting, avoid overuse
• NEVER repeat same information within response  
• 1-3 messages based on complexity
• Be natural and conversational as Sophie
• ENSURE you have not repeated yourself (check for duplicate information)
• ENSURE no profanity or inappropriate language

📱 MESSAGE FORMATTING:
• Add line breaks for readability: "Hi [Name],\n\n[main content]\n\n[closing]"
• Use double line breaks (\n\n) between logical sections for mobile-friendly reading
• Keep paragraphs concise and scannable
• Use approved emojis naturally when they enhance communication (see SMS policy for full list)

🎯 NATURAL CONVERSATION ENDINGS:
• Let your response flow naturally based on the adaptive user journey intelligence from STEP 1
• Trust the context awareness - your ending should feel organic to the conversation
• If your response naturally includes a question or direction, that's perfect
• Only add explicit next steps when the conversation lacks clear direction

✅ IF ACTION = SEND_MAGIC_LINK, USE:
• "Perfect! I'll send your secure portal link right away."

❌ AVOID GENERIC ENDINGS:
• "let me know", "any questions?", "more information", "how can I help"
• Forced or robotic-sounding phrases that don't match conversation flow

💡 STEP 5 COMPLETE: You've crafted your response messages.
   → PROCEED TO STEP 6

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 6: VALIDATE & FORMAT
═══════════════════════════════════════════════════════════════════════════════

✅ FINAL VALIDATION CHECKLIST:
□ Action from STEP 4 matches message intent and user readiness
□ Message uses most relevant knowledge from STEP 3 intelligently
□ Response addresses what the user really needs from STEP 2
□ Conversation context from STEP 1 is acknowledged and built upon
□ Compliance rules followed (no promises/guarantees)
□ Natural conversation flow with appropriate next steps (if action = none)
□ Professional yet natural tone with user's name
□ NO repetition of information within response
□ NO profanity or inappropriate language used
□ Response feels natural and human, not templated or robotic
□ NOTHING contradicts or goes against the facts from the knowledge base

🎯 REQUIRED JSON OUTPUT FORMAT:
{
  "messages": ["message1", "message2?"],
  "actions": [{
    "type": "send_magic_link|none",
    "reasoning": "Why you chose this action (reference steps 1-4)",
    "timing": "immediate", 
    "params": {}
  }],
  "conversationTone": "helpful|reassuring|informative|encouraging",
  "reasoning": "Your overall strategy (reference your 6-step process)"
}

Be intelligent, natural, and conversion-focused.`
  
  return structuredPrompt
}

function buildIntelligentSystemPrompt(
  context: SimplifiedResponseContext, 
  consentStatus: any, 
  insights: ConversationInsights | null
): string {
  // Removed pre-assessment - let AI determine readiness naturally through conversation analysis
  
  // Knowledge base now integrated directly into STEP 3 of the structured prompt
  
  const currentPrompt = `�� CONVERSATION ANALYSIS - Study these details:

📞 CUSTOMER INFORMATION:
• Name: ${context.userName || 'Customer'}
• Status: ${context.userStatus || 'Unknown'}
• Message Count: ${insights?.messageCount || 0} (conversation stage context)
• Link Cooldown: ${consentStatus.hasConsent ? 'Recently gave consent' : 'No recent consent - ask permission first'}

${buildAdaptiveUserContext(context)}

🕒 CONVERSATION HISTORY CHECK:
• Review recent messages below for context
• Look for ANY actual portal links already sent (URLs with "claim.resolvemyclaim.co.uk" or "mlid=")
• CRITICAL: Identify what YOU asked in your LAST message - this determines if their response indicates portal readiness
• Note any previous actions taken or questions answered
• Identify conversation stage and user sentiment

⚠️ CRITICAL CONTEXT POINTS:
• Don't repeat actions recently taken
• Don't ask for something just provided
• Build on previous conversation naturally
• Acknowledge what's already been discussed
• MOST IMPORTANT: Check if their positive response logically connects to portal readiness based on YOUR last question`
  
  // PHASE 1 ENHANCEMENT: Apply structured formatting if enabled (expanded in Phase 2)
  const enhancedPrompt = preparePromptStructure(currentPrompt, context)
  
  return enhancedPrompt
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

// Removed assessUserReadiness function - AI now determines readiness naturally
// No more rigid pattern matching like /(yes|send|ready)/ - trust AI intelligence
// Let the AI analyze conversation context and user intent organically

function buildAdaptiveUserContext(context: SimplifiedResponseContext): string {
  const signatureStatus = context.userContext.hasSignature 
    ? 'SIGNED ✅ (Can proceed with claim process)' 
    : 'UNSIGNED ⚠️ (Needs signature to unlock claim investigation)'
    
  const requirementsCount = context.userContext.pendingRequirements || 0
  const requirementsStatus = requirementsCount > 0 
    ? `${requirementsCount} outstanding items ⚠️ (Portal enables document uploads)` 
    : 'Up-to-date ✅ (No outstanding requirements)'
    
  return `
📊 USER JOURNEY INTELLIGENCE:

🔒 SIGNATURE STATUS: ${signatureStatus}
📋 REQUIREMENTS STATUS: ${requirementsStatus}

🎯 ADAPTIVE CONVERSATION STRATEGY:
• ALWAYS answer their actual question thoroughly FIRST
• Naturally weave in relevant next steps when appropriate  
• Let their responses guide the conversation direction
• Be genuinely helpful, not agenda-driven or pushy
• Match your approach to what they actually need right now
• Use approved emojis naturally when they enhance your message tone and clarity`
}

function validateAndEnhanceResponse(
  response: any, 
  context: SimplifiedResponseContext
): SimplifiedAgentResponse {
  // Ensure we have valid messages
  let messages = Array.isArray(response.messages) ? response.messages : [response.message || "How can I help with your motor finance claim?"]
  messages = messages.filter((msg: any) => typeof msg === 'string' && msg.trim())
  if (messages.length === 0) messages = ["How can I help with your motor finance claim?"]
  
  // Trust natural conversation flow - no forced CTAs
  // The adaptive user journey intelligence from STEP 1 guides appropriate endings
  // AI is instructed to include natural next steps when needed
  
  // Only enhance if message seems genuinely incomplete (very short or no direction)
  const hasNoneAction = response.actions?.some((action: any) => action.type === 'none')
  if (hasNoneAction && messages.length > 0) {
    const lastMessage = messages[messages.length - 1]
    
    // Only add guidance if message is very short and lacks any direction
    const hasNaturalDirection = /[?!]|\b(should|would|can|ready|next|let me|help)\b/i.test(lastMessage)
    const isVeryShort = lastMessage.length < 20
    
    if (isVeryShort && !hasNaturalDirection) {
      // Only in genuinely incomplete responses, add minimal guidance
      messages[messages.length - 1] = lastMessage + " How can I help you further?"
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
