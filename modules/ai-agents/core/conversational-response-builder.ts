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
  userEngagement: UserEngagement
): Promise<Omit<ConversationalResponse, 'shouldOfferLink' | 'linkOffer' | 'linkReference'>> {
  
  // Build recent conversation context
  const recentTranscript = context.recentMessages
    .slice(-6) // Last 6 messages for context
    .map(m => `${m.direction === 'inbound' ? 'User' : 'Sophie'}: ${m.body}`)
    .join('\n')
  
  const systemPrompt = `You are Sophie from RMC. Respond naturally to the user's message.

**RESPONSE FORMAT - You can reply in up to 3 messages:**
- Answer (always to questions) 
- Value add (optional when it adds genuine value)
- Call to action (always at the end of sequence to keep conversation going)

**GUIDELINES:**
- For simple questions: Use 1 message with answer + engaging follow-up question
- For complex topics (fees, legal, processes): Use 2-3 messages to provide comprehensive value
- Always end with an engaging question to keep the conversation flowing
- Match the user's energy level: ${userEngagement} engagement
- Be consultative and value-focused
- No portal link offers (handled separately)

**TONE:** Warm, professional, knowledgeable. Avoid jargon. Show expertise through valuable insights.

**USER ENGAGEMENT LEVEL: ${userEngagement}**
- High: Provide detailed, multi-part responses with deeper insights
- Medium: Balanced approach with good detail and follow-up
- Low: Keep it simple, ask easy yes/no questions to re-engage

Respond in JSON format only:
{
  "messages": ["message1", "message2?", "message3?"],
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
      conversationTone: parsed.conversationTone || 'helpful'
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
  
  console.log('AI SMS | 💬 Building natural AI response', {
    userMessage: context.userMessage.substring(0, 50) + '...',
    userEngagement,
    hasKnowledge: !!context.knowledgeContext
  })
  
  // Let the AI naturally decide on 1-3 messages
  const response = await generateNaturalResponse(context, userEngagement)
  
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