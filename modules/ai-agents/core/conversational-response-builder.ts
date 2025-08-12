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
  
  const systemPrompt = `CRITICAL RULE: You MUST respond with EXACTLY 3 messages following this exact structure:

REQUIRED JSON OUTPUT:
{
  "messages": [
    "Message 1: GREET & ANSWER - [Hi {Name},] Direct answer to their question",
    "Message 2: DYNAMIC VALUE ADD - Context-specific value based on their question type",  
    "Message 3: QUESTION LEAD CALL TO ACTION - Question that guides to signature/portal"
  ],
  "conversationTone": "helpful|consultative|encouraging"
}

**BUSINESS FOCUS:** We ONLY handle motor finance claims (PCP, HP, car loans). NEVER ask about "specific claim types" - we already know what we do.

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
✅ CORRECT:
Message 1: "Hi James, Our fees are on a sliding scale up to 30% plus VAT, designed to be fair and transparent."
Message 2: "Our fee structure means you only pay when we succeed, and the percentage actually decreases as your compensation increases."
Message 3: "Would you like me to send your secure portal link to get started?"

User: "What documents do you need?" (INFORMATION)
✅ CORRECT:
Message 1: "Hi there, We typically need your agreement, ID, and bank statements, but we guide you through each step."
Message 2: "We only request what's absolutely necessary and make the upload process simple through your secure portal."
Message 3: "Ready to get your signature sorted so we can begin gathering your documents?"

User: "How long will this take?" (OBJECTION - concern about delays)
✅ CORRECT:
Message 1: "Hi James, Timelines vary by lender, but most cases progress within 3-6 months depending on complexity."
Message 2: "We proactively chase lenders and keep you updated throughout, so you never have to worry about delays or follow-ups."
Message 3: "Would you like me to send your portal link to get the process started?"

**USER ENGAGEMENT: ${userEngagement}**
**TONE:** Warm, professional, consultative. Use customer's name when available. Focus on getting signatures.

${hasExplicitLinkRequest ? `
**SPECIAL NOTE: The user is explicitly asking for a link/portal access (e.g., "Yes send it"). 
DO NOT refuse or say you can't send links. Instead, acknowledge their request positively.
Example: "Perfect! I'll get that portal link sent to you right now." or "Great, sending your portal link now."**
` : ''}

REMEMBER: EXACTLY 3 messages. NEVER deviate from the GREET & ANSWER → DYNAMIC VALUE ADD → QUESTION LEAD CALL TO ACTION structure.`

  const userPrompt = `${context.userName ? `Customer: ${context.userName}\n` : ''}${context.userStatus ? `Status: ${context.userStatus}\n` : ''}${context.knowledgeContext ? `Relevant info: ${context.knowledgeContext}\n` : ''}
Recent conversation:
${recentTranscript}

User: ${context.userMessage}`

  try {
    console.log('AI SMS | 🔄 Starting LLM call for natural response generation')
    
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
      conversationTone: parsed.conversationTone
    })
    
    // Ensure we have valid messages array
    let messages = parsed.messages || []
    if (!Array.isArray(messages) || messages.length === 0) {
      messages = [parsed.message || "I understand your question. Let me help you with that."]
    }
    
    // CRITICAL ENFORCEMENT: AI must provide EXACTLY 3 messages
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
    
    // Clean and validate messages - ensure exactly 3
    messages = messages
      .filter((msg: any) => typeof msg === 'string' && msg.trim().length > 0)
      .slice(0, 3) // Max 3 messages
      .map((msg: string) => msg.trim())
    
    // Final safety net - ensure exactly 3 messages
    if (messages.length === 0) {
      const userName = context.userName && !/^unknown$/i.test(context.userName.trim()) ? context.userName : null
      const greeting = userName ? `Hi ${userName}, ` : 'Hi there, '
      messages = [
        greeting + "I understand your question about motor finance claims.",
        "We handle everything to make the process simple and stress-free for you.",
        "Would you like me to send your secure portal link to get started?"
      ]
    }
    
    // Ensure we always have exactly 3 messages
    while (messages.length < 3) {
      if (messages.length === 1) {
        messages.push("We make the motor finance claims process simple and stress-free.")
      }
      if (messages.length === 2) {
        messages.push("Would you like me to send your secure portal link to get started?")
      }
    }

    console.log('AI SMS | 🎯 Natural response generated', {
      messageCount: messages.length,
      userEngagement,
      conversationTone: parsed.conversationTone || 'helpful',
      wasForced: messages.length !== (parsed.messages?.length || 0),
      originalMessageCount: parsed.messages?.length || 0,
      enforced3Messages: messages.length === 3
    })

    return {
      messages,
      conversationTone: parsed.conversationTone || 'helpful'
    }
  } catch (error) {
    console.error('AI SMS | ❌ Error generating natural response:', error)
    
    // Fallback response
    return {
      messages: ["I understand your question. Let me help you with that. What specific aspect would you like me to explain further?"],
      conversationTone: 'helpful'
    }
  }
}

export async function buildConversationalResponse(
  phoneNumber: string,
  context: ResponseContext
): Promise<ConversationalResponse> {
  
  // Analyze user engagement naturally
  const userEngagement = analyzeUserEngagement(context.recentMessages)
  
  // Check if user is explicitly requesting a link
  const hasExplicitLinkRequest = /yes\s+send\s+it|yes\s*,?\s*send|send\s+it|portal|link/i.test(context.userMessage)
  
  console.log('AI SMS | 💬 Building natural AI response', {
    userMessage: context.userMessage.substring(0, 50) + '...',
    userEngagement,
    hasKnowledge: !!context.knowledgeContext,
    hasExplicitLinkRequest
  })
  
  // Let the AI naturally decide on 1-3 messages (with context about link requests)
  const response = await generateNaturalResponse(context, userEngagement, hasExplicitLinkRequest)
  
  // Handle link consent and offerings
  const consentStatus = await checkLinkConsent(phoneNumber, context.userMessage, {
    messageCount: context.conversationInsights?.messageCount || 0,
    recentMessages: context.recentMessages
  })
  
  let linkOffer: string | undefined
  let linkReference: string | undefined
  
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
  
  return {
    ...response,
    shouldOfferLink: !consentStatus.hasConsent && !!linkOffer,
    linkOffer,
    linkReference
  }
}