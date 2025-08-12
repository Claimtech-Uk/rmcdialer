// Builds more natural, conversational responses that flow from recent context
// AI naturally decides between 1-3 messages based on context and question complexity

import { chat } from './llm.client'
import { getConversationInsights, type ConversationInsights } from './memory.store'
import { checkLinkConsent, offerPortalLink } from './consent-manager'

// Helper function to check recent link activity
function checkRecentLinkActivity(recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}>): {
  linkSentRecently: boolean
  linkMentionedRecently: boolean
  messagesAgo: number
  referenceText: string
} {
  // Check last 5 messages for any portal link activity
  const lastFiveMessages = recentMessages.slice(-5)
  
  let linkSentRecently = false
  let linkMentionedRecently = false
  let messagesAgo = 999
  let referenceText = 'the portal link'
  
  for (let i = lastFiveMessages.length - 1; i >= 0; i--) {
    const message = lastFiveMessages[i]
    const messageIndex = lastFiveMessages.length - 1 - i // Messages ago (0 = most recent)
    
    // Check for actual link sends (URLs in outbound messages)
    if (message.direction === 'outbound') {
      const hasPortalUrl = /claim\.resolvemyclaim\.co\.uk|portal.*link/i.test(message.body)
      if (hasPortalUrl) {
        linkSentRecently = true
        messagesAgo = Math.min(messagesAgo, messageIndex)
        
        // Set reference text based on how recent
        if (messageIndex === 0) referenceText = 'the link I just sent'
        else if (messageIndex === 1) referenceText = 'the link above'
        else referenceText = 'the portal link from earlier'
        break
      }
    }
    
    // Check for portal link mentions (either direction)
    const hasPortalMention = /portal\s+link|claim\s+portal|secure\s+link/i.test(message.body)
    if (hasPortalMention) {
      linkMentionedRecently = true
      messagesAgo = Math.min(messagesAgo, messageIndex)
      
      if (messageIndex <= 1) referenceText = 'the link we discussed'
      else referenceText = 'the portal link we mentioned'
    }
  }
  
  return {
    linkSentRecently,
    linkMentionedRecently,
    messagesAgo,
    referenceText
  }
}

type UserEngagement = 'high' | 'medium' | 'low'

function analyzeUserEngagement(recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}>): UserEngagement {
  if (!recentMessages?.length) return 'medium'
  
  const userMessages = recentMessages.filter(m => m.direction === 'inbound')
  if (userMessages.length === 0) return 'medium'
  
  const lastMessage = userMessages[userMessages.length - 1]
  const avgLength = userMessages.reduce((sum, m) => sum + m.body.length, 0) / userMessages.length
  
  // High engagement: longer messages, questions, specific details
  if (lastMessage.body.length > 50 || avgLength > 40 || /\?/.test(lastMessage.body)) {
    return 'high'
  }
  
  // Low engagement: very short, generic responses
  if (lastMessage.body.length < 15 && avgLength < 20) {
    return 'low'
  }
  
  return 'medium'
}

function shouldOfferPortalLink(context: ResponseContext): boolean {
  const userMessage = context.userMessage.toLowerCase()
  
  // Don't offer if user is asking unrelated questions
  if (userMessage.includes('how') && !userMessage.includes('claim')) return false
  if (userMessage.includes('what') && !userMessage.includes('fee') && !userMessage.includes('cost')) return false
  
  // Offer for fee, process, or getting started questions
  if (userMessage.includes('fee') || userMessage.includes('cost') || userMessage.includes('charge')) return true
  if (userMessage.includes('start') || userMessage.includes('begin') || userMessage.includes('sign up')) return true
  if (userMessage.includes('portal') || userMessage.includes('link')) return true
  
  return (context.conversationInsights?.messageCount || 0) >= 3
}

export type ResponseContext = {
  userMessage: string
  userName?: string
  recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}>
  conversationInsights?: ConversationInsights
  knowledgeContext?: string
  userStatus?: string
}

export type ConversationalResponse = {
  messages: string[] // AI decides: 1, 2, or 3 messages naturally
  shouldOfferLink: boolean
  linkOffer?: string
  linkReference?: string
  conversationTone: 'helpful' | 'reassuring' | 'informative' | 'encouraging' | 'consultative'
}

async function generateNaturalResponse(
  context: ResponseContext, 
  userEngagement: UserEngagement,
  hasExplicitLinkRequest: boolean = false
): Promise<Omit<ConversationalResponse, 'shouldOfferLink' | 'linkOffer' | 'linkReference'>> {
  
  // Build recent conversation context
  const recentTranscript = context.recentMessages
    .slice(-6) // Last 6 messages for context
    .map(m => `${m.direction === 'inbound' ? 'User' : 'Sophie'}: ${m.body}`)
    .join('\n')
  
  // Different prompt structure based on whether user explicitly wants a link
  const systemPrompt = hasExplicitLinkRequest 
    ? `🔗 LINK SENDING MODE: The user has responded positively to a recent portal link offer. Build response with expectation of sending an actual link.

**WHEN TO USE [link placeholder]:**
- If your most recent message offered a portal link AND the user replied positively (Yes, OK, Sure, etc.)
- Build the response with the expectation of a link being sent
- You will send the message with [link placeholder] in place of where the link will be
- We will replace [link placeholder] with the actual link on response

**REQUIRED JSON OUTPUT:**
{
  "messages": [
    "Perfect! Please use this secure link: [link placeholder]",
    "Click the link above and provide your signature, ID, and any required information. If you have any questions, please reach out!"
  ],
  "conversationTone": "encouraging"
}

**CONVERSATION FLOW EXAMPLES:**

Example 1 - Portal Link Offer → Positive Response:
Sophie: "Would you like me to send your secure portal link to get started?"
User: "Yes" ← POSITIVE RESPONSE TO LINK OFFER
Sophie Response: {
  "messages": [
    "Perfect! Please use this secure link: [link placeholder]",
    "Click the link above and provide your signature, ID, and any required information. If you have any questions, please reach out!"
  ],
  "conversationTone": "encouraging"
}

Example 2 - Question → Portal Link Offer → Positive Response:
Sophie: "Ready to get your signature sorted so we can begin?"
User: "Okay" ← POSITIVE RESPONSE TO NEXT STEP QUESTION  
Sophie Response: {
  "messages": [
    "Great! Here's your secure portal link: [link placeholder]",
    "Please click above and complete your signature and upload any required documents. We're here to help if you need anything!"
  ],
  "conversationTone": "helpful"
}

Example 3 - Explicit Link Request:
User: "Send me the link" ← EXPLICIT REQUEST
Sophie Response: {
  "messages": [
    "Absolutely! Here's your secure portal link: [link placeholder]",
    "Click the link above and provide your signature, ID, and any required information. If you have any questions, please reach out!"
  ],
  "conversationTone": "helpful"
}

**CRITICAL RULES:**
- EXACTLY 2 messages for link sending responses
- First message MUST include [link placeholder] (exactly as written)
- Second message provides brief guidance on what to do with the link
- Use customer's name if available: "Hi James, Perfect! Please use..."

**TONE:** Positive, encouraging, supportive. Acknowledge their positive response warmly.

**USER ENGAGEMENT: ${userEngagement}**`
    
    : `CRITICAL RULE: You MUST respond with EXACTLY 3 messages following this exact structure:

REQUIRED JSON OUTPUT:
{
  "messages": [
    "Hi {Name}, [Direct answer to their question]",
    "[Context-specific value based on their question type]",  
    "[Question that guides to signature/portal]"
  ],
  "conversationTone": "helpful|consultative|encouraging"
}

**BUSINESS FOCUS:** We ONLY handle motor finance claims (PCP, HP, car loans). NEVER ask about "specific claim types" - we already know what we do.

**USER STAGE GUIDANCE:**
- UNSIGNED USER: Need signature + ID (helpful but not always required). Signature allows credit check, retrieve agreements, start investigating claims. After: We handle the rest, might need further info but we'll let you know.
- OUTSTANDING REQUESTS: Need claim/lender & requirement type dependent. Lender pushed back because can't identify user or locate agreements. After: Once uploaded, we send it back and hopefully lenders approve going forward.

**STRUCTURE BREAKDOWN:**
✅ Message 1: GREET & ANSWER
   - Use customer's name if available: "Hi James," or "Hi there," 
   - Directly answer their specific question
   - Keep it 1-2 sentences

✅ Message 2: DYNAMIC VALUE ADD (choose based on question type)
   
   **If OBJECTION (fees, time concerns, skepticism, trust):**
   - Address their specific concern directly
   - Examples: "Our sliding scale means you pay less as we recover more" (fees objection)
   - "We proactively chase so you don't have to worry about delays" (time objection)
   
   **If INFORMATION REQUEST (process, documents, general questions):**
   - Provide value relevant to their specific question
   - Examples: "We handle all the paperwork so it's stress-free for you" (documents question)
   - "Our systematic approach covers all claim types for maximum recovery" (process question)

✅ Message 3: QUESTION LEAD CALL TO ACTION
   - Ask a question that guides toward signature/portal link
   - "Would you like me to send your secure portal link to get started?"
   - "Ready to get your signature sorted so we can begin?"

**CRITICAL EXAMPLES:**

User: "What are your fees?" (OBJECTION)
{
  "messages": [
    "Hi James, Our fees are on a sliding scale up to 30% plus VAT, designed to be fair and transparent.",
    "Our fee structure means you only pay when we succeed, and the percentage actually decreases as your compensation increases.",
    "Would you like me to send your secure portal link to get started?"
  ],
  "conversationTone": "consultative"
}

User: "What documents do you need?" (INFORMATION)
{
  "messages": [
    "Hi there, We typically need your agreement, ID, and bank statements, but we guide you through each step.",
    "If you're unsigned, we mainly need your signature and ID to start investigating. If we need additional documents later, we'll let you know exactly what's required.",
    "Ready to get your signature sorted so we can begin?"
  ],
  "conversationTone": "helpful"
}

User: "How long will this take?" (OBJECTION - concern about delays)
{
  "messages": [
    "Hi James, Timelines vary by lender, but most cases progress within 3-6 months depending on complexity.",
    "We proactively chase lenders and keep you updated throughout, so you never have to worry about delays or follow-ups.",
    "Would you like me to send your portal link to get the process started?"
  ],
  "conversationTone": "consultative"
}

**USER ENGAGEMENT: ${userEngagement}**
**TONE:** Warm, professional, consultative. Use customer's name when available. Focus on getting signatures.

REMEMBER: EXACTLY 3 messages. NEVER deviate from the GREET & ANSWER → DYNAMIC VALUE ADD → QUESTION LEAD CALL TO ACTION structure.`

  const userPrompt = `${context.userName ? `Customer: ${context.userName}\n` : ''}${context.userStatus ? `Status: ${context.userStatus}\n` : ''}${context.knowledgeContext ? `Relevant info: ${context.knowledgeContext}\n` : ''}
Recent conversation:
${recentTranscript}

User: ${context.userMessage}`

  try {
    console.log('AI SMS | 🔄 Starting LLM call for natural response generation', {
      hasPositiveIntent: hasExplicitLinkRequest,
      expectedMessages: hasExplicitLinkRequest ? 2 : 3
    })
    
    const response = await chat({
      system: systemPrompt,
      user: userPrompt,
      model: process.env.AI_SMS_MODEL || 'gpt-4o-mini',
      responseFormat: { type: 'json_object' }
    })

    console.log('AI SMS | ✅ LLM call completed', {
      responseLength: response?.length || 0,
      hasResponse: !!response
    })

    const parsed = JSON.parse(response || '{}')
    
    console.log('AI SMS | 📝 Parsed LLM response', {
      hasMessages: !!parsed.messages,
      messageCount: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
      conversationTone: parsed.conversationTone,
      hasPositiveIntent: hasExplicitLinkRequest
    })
    
    // Ensure we have valid messages array
    let messages = parsed.messages || []
    if (!Array.isArray(messages) || messages.length === 0) {
      messages = [parsed.message || "I understand your question. Let me help you with that."]
    }
    
    // Different enforcement based on whether user showed positive intent
    if (hasExplicitLinkRequest) {
      // POSITIVE INTENT: Enforce exactly 2 messages
      if (messages.length === 1) {
        console.log('AI SMS | ⚠️ AI tried to give single message for positive intent - ENFORCING 2-message structure')
        const singleMessage = messages[0]
        const userName = context.userName && !/^unknown$/i.test(context.userName.trim()) ? context.userName : null
        
        messages = [
          singleMessage.includes('[link placeholder]') 
            ? singleMessage 
            : `Perfect! Please use this secure link: [link placeholder]`,
          "Click the link above and provide your signature, ID, and any required information. If you have any questions, please reach out!"
        ]
        
        console.log('AI SMS | ✅ Forced single message into 2-message link structure', {
          originalLength: singleMessage.length,
          newMessageCount: messages.length
        })
      }
      
      if (messages.length > 2) {
        console.log('AI SMS | ⚠️ AI gave too many messages for positive intent - LIMITING to 2')
        messages = messages.slice(0, 2)
      }
      
      // Ensure first message has link placeholder
      if (!messages[0].includes('[link placeholder]')) {
        messages[0] = messages[0] + ' [link placeholder]'
      }
      
      // Ensure we have exactly 2 messages for positive intent responses
      if (messages.length === 1) {
        messages.push("Click the link above and provide your signature, ID, and any required information. If you have any questions, please reach out!")
      }
      
    } else {
      // NORMAL CONVERSATION: Enforce exactly 3 messages
      if (messages.length === 1) {
        console.log('AI SMS | ⚠️ AI tried to give single message - ENFORCING 3-message structure')
        const singleMessage = messages[0]
        
        // Force into 3 messages: Greet & Answer + Value Add + Call to Action
        const userName = context.userName && !/^unknown$/i.test(context.userName.trim()) ? context.userName : null
        const greeting = userName ? `Hi ${userName}, ` : 'Hi there, '
        
        messages = [
          greeting + singleMessage.replace(/\?.*$/, '.'), // Greet & Answer (remove questions)
          "We handle everything to make the process simple and stress-free for you.", // Generic value add
          "Would you like me to send your secure portal link to get started?" // Call to action
        ]
        
        console.log('AI SMS | ✅ Forced single message into 3-message structure', {
          originalLength: singleMessage.length,
          newMessageCount: messages.length
        })
      }
      
      if (messages.length === 2) {
        console.log('AI SMS | ⚠️ AI gave 2 messages - ENFORCING 3-message structure')
        
        // Add call to action as third message
        messages.push("Ready to get your signature sorted so we can begin?")
        
        console.log('AI SMS | ✅ Added third message to complete 3-message structure', {
          newMessageCount: messages.length
        })
      }
      
      // Ensure we always have exactly 3 messages for normal conversation
      while (messages.length < 3) {
        if (messages.length === 1) {
          messages.push("We make the motor finance claims process simple and stress-free.")
        }
        if (messages.length === 2) {
          messages.push("Would you like me to send your secure portal link to get started?")
        }
      }
      
      // Limit to 3 messages max for normal conversation
      messages = messages.slice(0, 3)
    }
    
    // Clean and validate messages
    messages = messages
      .filter((msg: any) => typeof msg === 'string' && msg.trim().length > 0)
      .map((msg: string) => msg.trim())
    
    // Final safety net
    if (messages.length === 0) {
      const userName = context.userName && !/^unknown$/i.test(context.userName.trim()) ? context.userName : null
      const greeting = userName ? `Hi ${userName}, ` : 'Hi there, '
      
      if (hasExplicitLinkRequest) {
        messages = [
          "Perfect! I'll send your secure portal link now: {LINK_PLACEHOLDER}",
          "Click the link above and provide your signature, ID, and any required information. If you have any questions, please reach out!"
        ]
      } else {
        messages = [
          greeting + "I understand your question about motor finance claims.",
          "We handle everything to make the process simple and stress-free for you.",
          "Would you like me to send your secure portal link to get started?"
        ]
      }
    }

    const expectedCount = hasExplicitLinkRequest ? 2 : 3
    console.log('AI SMS | 🎯 Natural response generated', {
      messageCount: messages.length,
      expectedCount,
      hasPositiveIntent: hasExplicitLinkRequest,
      userEngagement,
      conversationTone: parsed.conversationTone || 'helpful',
      wasForced: messages.length !== (parsed.messages?.length || 0),
      originalMessageCount: parsed.messages?.length || 0,
      correctStructure: messages.length === expectedCount
    })

    return {
      messages,
      conversationTone: parsed.conversationTone || 'helpful'
    }
  } catch (error) {
    console.error('AI SMS | ❌ Error generating natural response:', error)
    
    // Fallback response: still enforce structure so we never return a single message in conversational mode
    if (hasExplicitLinkRequest) {
      return {
        messages: [
          "Perfect! I'll send your secure portal link now: {LINK_PLACEHOLDER}",
          "Click the link above and provide your signature, ID, and any required information. If you have any questions, please reach out!"
        ],
        conversationTone: 'helpful'
      }
    } else {
      const greeting = context.userName && !/^unknown$/i.test(context.userName.trim()) ? `Hi ${context.userName}, ` : 'Hi there, '
      return {
        messages: [
          greeting + "I understand your question about motor finance claims.",
          "We handle everything to make the process simple and stress-free for you.",
          "Would you like me to send your secure portal link to get started?"
        ],
        conversationTone: 'helpful'
      }
    }
  }
}

/**
 * Analyze conversation context to determine what the user is responding to
 */
function analyzeConversationContext(recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}>) {
  const lastFewMessages = recentMessages.slice(-4) // Last 4 messages for context
  const lastOutboundMessage = lastFewMessages.filter(m => m.direction === 'outbound').pop()
  
  if (!lastOutboundMessage) {
    return { type: 'unknown', confidence: 0 }
  }
  
  const lastMessage = lastOutboundMessage.body.toLowerCase()
  
  // Analyze what Sophie just offered/asked
  const contextPatterns = [
    {
      type: 'portal_link_offer',
      confidence: 0.9,
      patterns: [
        /would\s+you\s+like.*portal\s+link/i,
        /shall\s+i.*send.*link/i,
        /ready.*portal\s+link/i,
        /send.*secure\s+link/i,
        /portal\s+link.*get\s+started/i
      ]
    },
    {
      type: 'next_step_question',
      confidence: 0.8,
      patterns: [
        /ready\s+to.*get.*started/i,
        /ready.*signature/i,
        /shall\s+we\s+begin/i,
        /ready\s+to.*proceed/i,
        /would.*like.*to.*continue/i
      ]
    },
    {
      type: 'information_explanation',
      confidence: 0.7,
      patterns: [
        /our\s+fees.*are/i,
        /we\s+typically\s+need/i,
        /timelines?\s+(vary|are)/i,
        /the\s+process.*involves/i,
        /we\s+handle.*paperwork/i
      ]
    },
    {
      type: 'benefit_explanation',
      confidence: 0.6,
      patterns: [
        /our.*fee\s+structure/i,
        /we.*proactively\s+chase/i,
        /we.*make.*process.*simple/i,
        /stress-free/i
      ]
    }
  ]
  
  for (const context of contextPatterns) {
    const matchesPattern = context.patterns.some(pattern => pattern.test(lastMessage))
    if (matchesPattern) {
      return { type: context.type, confidence: context.confidence }
    }
  }
  
  return { type: 'general', confidence: 0.3 }
}

/**
 * Detect if user is showing positive intent to proceed with the portal link
 * Uses conversation context to understand what they're actually responding to
 */
function detectPositiveIntent(userMessage: string, recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}>): boolean {
  const message = userMessage.toLowerCase().trim()
  
  console.log('AI SMS | 🔍 Analyzing conversation context for positive intent', {
    userMessage: message,
    recentMessageCount: recentMessages.length
  })
  
  // Explicit link requests are always positive intent regardless of context
  const hasExplicitLinkRequest = /portal|link|send.*me|access|claims?\s+page|send.*it|yes.*send/i.test(message)
  if (hasExplicitLinkRequest) {
    console.log('AI SMS | ✅ Explicit link request detected')
    return true
  }
  
  // Check if the most recent AI message offered a portal link
  const mostRecentAiMessage = recentMessages
    .filter(m => m.direction === 'outbound')
    .slice(-1)[0] // Get the last outbound message
  
  if (!mostRecentAiMessage) {
    console.log('AI SMS | ⚠️ No recent AI message found')
    return false
  }
  
  // Check if the most recent AI message contains a link offer
  const aiMessageOfferedLink = /portal\s+link|secure\s+link|your\s+link|send.*link|would.*like.*link|ready.*portal/i.test(mostRecentAiMessage.body)
  
  console.log('AI SMS | 🔍 Link offer analysis', {
    mostRecentAiMessage: mostRecentAiMessage.body.substring(0, 100) + '...',
    offeredLink: aiMessageOfferedLink
  })
  
  if (aiMessageOfferedLink) {
    // AI offered a link in the most recent message - check for positive response
    const isPositiveResponse = /^(yes|yeah|yep|yup|y|ye|ok|okay|alright|sure|absolutely|definitely|certainly|of\s+course|agreed|i\s+agree|sounds?\s+good|that\s+sounds?\s+good|that\s+works|perfect|great|excellent|brilliant|fine|that's\s+fine|please|go\s+ahead|proceed|continue|let's\s+do\s+it|let's\s+go|ready|do\s+it|👍|✓|✅)$/i.test(message)
    
    console.log('AI SMS | 🎯 Context-aware positive intent decision', {
      aiOfferedLink: true,
      userResponse: message,
      isPositiveResponse
    })
    
    return isPositiveResponse
  }
  
  // No recent link offer - only explicit link requests count
  console.log('AI SMS | ❌ No recent link offer found, no positive intent detected')
  return false
}

export async function buildConversationalResponse(
  phoneNumber: string,
  context: ResponseContext
): Promise<ConversationalResponse> {
  
  // Analyze user engagement naturally
  const userEngagement = analyzeUserEngagement(context.recentMessages)
  
  // Check if user is showing positive intent to proceed
  const hasExplicitLinkRequest = detectPositiveIntent(context.userMessage, context.recentMessages)
  
  console.log('AI SMS | 💬 Building natural AI response', {
    userMessage: context.userMessage.substring(0, 50) + '...',
    userEngagement,
    hasKnowledge: !!context.knowledgeContext,
    hasPositiveIntent: hasExplicitLinkRequest
  })
  
  // Let the AI naturally decide on 2 or 3 messages based on context
  const response = await generateNaturalResponse(context, userEngagement, hasExplicitLinkRequest)
  
  // Handle link consent and offerings
  const consentStatus = await checkLinkConsent(phoneNumber, context.userMessage, {
    messageCount: context.conversationInsights?.messageCount || 0,
    recentMessages: context.recentMessages
  })
  
  let linkOffer: string | undefined
  let linkReference: string | undefined
  
  // For positive intent responses, we should always provide the link
  if (hasExplicitLinkRequest) {
    console.log('AI SMS | 🔗 Positive intent detected, generating portal link')
    linkOffer = await offerPortalLink(
      phoneNumber, 
      response.messages[0], // Use first message for context
      context.conversationInsights?.messageCount || 0
    )
  } else {
    // Check for recent link activity in conversation
    if (context.recentMessages) {
      const linkActivity = checkRecentLinkActivity(context.recentMessages)
      
      if (linkActivity.linkSentRecently || linkActivity.linkMentionedRecently) {
        // Use smart referencing instead of offering new link
        linkReference = linkActivity.referenceText
        console.log('AI SMS | 🔗 Using smart link reference', {
          referenceText: linkActivity.referenceText,
          messagesAgo: linkActivity.messagesAgo
        })
      } else if (!consentStatus.hasConsent && shouldOfferPortalLink(context)) {
        linkOffer = await offerPortalLink(
          phoneNumber, 
          response.messages[0], // Use first message for context
          context.conversationInsights?.messageCount || 0
        )
      }
    }
  }
  
  return {
    ...response,
    shouldOfferLink: !!linkOffer,
    linkOffer,
    linkReference
  }
}