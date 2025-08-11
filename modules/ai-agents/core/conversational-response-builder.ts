// Builds more natural, conversational responses that flow from recent context
// Ensures every response includes engaging follow-up questions

import { chat } from './llm.client'
import { getConversationInsights, type ConversationInsights } from './memory.store'
import { checkLinkConsent, offerPortalLink } from './consent-manager'
import { 
  analyzeSequenceOpportunity, 
  generateMessageSequence, 
  type SequenceAnalysisContext,
  type ThreeMessageSequence 
} from './sequence-analyzer'

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

export type ConversationWeight = {
  currentMessage: number    // 0.6 - Most recent message gets highest weight
  previousContext: number   // 0.3 - Recent conversation context
  generalKnowledge: number  // 0.1 - General knowledge base responses
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
  mainResponse: string
  followUpQuestion: string
  shouldOfferLink: boolean
  linkOffer?: string
  linkReference?: string
  conversationTone: 'helpful' | 'reassuring' | 'informative' | 'encouraging' | 'consultative'
  // 3-message sequence support
  useSequence?: boolean
  messageSequence?: ThreeMessageSequence
  sequenceReason?: string
}

export async function buildConversationalResponse(
  phoneNumber: string,
  context: ResponseContext
): Promise<ConversationalResponse> {
  
  // Weight the conversation context - recent messages matter most
  const weights: ConversationWeight = {
    currentMessage: 0.6,
    previousContext: 0.3,
    generalKnowledge: 0.1
  }
  
  // Analyze recent conversation flow
  const conversationFlow = analyzeConversationFlow(context.recentMessages)
  
  // Check if this message would benefit from a 3-message sequence
  const sequenceContext: SequenceAnalysisContext = {
    userMessage: context.userMessage,
    userName: context.userName,
    conversationPhase: context.conversationInsights?.conversationPhase || 'discovery',
    userEngagement: conversationFlow.userEngagement,
    messageCount: context.conversationInsights?.messageCount || 0,
    recentQuestions: conversationFlow.questionCount,
    knowledgeContext: context.knowledgeContext
  }
  
  const sequenceDecision = await analyzeSequenceOpportunity(sequenceContext)
  
  let response: Omit<ConversationalResponse, 'shouldOfferLink' | 'linkOffer' | 'linkReference' | 'useSequence' | 'messageSequence' | 'sequenceReason'>
  let messageSequence: ThreeMessageSequence | undefined
  
  if (sequenceDecision.shouldUseSequence && sequenceDecision.confidence > 0.6) {
    // Generate 3-message sequence
    console.log('AI SMS | 🎯 Using 3-message sequence approach:', sequenceDecision.reason)
    
    messageSequence = await generateMessageSequence(sequenceContext)
    
    if (messageSequence) {
      // Use the first message as main response, question will be handled in sequence
      response = {
        mainResponse: messageSequence.message1,
        followUpQuestion: '', // Empty since we're using sequence
        conversationTone: 'consultative' // Override tone for sequences
      }
    } else {
      // Fallback to single message if sequence generation fails
      console.log('AI SMS | ⚠️ Sequence generation failed, falling back to single message')
      const weightedPrompt = await buildWeightedPrompt(context, weights, conversationFlow)
      response = await generateConversationalResponse(weightedPrompt, context)
    }
  } else {
    // Use single message approach
    console.log('AI SMS | 💬 Using single message approach:', sequenceDecision.reason)
    const weightedPrompt = await buildWeightedPrompt(context, weights, conversationFlow)
    response = await generateConversationalResponse(weightedPrompt, context)
  }
  
  // Check if we should offer portal link (with consent and recent link activity)
  const consentStatus = await checkLinkConsent(phoneNumber, context.userMessage, {
    messageCount: context.conversationInsights?.messageCount || 0,
    recentMessages: context.recentMessages
  })
  
  let linkOffer: string | undefined
  let linkReference: string | undefined
  
  // If there's already a link in recent conversation, reference it instead
  if (context.recentMessages) {
    // Check for recent link activity in conversation
    const linkActivity = checkRecentLinkActivity(context.recentMessages)
    
    if (linkActivity.linkSentRecently || linkActivity.linkMentionedRecently) {
      // Use smart referencing instead of offering new link
      linkReference = linkActivity.referenceText
      console.log('AI SMS | 🔗 Using smart link reference instead of new offer', {
        referenceText: linkActivity.referenceText,
        messagesAgo: linkActivity.messagesAgo
      })
    } else if (!consentStatus.hasConsent && shouldOfferPortalLink(context, conversationFlow)) {
      // Only offer new link if none exists in recent conversation
      linkOffer = await offerPortalLink(
        phoneNumber, 
        response.mainResponse,
        context.conversationInsights?.messageCount || 0
      )
    }
  } else if (!consentStatus.hasConsent && shouldOfferPortalLink(context, conversationFlow)) {
    linkOffer = await offerPortalLink(
      phoneNumber, 
      response.mainResponse,
      context.conversationInsights?.messageCount || 0
    )
  }
  
  return {
    ...response,
    shouldOfferLink: !consentStatus.hasConsent && !!linkOffer,
    linkOffer,
    linkReference,
    useSequence: !!messageSequence,
    messageSequence,
    sequenceReason: messageSequence ? sequenceDecision.reason : undefined
  }
}

function analyzeConversationFlow(
  recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}>
): {
  userEngagement: 'high' | 'medium' | 'low'
  questionCount: number
  lastTopic: string
  conversationMomentum: 'building' | 'neutral' | 'declining'
  needsReengagement: boolean
} {
  const userMessages = recentMessages.filter(m => m.direction === 'inbound')
  const lastUserMessage = userMessages[userMessages.length - 1]?.body || ''
  
  // Count questions from user (shows engagement)
  const questionCount = userMessages.filter(m => m.body.includes('?')).length
  
  // Determine engagement level
  const recentUserMessages = userMessages.slice(-3)
  const avgLength = recentUserMessages.reduce((sum, m) => sum + m.body.length, 0) / recentUserMessages.length
  
  let userEngagement: 'high' | 'medium' | 'low' = 'medium'
  if (avgLength > 50 || questionCount > 0) userEngagement = 'high'
  if (avgLength < 15 && questionCount === 0) userEngagement = 'low'
  
  // Extract last topic
  const lastTopic = extractTopicFromMessage(lastUserMessage)
  
  // Determine conversation momentum
  const messageLengths = recentMessages.slice(-4).map(m => m.body.length)
  const isIncreasing = messageLengths.length >= 2 && 
    messageLengths[messageLengths.length - 1] > messageLengths[messageLengths.length - 2]
  
  let conversationMomentum: 'building' | 'neutral' | 'declining' = 'neutral'
  if (isIncreasing && userEngagement === 'high') conversationMomentum = 'building'
  if (userEngagement === 'low' && questionCount === 0) conversationMomentum = 'declining'
  
  return {
    userEngagement,
    questionCount,
    lastTopic,
    conversationMomentum,
    needsReengagement: conversationMomentum === 'declining'
  }
}

async function buildWeightedPrompt(
  context: ResponseContext,
  weights: ConversationWeight,
  flow: ReturnType<typeof analyzeConversationFlow>
): Promise<string> {
  const systemPrompt = `You are Sophie from RMC. Build a conversational response that:

1. PRIMARILY responds to the user's MOST RECENT message (${Math.round(weights.currentMessage * 100)}% weight)
2. References relevant previous context naturally (${Math.round(weights.previousContext * 100)}% weight)  
3. Uses knowledge base info sparingly, only when directly relevant (${Math.round(weights.generalKnowledge * 100)}% weight)

CONVERSATION FLOW ANALYSIS:
- User engagement: ${flow.userEngagement}
- Recent topic: ${flow.lastTopic}
- Momentum: ${flow.conversationMomentum}
- Questions asked: ${flow.questionCount}

RESPONSE REQUIREMENTS:
1. Answer the immediate question/concern directly
2. Build naturally on what they just said
3. ALWAYS end with an engaging follow-up question
4. Match their energy level (formal vs casual)
5. No portal link offers (handled separately)

TONE GUIDELINES:
- High engagement: Match their enthusiasm, ask deeper questions
- Medium engagement: Be helpful, ask clarifying questions  
- Low engagement: Be warm, ask simple yes/no questions to re-engage
- Declining momentum: Ask direct preference questions

OUTPUT FORMAT: Respond in JSON format only:
{
  "mainResponse": "Direct answer that flows from their recent message",
  "followUpQuestion": "Engaging question that keeps conversation going",
  "conversationTone": "helpful|reassuring|informative|encouraging"
}`

  const conversationContext = context.recentMessages
    .slice(-3) // Last 3 exchanges
    .map(m => `${m.direction === 'inbound' ? 'User' : 'Sophie'}: ${m.body}`)
    .join('\n')

  const userPrompt = `MOST RECENT USER MESSAGE (PRIMARY FOCUS): "${context.userMessage}"

RECENT CONVERSATION CONTEXT:
${conversationContext}

${context.knowledgeContext ? `RELEVANT KNOWLEDGE: ${context.knowledgeContext}` : ''}

BUILD YOUR RESPONSE FOCUSING HEAVILY ON THEIR MOST RECENT MESSAGE.`

  return `${systemPrompt}\n\nUSER CONTEXT:\n${userPrompt}`
}

async function generateConversationalResponse(
  prompt: string,
  context: ResponseContext
): Promise<Omit<ConversationalResponse, 'shouldOfferLink' | 'linkOffer'>> {
  try {
    const response = await chat({
      system: prompt.split('\n\nUSER CONTEXT:')[0],
      user: prompt.split('\n\nUSER CONTEXT:')[1],
      model: 'gpt-4o-mini',
      responseFormat: { type: 'json_object' }
    })
    
    const parsed = JSON.parse(response)
    
    return {
      mainResponse: parsed.mainResponse || "I understand your question. Let me help you with that.",
      followUpQuestion: parsed.followUpQuestion || "What would you like to know next?",
      conversationTone: parsed.conversationTone || 'helpful'
    }
  } catch (error) {
    console.error('AI SMS | ❌ Error generating conversational response:', error)
    
    // Fallback response
    return {
      mainResponse: "I understand your question. Let me help you with that.",
      followUpQuestion: "What would you like to know next?",
      conversationTone: 'helpful'
    }
  }
}

function extractTopicFromMessage(message: string): string {
  const topicKeywords = {
    'fees': ['fee', 'cost', 'charge', 'price', '%', 'percent'],
    'timeline': ['when', 'how long', 'time', 'timeline', 'soon'],
    'process': ['process', 'how does', 'what happens', 'steps'],
    'eligibility': ['eligible', 'qualify', 'can i', 'do i have'],
    'documents': ['document', 'upload', 'id', 'statement', 'proof'],
    'diy_vs_service': ['myself', 'alone', 'diy', 'without help']
  }
  
  const lowerMessage = message.toLowerCase()
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return topic
    }
  }
  
  return 'general'
}

function shouldOfferPortalLink(
  context: ResponseContext,
  flow: ReturnType<typeof analyzeConversationFlow>
): boolean {
  // Only offer if:
  // 1. User is engaged (not declining momentum)
  // 2. We've answered their question fully
  // 3. Natural conversation flow allows it
  
  if (flow.conversationMomentum === 'declining') return false
  if (flow.userEngagement === 'low') return false
  
  // Topics that naturally lead to portal link offers
  const linkReadyTopics = ['fees', 'process', 'eligibility']
  if (linkReadyTopics.includes(flow.lastTopic)) return true
  
  // If user seems satisfied with answers
  if (flow.userEngagement === 'high' && flow.questionCount > 0) return true
  
  return false
}
