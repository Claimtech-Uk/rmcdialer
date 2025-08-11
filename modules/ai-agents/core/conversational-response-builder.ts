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
  
  const systemPrompt = `You are Sophie from RMC. You MUST respond with exactly 2 or 3 separate messages.

**MANDATORY RULE: NEVER give a single message. ALWAYS provide 2-3 messages.**

**RESPONSE STRUCTURE (REQUIRED):**
Message 1: **Direct Answer** (1-2 sentences) - Answer their question immediately
Message 2: **Value Add** (1-2 sentences) - Explain benefits of using RMC vs going direct
Message 3: **Engaging Question** (1 sentence) - Keep conversation flowing

**For simple questions**: Use 2 messages (combine value-add with question)
**For complex topics**: Use all 3 messages

**CRITICAL EXAMPLES:**

User: "How long will it take?"
✅ CORRECT (2 messages):
Message 1: "The timelines can vary depending on your lender, but we proactively chase and keep you updated throughout the process."
Message 2: "Unlike going direct, we have experience with each lender's specific procedures which often speeds things up. What else would you like to know about the process?"

❌ WRONG (1 message):
"The timelines can vary depending on your lender, but we proactively chase and keep you updated throughout the process. Unlike going direct, we have experience with each lender's specific procedures. What else would you like to know?"

User: "What are your fees?"
✅ CORRECT (3 messages):
Message 1: "Our fees are on a sliding scale up to 30% plus VAT, designed to be fair and transparent."
Message 2: "This means as your compensation increases, our percentage actually decreases. Plus you always have the free option to complain directly."
Message 3: "What specific aspect of our fee structure would you like me to explain further?"

**USER ENGAGEMENT: ${userEngagement}**
**TONE:** Warm, professional, consultative. Show expertise.

${hasExplicitLinkRequest ? `
**SPECIAL NOTE: The user is explicitly asking for a link/portal access (e.g., "Yes send it"). 
DO NOT refuse or say you can't send links. Instead, acknowledge their request positively.
Example: "Perfect! I'll get that portal link sent to you right now." or "Great, sending your portal link now."**
` : ''}

MANDATORY JSON OUTPUT:
{
  "messages": ["message1", "message2", "message3 (if needed)"],
  "conversationTone": "helpful|reassuring|informative|encouraging|consultative"
}`

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
    
    // CRITICAL ENFORCEMENT: AI must provide 2-3 messages, never just 1
    if (messages.length === 1) {
      console.log('AI SMS | ⚠️ AI tried to give single message - ENFORCING multi-message rule')
      const singleMessage = messages[0]
      
      // Force into 2 messages: answer + value-add question
      const sentences = singleMessage.split('. ')
      if (sentences.length >= 2) {
        const midPoint = Math.ceil(sentences.length / 2)
        const answer = sentences.slice(0, midPoint).join('. ') + '.'
        let valueAdd = sentences.slice(midPoint).join('. ')
        
        // Ensure second message ends with question
        if (!valueAdd.includes('?')) {
          valueAdd += ' What else can I help you with?'
        }
        
        messages = [answer, valueAdd]
      } else {
        // Single sentence - force into answer + value-add
        messages = [
          singleMessage.replace(/\?.*$/, '.'), // Remove question from first
          "We're here to guide you through the entire process. What else would you like to know?"
        ]
      }
      
      console.log('AI SMS | ✅ Forced single message into multi-message sequence', {
        originalLength: singleMessage.length,
        newMessageCount: messages.length
      })
    }
    
    // Clean and validate messages
    messages = messages
      .filter((msg: any) => typeof msg === 'string' && msg.trim().length > 0)
      .slice(0, 3) // Max 3 messages
      .map((msg: string) => msg.trim())
    
    if (messages.length === 0) {
      messages = ["I understand your question. How can I help you further?"]
    }

    console.log('AI SMS | 🎯 Natural response generated', {
      messageCount: messages.length,
      userEngagement,
      conversationTone: parsed.conversationTone || 'helpful',
      wasForciblySplit: messages.length > 1 && parsed.messages?.length === 1,
      originalMessageCount: parsed.messages?.length || 0
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