// Simplified conversational response builder with AI-controlled actions
// Gives AI full autonomy to decide messages and actions naturally

import { chat } from './llm.client'
import { getConversationInsights, type ConversationInsights } from './memory.store'
import { checkLinkConsent } from './consent-manager'
import { FEATURE_FLAGS, isFeatureEnabled } from '../config/feature-flags'
import { KB_SUMMARY } from '../knowledge/kb-summary'
import { SMS_POLICY_PROMPT } from '../prompts/sms.policy'

export type SimplifiedAgentResponse = {
  messages: string[]           // 1-3 natural messages decided by AI
  actions: AgentActionWithReasoning[]  // Actions aligned with conversation
  conversationTone: 'helpful' | 'reassuring' | 'informative' | 'encouraging' | 'consultative'
  reasoning?: string          // AI's decision rationale for debugging
}

export type AgentActionWithReasoning = {
  type: 'send_magic_link' | 'send_case_status_link' | 'send_document_upload_link' | 'send_review_link' | 'send_signup_link' | 'schedule_followup' | 'schedule_callback' | 'none'
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
    pendingRequirementTypes?: string[]
    primaryClaimStatus?: string
    claimLenders?: string[]
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
    // Configure AI model with enhanced logging
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
    
    // Comprehensive success logging for monitoring
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
    
    // Knowledge base is now integrated directly into prompt structure
    // Legacy context.knowledgeContext is rarely used in simplified mode
    
    console.log('AI SMS | ✅ Intelligent response generated', successLog)

    return validatedResponse

  } catch (error) {
    // Detailed error logging for debugging
    const errorLog: any = {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length
    }
    
    // Add detailed error analysis
    if (FEATURE_FLAGS.ENHANCED_TOKEN_TRACKING) {
      errorLog.tokenAnalysis = {
        estimatedInputTokens: Math.round((systemPrompt.length + userPrompt.length) / 4),
        possibleTokenLimit: errorLog.estimatedInputTokens > 120000,
        modelUsed: process.env.AI_SMS_MODEL || 'gpt-4o-mini'
      }
    }
    
    // Simplified mode uses integrated knowledge base approach
    
    console.error('AI SMS | ❌ Error generating intelligent response:', errorLog)
    
    // Fallback response
    return {
      messages: ["I understand your question. How can I help you with your motor finance claim?"],
      actions: [{ type: 'none', reasoning: `Fallback due to error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      conversationTone: 'helpful'
    }
  }
}

// Removed unused prepareKnowledgeBase() function - was dead code
// Knowledge base is now integrated directly into the 6-step prompt structure

// Build the structured 6-step decision process prompt
function preparePromptStructure(existingPrompt: string, context: SimplifiedResponseContext): string {
  console.log('AI SMS | 📝 Structured prompt - applying 6-step checklist format')
  
  // Knowledge base injected directly into STEP 3 template
  
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

⚠️ CRITICAL: Choose exactly ONE action. Multiple actions cause system conflicts.

🔍 FIRST PRIORITY CHECK - USER EXISTENCE:

🆔 SEND_SIGNUP_LINK when:
• User is NOT found in system (userContext.found = false)
• User asks about claims, process, eligibility, or shows interest in services
• First-time interactions with unknown users
• CRITICAL: This is the ONLY action allowed for unknown users - no other actions permitted

🚨 UNKNOWN USER RESTRICTION:
• If userContext.found = false, you can ONLY choose SEND_SIGNUP_LINK or NONE
• NO magic links, case status, document uploads, reviews, or callbacks for unknown users
• They must register first before accessing any other services

═══════════════════════════════════════════════════════════════════════════════

📋 FOR EXISTING USERS ONLY (userContext.found = true):

🚨 CRITICAL CONSENT-FIRST RULE FOR ALL LINK ACTIONS:
📋 CHECK PREVIOUS MESSAGES FIRST:
• Did you offer this specific link in your previous messages?
  → NO: You must OFFER the link in your message, not send it
  → YES: You can send the link if user shows positive readiness

🔗 SEND_MAGIC_LINK when:
• You offered a portal link in your last message AND user shows clear positive response
• User explicitly asks to "send", "resend", or "get" the portal link
• Only if no actual portal URL was sent recently (check STEP 1 conversation history)

📋 SEND_CASE_STATUS_LINK when:
• You offered a case status link in your last message AND user shows positive response
• User explicitly says they want to check their status after you offered
• Clear follow-up to a previous offer, not first-time questions

📤 SEND_DOCUMENT_UPLOAD_LINK when:
• You offered a document upload link in your last message AND user shows positive response  
• User says they want to upload, submit, or send documents after you offered
• User confirms they have documents ready after you offered the upload option
• NOT for questions about what documents are needed (that's information, not action)

⭐ SEND_REVIEW_LINK when:
• User has shown a positive response AND no other link is required
• User expresses genuine satisfaction, gratitude, or positive feedback about the service
• User just completed a positive milestone (signed up, uploaded docs, etc.) AND shows appreciation
• You offered a review link in your last message AND user shows positive response

📞 SCHEDULE_CALLBACK when:
• User explicitly requests a callback ("Can someone call me?", "I'd like a callback", "Please call me back")
• User says they prefer phone calls over text messages
• User mentions they're available at specific times for a call
• Complex issues that would be better resolved over the phone

🚫 NONE for all other scenarios:
• User has questions that need answering first
• User has concerns or objections to address
• User needs clarification or more information
• Building trust and rapport is needed
• You're offering to send a link (asking permission)



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
• CRITICAL: When providing numbered or bulleted lists, start each item on a new line:
  ❌ BAD: "1. First item. 2. Second item. 3. Third item."
  ✅ GOOD: "1. First item.\n\n2. Second item.\n\n3. Third item."
• Use approved emojis naturally when they enhance communication
  Available palette: ✅ ☑️ ✔️ 👍 🎉 💪 🙌 ⭐ 🔒 🛡️ 🔐 🏦 📋 💼 📄 📝 📊 📞 💬 📲 📧 ⏱️ ⏰ 📅 🔄 ➡️ 🚀 ❓ ❗ 💭 💡 🤔 😊 👋 ☺️

🎯 NATURAL CONVERSATION ENDINGS:
• Let your response flow naturally based on the adaptive user journey intelligence from STEP 1
• Trust the context awareness - your ending should feel organic to the conversation
• If your response naturally includes a question or direction, that's perfect
• Only add explicit next steps when the conversation lacks clear direction

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

🔍 ACTION PRIORITY VALIDATION:
□ Is this action definitely required right now?
□ Are there more important actions the user needs first?
□ For SEND_REVIEW_LINK specifically: Is this a good time to offer the review link?
  • Has user completed their primary goal (signing, uploading docs)?
  • Are they expressing genuine satisfaction?
  • Would a portal/document link be more valuable right now? or has it been sent recently? 
  • Is this the natural flow moment for feedback?

🎯 REQUIRED JSON OUTPUT FORMAT:
{
  "messages": ["message1", "message2?"],
  "actions": [{
    "type": "send_magic_link|send_case_status_link|send_document_upload_link|send_review_link|send_signup_link|schedule_callback|none",
    "reasoning": "Why you chose this action (reference steps 1-4)",
    "timing": "immediate", 
    "params": {}
  }],
  "conversationTone": "helpful|reassuring|informative|encouraging",
  "reasoning": "Your overall strategy (reference your 6-step process)"
}

CRITICAL: Only return ONE action. Multiple actions will cause system conflicts.

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
`
  
  // Apply structured 6-step formatting to system prompt
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
  // User found status - CRITICAL for action routing
  const userFoundStatus = context.userContext.found 
    ? 'EXISTING USER ✅ (Found in system - full access to actions)' 
    : 'NEW USER ⚠️ (Not found - ONLY send_signup_link or none allowed)'
    
  const signatureStatus = context.userContext.hasSignature 
    ? 'SIGNED ✅ (Can proceed with claim process)' 
    : 'UNSIGNED ⚠️ (Needs signature to unlock claim investigation)'
    
  const pendingTypes = context.userContext.pendingRequirementTypes || []
  const requirementsStatus = pendingTypes.length > 0 
    ? `Outstanding: ${pendingTypes.join(', ')} ⚠️ (Portal enables document uploads)` 
    : 'Up-to-date ✅ (No outstanding requirements)'

  const claimStatus = context.userContext.primaryClaimStatus 
    ? `Primary Claim: ${context.userContext.primaryClaimStatus}` 
    : 'No active claims found'

  const lenders = context.userContext.claimLenders || []
  const lenderInfo = lenders.length > 0 
    ? `Lenders: ${lenders.join(', ')}` 
    : 'Lender information not available'
    
  return `
📊 USER JOURNEY INTELLIGENCE:

👤 USER STATUS: ${userFoundStatus}
🔒 SIGNATURE STATUS: ${signatureStatus}
📋 REQUIREMENTS STATUS: ${requirementsStatus}
🏦 CLAIM CONTEXT: ${claimStatus} | ${lenderInfo}

🎯 ADAPTIVE CONVERSATION STRATEGY:
• ALWAYS answer their actual question thoroughly FIRST
• Naturally weave in relevant next steps when appropriate  
• Let their responses guide the conversation direction
• Be genuinely helpful, not agenda-driven or pushy
• Match your approach to what they actually need right now
• Use approved emojis naturally when they enhance your message tone and clarity
  Available palette: ✅ ☑️ ✔️ 👍 🎉 💪 🙌 ⭐ 🔒 🛡️ 🔐 🏦 📋 💼 📄 📝 📊 📞 💬 📲 📧 ⏱️ ⏰ 📅 🔄 ➡️ 🚀 ❓ ❗ 💭 💡 🤔 😊 👋 ☺️`
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
  
  // CRITICAL: Ensure only one action to prevent clashes
  if (actions.length > 1) {
    console.log('AI SMS | ⚠️ Multiple actions detected, keeping only the first one:', {
      actionsReceived: actions.map((a: any) => a.type),
      actionKept: actions[0].type
    })
    actions = [actions[0]]
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
    if (action.type === 'send_case_status_link' && context.userContext.userId) {
      action.params = {
        ...action.params,
        userId: context.userContext.userId,
        linkType: action.params.linkType || 'statusUpdate'
      }
    }
    if (action.type === 'send_document_upload_link' && context.userContext.userId) {
      action.params = {
        ...action.params,
        userId: context.userContext.userId,
        linkType: action.params.linkType || 'documentUpload'
      }
    }
    if (action.type === 'send_review_link') {
      action.params = {
        ...action.params,
        userId: context.userContext.userId, // Optional for Trustpilot, but useful for tracking
        userName: context.userName
      }
    }
    if (action.type === 'send_signup_link') {
      action.params = {
        ...action.params,
        userName: context.userName
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
