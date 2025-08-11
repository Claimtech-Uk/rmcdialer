import { chat } from './llm.client'
import { KNOWLEDGE_KB } from '../knowledge/knowledge-index'
import { getConversationInsights, updateConversationInsights, type ConversationInsights } from './memory.store'

export type ConversationContext = {
  recentMessages?: string[]
  userSentiment?: 'positive' | 'neutral' | 'cautious' | 'frustrated' | 'confused'
  conversationPhase?: 'discovery' | 'objection_handling' | 'decision_making' | 'post_signup'
  topicsDiscussed?: string[]
}

export type KnowledgeSelection = {
  selectedIds: string[]
  reasoning: string
  confidence: number
}

/**
 * Intelligent knowledge base selection using AI semantic understanding
 * Replaces the regex-based approach with context-aware selection
 */
export async function selectKnowledgeIntelligently(
  userMessage: string,
  context?: ConversationContext
): Promise<KnowledgeSelection> {
  
  // Get all available KB items for the selection prompt
  const availableKB = Object.entries(KNOWLEDGE_KB).map(([id, item]) => ({
    id,
    title: item.title,
    summary: item.sms
  }))

  const systemPrompt = `You are an intelligent knowledge selector for an AI claims agent. 

Your task: Select the most relevant knowledge base items for answering the user's message.

Available Knowledge Base:
${availableKB.map(kb => `${kb.id}: ${kb.title} - ${kb.summary}`).join('\n')}

Selection Guidelines:
- Choose 2-5 most relevant KB items
- Consider conversation context and user intent
- Prioritize items that directly address the user's question
- Include foundational items (KB-001, KB-024) for new conversations
- Consider user sentiment and conversation phase
- Be strategic: select items that help move conversation forward

Return a JSON object with:
{
  "selectedIds": ["KB-XXX", ...],
  "reasoning": "Brief explanation of selection logic",
  "confidence": 0.8
}`

  const userPrompt = `User Message: "${userMessage}"

${context ? `Conversation Context:
- Recent Messages: ${context.recentMessages?.join(' → ') || 'None'}
- User Sentiment: ${context.userSentiment || 'unknown'}
- Conversation Phase: ${context.conversationPhase || 'unknown'}
- Topics Previously Discussed: ${context.topicsDiscussed?.join(', ') || 'None'}` : ''}

Select the most relevant knowledge base items to help answer this user's message effectively.`

  try {
    const response = await chat({
      system: systemPrompt,
      user: userPrompt,
      model: 'gpt-4o-mini',
      responseFormat: { type: 'json_object' },
      responseFormat: { type: 'json_object' }
    })

    const parsed = JSON.parse(response) as KnowledgeSelection
    
    // Validate and fallback
    if (!parsed.selectedIds || !Array.isArray(parsed.selectedIds) || parsed.selectedIds.length === 0) {
      console.warn('AI KB selection failed, falling back to rule-based')
      return fallbackKnowledgeSelection(userMessage)
    }

    // Ensure we don't exceed 5 items and all exist
    const validIds = parsed.selectedIds
      .filter(id => KNOWLEDGE_KB[id])
      .slice(0, 5)

    if (validIds.length === 0) {
      console.warn('No valid KB IDs selected, falling back')
      return fallbackKnowledgeSelection(userMessage)
    }

    console.log('AI SMS | 🧠 Intelligent KB selection', {
      userMessage: userMessage.substring(0, 50),
      selectedIds: validIds,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence
    })

    return {
      selectedIds: validIds,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence || 0.7
    }

  } catch (error) {
    console.error('AI SMS | ❌ Intelligent KB selection failed:', error)
    return fallbackKnowledgeSelection(userMessage)
  }
}

/**
 * Enhanced fallback that's smarter than the original regex approach
 */
function fallbackKnowledgeSelection(userMessage: string): KnowledgeSelection {
  const t = userMessage.toLowerCase()
  const picks = new Set<string>()
  
  // Enhanced semantic matching (still rule-based but more intelligent)
  if (/fee|fees|cost|percent|vat|price|charge|expensive/.test(t)) picks.add('KB-024')
  if (/paid|payout|money|when|how long|timeline|wait|receive/.test(t)) { 
    picks.add('KB-014'); picks.add('KB-015'); picks.add('KB-003') 
  }
  if (/supreme|court|hidden|half[- ]?secret|ruling|legal/.test(t)) { 
    picks.add('KB-004'); picks.add('KB-004a'); picks.add('KB-018') 
  }
  if (/dca|commission|broker|dealer|interest|arrangement/.test(t)) { 
    picks.add('KB-001'); picks.add('KB-002') 
  }
  if (/credit|score|report|rating|affect/.test(t)) picks.add('KB-011')
  if (/id|passport|driv(ing|er)|proof|document|upload/.test(t)) picks.add('KB-007')
  if (/sign|signature|loa|authorize|agreement/.test(t)) picks.add('KB-008')
  if (/cancel|cooling[- ]?off|withdraw|change mind/.test(t)) picks.add('KB-016')
  if (/multiple|another|more than one|several/.test(t)) picks.add('KB-021')
  if (/diy|myself|martin lewis|alone|direct/.test(t)) { picks.add('KB-005'); picks.add('KB-020') }
  if (/scam|fraud|legitimate|real|trust/.test(t)) picks.add('QRG-SCAM')
  if (/complaint|unhappy|service|problem/.test(t)) picks.add('KB-023')
  
  // Default foundational knowledge for new conversations
  if (picks.size === 0) { 
    picks.add('KB-001'); picks.add('KB-024'); picks.add('KB-014') 
  }

  const selectedIds = Array.from(picks).slice(0, 5)
  
  return {
    selectedIds,
    reasoning: 'Fallback rule-based selection due to AI selection failure',
    confidence: 0.6
  }
}

/**
 * Analyze conversation for context to improve knowledge selection
 * Enhanced to use stored conversation insights
 */
export async function analyzeConversationContext(
  recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}>,
  phoneNumber?: string
): Promise<ConversationContext> {
  if (!recentMessages || recentMessages.length === 0) {
    return {}
  }

  const userMessages = recentMessages
    .filter(m => m.direction === 'inbound')
    .map(m => m.body.toLowerCase())

  const allText = userMessages.join(' ').toLowerCase()

  // Enhanced sentiment analysis
  let userSentiment: ConversationContext['userSentiment'] = 'neutral'
  if (/good|great|thanks|perfect|excellent|happy|pleased|satisfied/.test(allText)) {
    userSentiment = 'positive'
  } else if (/worried|concerned|scared|nervous|unsure|doubt|hesitant|careful/.test(allText)) {
    userSentiment = 'cautious'
  } else if (/angry|frustrated|annoyed|terrible|awful|hate|upset|disappointed/.test(allText)) {
    userSentiment = 'frustrated'
  } else if (/confused|don't understand|unclear|what|how|explain|help me/.test(allText)) {
    userSentiment = 'confused'
  }

  // Enhanced conversation phase detection
  let conversationPhase: ConversationContext['conversationPhase'] = 'discovery'
  if (/sign|signature|portal|link|ready|proceed|continue/.test(allText)) {
    conversationPhase = 'decision_making'
  } else if (/but|however|concern|worry|problem|issue|disagree/.test(allText)) {
    conversationPhase = 'objection_handling'
  } else if (/signed|uploaded|completed|done|finished/.test(allText)) {
    conversationPhase = 'post_signup'
  }

  // Enhanced topics discussed
  const topicsDiscussed: string[] = []
  if (/fee|cost|price|charge|percent|vat/.test(allText)) topicsDiscussed.push('fees')
  if (/timeline|when|how long|wait|time/.test(allText)) topicsDiscussed.push('timeline')
  if (/court|supreme|legal|ruling|law/.test(allText)) topicsDiscussed.push('legal_changes')
  if (/credit|score|report|rating/.test(allText)) topicsDiscussed.push('credit_impact')
  if (/sign|signature|document/.test(allText)) topicsDiscussed.push('signing_process')
  if (/dca|commission|hidden|secret/.test(allText)) topicsDiscussed.push('commission_issues')
  if (/diy|myself|martin lewis|alone/.test(allText)) topicsDiscussed.push('diy_concerns')

  // If phone number provided, get stored insights and update them
  if (phoneNumber) {
    const insights = await getConversationInsights(phoneNumber)
    
    // Merge topics with previously discussed topics
    const allTopics = [...(insights?.topicsDiscussed || []), ...topicsDiscussed]
    const uniqueTopics = Array.from(new Set(allTopics))

    // Update insights with new analysis
    await updateConversationInsights(phoneNumber, {
      userSentiment,
      conversationPhase,
      topicsDiscussed: uniqueTopics.slice(-10) // Keep last 10 topics
    })
  }

  return {
    recentMessages: userMessages.slice(-3), // Last 3 user messages
    userSentiment,
    conversationPhase,
    topicsDiscussed
  }
}

/**
 * Comprehensive conversation analysis that stores insights
 */
export async function analyzeAndStoreConversationInsights(
  phoneNumber: string,
  currentMessage: string,
  recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}>
): Promise<ConversationInsights> {
  const context = await analyzeConversationContext(recentMessages, phoneNumber)
  
  // Analyze user style from message characteristics
  let userStyle: ConversationInsights['userStyle'] = 'detailed'
  const msgLength = currentMessage.length
  const wordCount = currentMessage.split(/\s+/).length
  
  if (msgLength < 30 || wordCount < 5) {
    userStyle = 'concise'
  } else if (/technical|specific|detail|explain|how|why/.test(currentMessage.toLowerCase())) {
    userStyle = 'technical'
  } else if (/worry|concern|safe|trust|sure/.test(currentMessage.toLowerCase())) {
    userStyle = 'reassuring_needed'
  }

  // Detect engagement level
  let engagementLevel: ConversationInsights['engagementLevel'] = 'medium'
  const responseTime = recentMessages.length // Simple proxy for engagement
  if (responseTime > 8) {
    engagementLevel = 'high'
  } else if (responseTime < 3) {
    engagementLevel = 'low'
  }

  // Store comprehensive insights
  const insights = await updateConversationInsights(phoneNumber, {
    userSentiment: context.userSentiment || 'neutral',
    conversationPhase: context.conversationPhase || 'discovery',
    topicsDiscussed: context.topicsDiscussed || [],
    userStyle,
    engagementLevel
  })

  console.log('AI SMS | 🧠 Conversation insights updated', {
    phone: phoneNumber.substring(0, 8) + '***',
    sentiment: insights.userSentiment,
    phase: insights.conversationPhase,
    style: insights.userStyle,
    topics: insights.topicsDiscussed.length
  })

  return insights
}
