// Simplified conversational response builder with AI-controlled actions
// Gives AI full autonomy to decide messages and actions naturally

import { universalChat, type MultiProviderChatResult } from './multi-provider-llm.client'
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
  type: 'schedule_callback' | 'none'  // Only callback remains as a true action
  reasoning: string          // Why this action was chosen (links are handled in messages)
  timing?: 'scheduled' | 'none'
  params?: {
    phoneNumber?: string
    window?: string
    reason?: string
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
    // ENHANCED: Claim-specific requirements grouped by lender
    claimRequirements?: Array<{
      claimId: number
      lender: string
      status: string
      pendingRequirements: string[]
    }>
    // New fields for 7-step structure
    claims?: Array<{ id: string, status: string, lender?: string }>
    locale?: string
    pii_risk?: boolean
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

  // Pre-generate links for the AI to use in messages
  const links = await generateLinks(context)

  const systemPrompt = buildIntelligentSystemPrompt(context, consentStatus, insights, links)
  const userPrompt = buildIntelligentUserPrompt(context, recentTranscript)

  try {
    // Configure AI model with enhanced logging
    const modelConfig = {
      system: systemPrompt,
      user: userPrompt,
      model: process.env.AI_SMS_MODEL || 'claude-sonnet-4-20250514',
      responseFormat: { type: 'json_object' as const }
    }
    
    // Enhanced logging for Phase 2 
    const estimatedTokens = (systemPrompt.length + userPrompt.length) / 4 // rough estimate
    console.log(`AI SMS | 🧠 Starting ${modelConfig.model} response generation`, {
      requestedModel: modelConfig.model,
      estimatedInputTokens: Math.round(estimatedTokens),
      phase2Features: {
        fullKB: true,
        structuredPrompt: true,
        enhancedTokenTracking: true,
        claudeUpgrade: true
      },
      promptSections: {
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        totalEstimatedTokens: Math.round(estimatedTokens)
      }
    })
    
    // Use enhanced universal chat with Claude Sonnet 4.0 and fallback support
    const chatResult: MultiProviderChatResult = await universalChat(modelConfig)

    const parsed = JSON.parse(chatResult.content || '{}') as SimplifiedAgentResponse
    
    // Validate and enhance the response
    const validatedResponse = validateAndEnhanceResponse(parsed, context, phoneNumber)
    
    // Enhanced success logging with model details
    const successLog: any = {
      messageCount: validatedResponse.messages.length,
      actionCount: validatedResponse.actions.length,
      primaryAction: validatedResponse.actions[0]?.type || 'none',
      reasoning: validatedResponse.reasoning?.substring(0, 100) + '...',
      // Enhanced tracking from universal chat
      modelUsed: chatResult.modelUsed,
      provider: chatResult.provider,
      fallbacksUsed: chatResult.fallbacksUsed,
      totalTime: chatResult.totalTime
    }
    
    // Add enhanced tracking if enabled
    if (FEATURE_FLAGS.ENHANCED_TOKEN_TRACKING) {
      successLog.tokenUsage = {
        estimatedInput: Math.round((systemPrompt.length + userPrompt.length) / 4),
        estimatedOutput: Math.round((chatResult.content?.length || 0) / 4),
        // Updated cost calculation for Claude Sonnet 4.0 (much cheaper!)
        estimatedCost: Math.round(((systemPrompt.length + userPrompt.length) / 4 * 0.003 + (chatResult.content?.length || 0) / 4 * 0.015) / 1000 * 100) / 100
      }
    }
    
    // Knowledge base is now integrated directly into prompt structure
    // Legacy context.knowledgeContext is rarely used in simplified mode
    
    console.log(`AI SMS | ✅ ${chatResult.modelUsed} response generated`, successLog)

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

// Generate pre-built links for the AI to include in messages
async function generateLinks(context: SimplifiedResponseContext): Promise<{
  portalLink: string | null
  reviewLink: string | null
  signupLink: string | null
}> {
  const baseUrl = process.env.MAIN_APP_URL || 'https://claim.resolvemyclaim.co.uk'
  
  let portalLink = null
  
  // Generate portal link for existing users
  if (context.userContext.found && context.userContext.userId) {
    try {
      // Generate a magic link token for this user
      const { generateAIMagicLink } = await import('./ai-magic-link-generator')
      const magicLink = generateAIMagicLink(context.userContext.userId)
      portalLink = magicLink.url // Keep full URL with https:// for mobile compatibility
    } catch (error) {
      console.error('Failed to generate portal link:', error)
      portalLink = null
    }
  }
  
  // Review link from environment
  const reviewLink = process.env.TRUSTPILOT_REVIEW_URL || null
  
  // Signup link is just the base URL without magic token (keep https:// for mobile)
  const signupLink = `${baseUrl}/claims`
  
  return {
    portalLink,
    reviewLink,
    signupLink
  }
}

// Build the structured 7-step deterministic decision process prompt
function preparePromptStructure(existingPrompt: string, context: SimplifiedResponseContext): string {
  console.log('AI SMS | 📝 Structured prompt - applying 6-step format with link integration')
  
  // Build enhanced context awareness section
  const contextAwarenessSection = buildContextAwarenessSection(context)
  
  // Build logically structured prompt that follows the 6-step progression
  const structuredPrompt = `
CRITICAL: Return valid JSON that matches the Output Schema in STEP 6.
Only discuss motor finance claims.
Do not include explanations, system messages, or extra fields outside the schema.

═══════════════════════════════════════════════════════════════════════════════
🔄 SEQUENTIAL EXECUTION PROTOCOL
═══════════════════════════════════════════════════════════════════════════════

Process each step in order: 1→2→3→4→5→6
• Complete each step fully before moving to the next
• Use each step's output as the next step's input  
• Follow explicit redirects when a step instructs them (e.g., "skip to", "override", "clarity gate")
• Never look ahead or revise earlier decisions

═══════════════════════════════════════════════════════════════════════════════
📌 INPUTS PROVIDED
═══════════════════════════════════════════════════════════════════════════════

${existingPrompt}

${contextAwarenessSection}

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 1 — CONVERSATION ANALYSIS (produce a single mode)
═══════════════════════════════════════════════════════════════════════════════

Analyze current_user_message in the context of conversation_history.

📝 Language: Mirror the user's language where possible.

🛡️ Natural Conversation Ending Safety Net (PRIORITY GATE):
• Is this a natural acknowledgment after we provided what they needed?
  → Recent Sophie message contains: portal link, information provided, or completed explanation
  → User responds with acknowledgment: "okay", "thanks", "got it", "perfect", "cheers", "understood", "alright", "cool"
  → Set mode = "natural_ending"
  → SKIP ALL STEPS - let conversation end naturally with no response
• Not a natural ending → continue to clarity check below

🔍 Clarity Check (CRITICAL GATE):
• Unclear/gibberish/one-word message detected?
  → Set mode = "needs_clarification"
  → SKIP STEPS 2-6
  → Go directly to Step 7 with clarification message
• Clear intent → continue to classification below

📊 Classify mode (choose exactly ONE based on intent, not specific phrases):
• action_request – user explicitly asks for/accepts an action or link (intent: requesting or accepting services)
• info_request – seeking information/education (intent: questions starting with why/how/when/who/what about claims, process, fees, eligibility, etc.)
• status_request – wants claim progress updates
• satisfaction – expresses thanks/praise/positive milestone
• objection – declines service or negative response 
• consent_needed – set by Step 3 when we need to offer before sending
• needs_routing – mixed/complex intent that isn't clearly any above
• needs_clarification – unclear/gibberish input requiring clarification

⚠️ Explicit consent rule: If mode === action_request, treat that as valid consent (skip consent checks later).

💡 Output of Step 1: a single mode

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 1B — OBJECTION DETECTION (if objection or concern detected)
═══════════════════════════════════════════════════════════════════════════════

If mode === "objection" OR user shows concern/objection, identify the type:

🧠 Objection Psychology Map:
• legitimacyConcerns: (e.g., questions about authenticity, scams, company identity) → Address with FCA regulation
• autonomyConcerns: (e.g., expressions of self-sufficiency or declining assistance) → Show value of finding old agreements
• valueConcerns: (e.g., inquiries about pricing, fees, or value proposition) → Emphasize no-win-no-fee structure
• timelineConcerns: (e.g., concerns about duration, delays, or waiting periods) → Set realistic expectations
• newsHeadlineConcerns: (e.g., references to Supreme Court ruling or claims being dead) → Clarify DCA still valid

📝 Quick Response Patterns:
${Object.entries(KB_SUMMARY.objectionQuickResponses || {}).slice(0, 4).map(([key, response]) => 
  `• ${key}: "${response.substring(0, 80)}..."`
).join('\n')}

🎯 If objection detected, apply LAARC-Lite in Step 6:
1. ACKNOWLEDGE: Show genuine understanding of their concern
2. ADDRESS: Use relevant facts + the linkedBenefit from the KB section
3. GUIDE: Offer a soft next step, not a pushy directive

💡 Output of Step 1B: objection_type (if detected) or null

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 2 — BUSINESS PRIORITY (deterministic lane selection)
═══════════════════════════════════════════════════════════════════════════════

Choose the business lane BEFORE reading knowledge.

🚨 CRITICAL OVERRIDE - OBJECTION:
If mode === "objection" → lane = "none" → NO ACTIONS ALLOWED
⛔ User is declining service - respect autonomy completely - answer only, no offers/links

🔐 Authorization / Risk Gate (override):
• If userContext.found === false → only send_signup_link is eligible (for interest in services) or none
• If userContext.pii_risk === true → prefer schedule_callback (security concern acknowledged)

📊 Enhanced Priority Matrix with Stage Intelligence (first match wins):

1. UNSIGNED STAGE: if hasSignature === false → lane = "signature"
   why: "We need your signature to run a soft credit check, and investigate your claims"
   whatWeNeed: "signature + photo ID if availible"
   completionPromise: "Once you've signed and uploaded your ID, we'll investigate all your agreements for multiple claim types"
   supportOffer: "If you have trouble with the portal, just reply and I'll guide you through it"

2. REQUIREMENTS STAGE: if pendingRequirementTypes.length > 0 → lane = "requirements"
   why: "We need additional evidence to help us investigate your claims"
   whatWeNeed: "[Dynamic based on pendingRequirementTypes]"
   completionPromise: "Once you've uploaded [specific requirements], we'll fast-track your case to our legal team"
   supportOffer: "If you can't provide the requirements, let me know and we'll work through it together."

3. STATUS STAGE: if user asks for updates and account is up to date → lane = "status"
   why: "Your case is actively being processed - we're handling all lender communications"
   completionPromise: "we'll keep you updated with any progress"
   supportOffer: "If you have any questions about the process, I'm here to help"

4. SATISFACTION STAGE: if positive milestone/thanks → lane = "review"
   why: "You've enjoyed the process - help others by sharing your experience"
   completionPromise: "Your review helps other people understand what to expect from the us"
   supportOffer: "If you're not sure what to write, I can suggest some key points to cover"

5. Support priority: if complexity or explicit human help requested → lane = "support"
6. None: if questions must be answered first or trust-building needed → lane = "none"

💡 Output of Step 2: a single lane (signature|requirements|status|review|support|none)

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 3 — CONSENT VALIDATION (gate actions unless explicit)
═══════════════════════════════════════════════════════════════════════════════

Execute only if mode ∉ {"action_request"} (action_request = automatic consent).

🔍 Analyze conversation_history[-1] for offer detection:
• If we offered in last message → check current response for acceptance/refusal
• Track offer type for appropriate follow-up

📊 If last_offer exists:
• Positive acceptance (clear agreement intent) → consent = true
• Refusal/objection → mode = objection, consent = false  
• Unclear/no response to offer → mode = info_request, consent = false (answer their topic; do not push)

📊 If no last_offer:
• If userContext.linkCooldownActive === true → consent = false, mode = "consent_needed"
• Else if mode === "info_request" AND business lane requires action → consent = false, mode = "consent_needed" (must offer first)
• Else if mode ∈ {"status_request", "satisfaction"} → consent = true (these can proceed directly)
• Else → consent = false, mode = "consent_needed" (default: offer before action)

💡 Output of Step 3: consent = true|false AND potentially updated mode
Note: If consent === false, mode should be "consent_needed" and action will be none (offer in message instead).

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 4 — KNOWLEDGE SELECTION
═══════════════════════════════════════════════════════════════════════════════

📚 KNOWLEDGE BASE (select relevant facts naturally):

${JSON.stringify(KB_SUMMARY, null, 2)}

💡 Output of Step 4: Select relevant knowledge for your response

═══════════════════════════════════════════════════════════════════════════════
📋 STEP 5 — WRITE THE MESSAGE (with link integration)
═══════════════════════════════════════════════════════════════════════════════

You've made all decisions. Now write Sophie's response using what you determined:
• Mode from Step 1
• Business lane from Step 2
• Consent status from Step 3
• KB facts from Step 4

🔗 Link Inclusion Rules (based on lane + consent):
• Lane "signature|requirements|status" + consent === true → Include portal_link in message
• Lane "review" + consent === true → Include review_link in message
• Lane "none" + userContext.found === false + interest shown → Include signup_link
• Mode "consent_needed" → OFFER links but don't include them yet
• Mode "objection" → NEVER include or offer any links



📝 Structured Block Message Format by Mode:

🎭 Sophie's voice: Helpful pcp claims advisor, warm, friendly, likeable.

info_request/consent_needed:
(Greeting if first) + (FIRST: Answer their specific questions completely using KB facts) + \\n\\n + (THEN: Stage.why + Stage.completionPromise from stage intelligence) + \\n\\n + (FINALLY: Link offer based on consent rules)

action_request:
(Confirmation acknowledgment) + \\n\\n + (Include relevant link) + \\n\\n + (Stage.completionPromise) + \\n\\n + (Stage.supportOffer)

objection:
(Acknowledge their concern genuinely) + \\n\\n + (Objection-specific benefit addressing their worry) + \\n\\n + (Respect their autonomy - no pressure)
⛔ NEVER include or offer links when objection detected

status_request:
(Direct status response) + \\n\\n + (Stage.completionPromise if applicable) + \\n\\n + (Include portal link if consent allows)

satisfaction:
(Thank them for positive feedback) + \\n\\n + (Stage.completionPromise for reviews) + \\n\\n + (Include review link if appropriate)

📱 Format: 
• MUST Use double line breaks (\\n\\n) After name, before closing statement or question. And where appropriate for mobile readability. 
• Max 900 chars total. 
• use at least 1 emoji per message. 

🚨 CRITICAL PRIORITY: 
For info_request modes, you MUST answer their specific questions FIRST before discussing what you need from them. Questions come before requirements, always.



═══════════════════════════════════════════════════════════════════════════════
📋 STEP 6 — OUTPUT JSON
═══════════════════════════════════════════════════════════════════════════════

Trust your work from Steps 1-5. Simply format as JSON.

⚡ CLARITY GATE SHORTCUT:
If mode = "needs_clarification" from Step 1:
→ Output: { "messages": ["Could you tell me more about what you need help with?"], 
           "actions": [{ "type": "none", "reasoning": "Unclear input - requesting clarification" }],
           "conversationTone": "helpful" }

🎯 OUTPUT SCHEMA (return ONLY this JSON):
{
  "messages": ["single_unified_message_with_links_included"],
  "actions": [{
    "type": "schedule_callback|none",
    "reasoning": "Only callbacks remain as actions - links are handled in messages",
    "timing": "scheduled|none",
    "params": {}
  }],
  "conversationTone": "helpful|reassuring|informative|encouraging",
  "reasoning": "Mode: [step1_mode], Lane: [step2_lane], Consent: [step3_consent]"
}`
  
  return structuredPrompt
}

// Helper function to detect if we offered a link/action in the last message
function detectLastOffer(lastMessage: any): any {
  if (!lastMessage || lastMessage.direction !== 'outbound') {
    return null
  }
  
  const body = lastMessage.body.toLowerCase()
  
  // Check for common offer patterns
  if (body.includes('should i send') || body.includes('can i send') || body.includes('would you like me to send')) {
    if (body.includes('portal') || body.includes('link')) {
      return { type: 'magic_link', timestamp: new Date().toISOString() }
    }
    if (body.includes('upload') || body.includes('document')) {
      return { type: 'document_upload_link', timestamp: new Date().toISOString() }
    }
    if (body.includes('status') || body.includes('update')) {
      return { type: 'case_status_link', timestamp: new Date().toISOString() }
    }
    if (body.includes('review') || body.includes('trustpilot')) {
      return { type: 'review_link', timestamp: new Date().toISOString() }
    }
    if (body.includes('call') || body.includes('callback')) {
      return { type: 'callback', timestamp: new Date().toISOString() }
    }
  }
  
  return null
}

function buildIntelligentSystemPrompt(
  context: SimplifiedResponseContext, 
  consentStatus: any, 
  insights: ConversationInsights | null,
  links: { portalLink: string | null, reviewLink: string | null, signupLink: string | null }
): string {
  // Removed pre-assessment - let AI determine readiness naturally through conversation analysis
  
  // Knowledge base now integrated directly into STEP 5 of the structured prompt
  
  // Build conversation transcript for embedding in STEP 1
  const conversationTranscript = context.recentMessages
    .slice(-6)
    .map(m => `${m.direction === 'inbound' ? 'User' : 'Sophie'}: ${m.body}`)
    .join('\n')

  // Build last offer detection
  const lastMessage = context.recentMessages.length > 0 ? context.recentMessages[context.recentMessages.length - 1] : null
  const lastOffer = detectLastOffer(lastMessage)
  
  const currentPrompt = `📊 customer_info:
• name: ${context.userName || null}
• locale: ${context.userContext?.locale || 'en-GB'}

📊 userContext:
• found: ${context.userContext.found}
• hasSignature: ${context.userContext.hasSignature}
• pendingRequirementTypes: [${context.userContext.pendingRequirementTypes?.map(t => `"${t}"`).join(', ') || ''}]
• claims: ${JSON.stringify(
    context.userContext.claims || 
    context.userContext.claimRequirements?.map(cr => ({ 
      id: cr.claimId.toString(), 
      status: cr.status, 
      lender: cr.lender 
    })) || 
    []
  )}
• linkCooldownActive: ${consentStatus.hasConsent ? false : true}
• pii_risk: ${context.userContext.pii_risk || false}

📊 available_links:
• portal_link: ${links.portalLink || '[NOT_AVAILABLE]'}
• review_link: ${links.reviewLink || '[NOT_AVAILABLE]'}
• signup_link: ${links.signupLink || '[ALWAYS_AVAILABLE]'}

📊 conversation_history:
${conversationTranscript}

📊 current_user_message: "${context.userMessage}"

📊 last_offer: ${JSON.stringify(lastOffer)}
`
  
  // Apply structured 7-step formatting to system prompt
  const enhancedPrompt = preparePromptStructure(currentPrompt, context)
  
  return enhancedPrompt
}

function buildContextAwarenessSection(context: SimplifiedResponseContext): string {
  const { userContext } = context
  
  return `📚 Compliance Context (always true):
• No guarantees of outcomes or timelines
• No legal/financial advice
• Only use the authorized knowledge provided
• Respect "offer before send" unless explicit user request provides consent
• Do not ask for information you already have (check customer_info and userContext)`
}

function buildIntelligentUserPrompt(
  context: SimplifiedResponseContext,
  recentTranscript: string
): string {
  // Conversation history is now embedded in the INPUTS PROVIDED section
  // User prompt now just needs to trigger the analysis
  return `Please analyze the inputs provided and follow the 7-step decision process to craft your response as Sophie.`
}

// Removed assessUserReadiness function - AI now determines readiness naturally
// No more rigid pattern matching like /(yes|send|ready)/ - trust AI intelligence
// Let the AI analyze conversation context and user intent organically

// Removed buildAdaptiveUserContext, buildPriorityMatrix, buildRequirementsStatus, buildDetailedRequirementsDisplay
// These functions are no longer needed with the new 7-step deterministic structure
// Priority is now handled deterministically in STEP 2 of the prompt

function validateAndEnhanceResponse(
  response: any, 
  context: SimplifiedResponseContext,
  phoneNumber: string
): SimplifiedAgentResponse {
  // Enforce single message - combine multiple messages if AI provides them
  let messages: string[]
  if (Array.isArray(response.messages) && response.messages.length > 0) {
    // If multiple messages, combine them into one with proper spacing
    const validMessages = response.messages.filter((msg: any) => typeof msg === 'string' && msg.trim())
    if (validMessages.length > 1) {
      // Combine multiple messages with line breaks
      messages = [validMessages.join('\n\n')]
      console.log('AI SMS | 🔄 Combined multiple messages into single message', {
        originalCount: validMessages.length,
        combinedLength: messages[0].length
      })
    } else {
      messages = validMessages.length > 0 ? [validMessages[0]] : ["How can I help with your motor finance claim?"]
    }
  } else {
    messages = [response.message || "How can I help with your motor finance claim?"]
  }
  
  // Ensure we have exactly one message
  if (messages.length === 0 || !messages[0] || !messages[0].trim()) {
    messages = ["How can I help with your motor finance claim?"]
  }
  
  // Trust natural conversation flow - no forced CTAs
  // The adaptive user journey intelligence from STEP 1 guides appropriate endings
  // AI is instructed to include natural next steps when needed
  
  // Only enhance if message seems genuinely incomplete (very short or no direction)
  const hasNoneAction = response.actions?.some((action: any) => action.type === 'none')
  if (hasNoneAction && messages[0]) {
    const message = messages[0]
    
    // Only add guidance if message is very short and lacks any direction
    const hasNaturalDirection = /[?!]|\b(should|would|can|ready|next|let me|help)\b/i.test(message)
    const isVeryShort = message.length < 20
    
    if (isVeryShort && !hasNaturalDirection) {
      // Only in genuinely incomplete responses, add minimal guidance
      messages[0] = message + " How can I help you further?"
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
  
  // Enhance callback actions with user context
  actions = actions.map((action: any) => {
    if (action.type === 'schedule_callback') {
      action.params = {
        ...action.params,
        phoneNumber: action.params.phoneNumber || phoneNumber, // Use the phoneNumber from the main function parameter
        userId: context.userContext.userId,
        userName: context.userName
      }
    }
    // Links are now included directly in messages, not as actions
    return action
  })
  
  return {
    messages,
    actions,
    conversationTone: response.conversationTone || 'helpful',
    reasoning: response.reasoning
  }
}