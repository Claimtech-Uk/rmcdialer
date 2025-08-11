import { chat } from './llm.client'
import { getConversationInsights } from './memory.store'
import type { ConversationInsights } from './memory.store'

export type QuestionType = 
  | 'fees_pricing' 
  | 'timeline_payment' 
  | 'process_how_it_works'
  | 'safety_legitimacy'
  | 'documents_requirements'
  | 'legal_regulatory'
  | 'general_inquiry'
  | 'objection_concern'

export type CallToActionVariant = 
  | 'portal_link_direct'
  | 'get_started'
  | 'questions_before_signup'
  | 'ready_to_proceed'
  | 'next_steps'
  | 'upload_documents'
  | 'status_check'

export type EnhancedResponse = {
  coreAnswer: string
  additionalValue: string[]
  callToAction: string
  questionType: QuestionType
  ctaVariant: CallToActionVariant
}

/**
 * Intelligent response enhancement that provides rich, value-focused answers
 * with varied call-to-actions based on conversation context
 */
export async function enhanceResponse(
  originalResponse: string,
  userQuestion: string,
  phoneNumber: string
): Promise<EnhancedResponse> {
  
  const insights = await getConversationInsights(phoneNumber)
  const questionType = await classifyQuestion(userQuestion, insights)
  
  // Get enhanced response with value-added information
  const enhancedAnswer = await generateValueFocusedResponse(
    originalResponse,
    userQuestion,
    questionType,
    insights
  )
  
  // Choose appropriate call-to-action based on context
  const ctaVariant = selectCallToActionVariant(questionType, insights)
  const callToAction = generateCallToAction(ctaVariant, insights)
  
  console.log('AI SMS | 💎 Enhanced response generated', {
    phone: phoneNumber.substring(0, 8) + '***',
    questionType,
    ctaVariant,
    hasAdditionalValue: enhancedAnswer.additionalValue.length > 0
  })
  
  return {
    coreAnswer: enhancedAnswer.coreAnswer,
    additionalValue: enhancedAnswer.additionalValue,
    callToAction,
    questionType,
    ctaVariant
  }
}

/**
 * Classify the type of question to provide appropriate enhancement
 */
async function classifyQuestion(
  userQuestion: string,
  insights: ConversationInsights | null
): Promise<QuestionType> {
  
  const systemPrompt = `You are a question classifier for a legal claims service.

Classify the user's question into one of these categories:
- fees_pricing: Questions about costs, fees, percentages, pricing
- timeline_payment: Questions about how long it takes, when they get paid
- process_how_it_works: Questions about the process, how the service works
- safety_legitimacy: Questions about trust, safety, legitimacy, scams
- documents_requirements: Questions about what documents/info is needed
- legal_regulatory: Questions about legal aspects, court rulings, regulations
- objection_concern: Objections or concerns about the service
- general_inquiry: General questions or requests for information

Return only the category name.`

  const userPrompt = `User question: "${userQuestion}"

${insights ? `Conversation context:
- User sentiment: ${insights.userSentiment}
- Conversation phase: ${insights.conversationPhase}
- Topics discussed: ${insights.topicsDiscussed.join(', ')}` : ''}

Classify this question:`

  try {
    const response = await chat({
      system: systemPrompt,
      user: userPrompt,
      model: 'gpt-4o-mini',
      responseFormat: { type: 'json_object' }
    })
    
    const classification = response.trim().toLowerCase() as QuestionType
    
    // Validate classification
    const validTypes: QuestionType[] = [
      'fees_pricing', 'timeline_payment', 'process_how_it_works', 
      'safety_legitimacy', 'documents_requirements', 'legal_regulatory',
      'objection_concern', 'general_inquiry'
    ]
    
    return validTypes.includes(classification) ? classification : 'general_inquiry'
    
  } catch (error) {
    console.warn('AI SMS | ⚠️ Question classification failed:', error)
    return 'general_inquiry'
  }
}

/**
 * Generate value-focused response with additional context
 */
async function generateValueFocusedResponse(
  originalResponse: string,
  userQuestion: string,
  questionType: QuestionType,
  insights: ConversationInsights | null
): Promise<{ coreAnswer: string; additionalValue: string[] }> {
  
  const valueAdditions = getValueAdditions(questionType)
  
  // Enhance core answer based on question type
  let coreAnswer = originalResponse
  const additionalValue: string[] = []
  
  switch (questionType) {
    case 'fees_pricing':
      coreAnswer = enhanceFeeResponse(originalResponse)
      additionalValue.push(
        "This is on a sliding scale - the more compensation, the lower % we charge.",
        "We'll investigate 3 types of claims to maximise your compensation."
      )
      break
      
    case 'timeline_payment':
      additionalValue.push(
        "We'll keep you updated throughout and chase lenders proactively.",
        "Most cases are stronger when we find older agreements back to 2007."
      )
      break
      
    case 'process_how_it_works':
      additionalValue.push(
        "We handle everything - documents, complaints, negotiations.",
        "You'll have a secure portal to track progress and upload any missing items."
      )
      break
      
    case 'safety_legitimacy':
      additionalValue.push(
        "We're regulated and work with Prowse Phillips Law solicitors.",
        "All data is handled securely and we're fully FCA compliant."
      )
      break
      
    case 'documents_requirements':
      additionalValue.push(
        "We can often find older agreements through credit checks going back to 2007.",
        "Most documents can be uploaded securely through your portal."
      )
      break
      
    case 'legal_regulatory':
      additionalValue.push(
        "DCA and unfair relationship claims are still proceeding normally.",
        "We track all regulatory changes to ensure your case is handled properly."
      )
      break
  }
  
  return { coreAnswer, additionalValue }
}

/**
 * Enhance fee-related responses with more nuanced information
 */
function enhanceFeeResponse(originalResponse: string): string {
  // Replace simple fee statements with more nuanced versions
  return originalResponse
    .replace(/fee is 30%/gi, 'fee is up to 30%')
    .replace(/30% \+ VAT/gi, 'up to 30% + VAT')
    .replace(/capped at 30%/gi, 'capped at 30% on a sliding scale')
}

/**
 * Select appropriate call-to-action variant based on context
 */
function selectCallToActionVariant(
  questionType: QuestionType,
  insights: ConversationInsights | null
): CallToActionVariant {
  
  if (!insights) return 'get_started'
  
  const { conversationPhase, messageCount, topicsDiscussed } = insights
  
  // If they've asked multiple questions, use "questions before signup"
  if (messageCount > 4 || topicsDiscussed.length > 2) {
    return 'questions_before_signup'
  }
  
  // Based on conversation phase
  switch (conversationPhase) {
    case 'discovery':
      return messageCount > 2 ? 'get_started' : 'next_steps'
      
    case 'objection_handling':
      return 'questions_before_signup'
      
    case 'decision_making':
      return 'ready_to_proceed'
      
    case 'post_signup':
      return 'upload_documents'
      
    default:
      // Based on question type for discovery phase
      switch (questionType) {
        case 'fees_pricing':
        case 'timeline_payment':
          return 'questions_before_signup'
          
        case 'process_how_it_works':
          return 'get_started'
          
        case 'safety_legitimacy':
          return 'ready_to_proceed'
          
        case 'documents_requirements':
          return 'upload_documents'
          
        default:
          return 'next_steps'
      }
  }
}

/**
 * Generate natural call-to-action based on variant
 */
function generateCallToAction(
  variant: CallToActionVariant,
  insights: ConversationInsights | null
): string {
  
  const variants: Record<CallToActionVariant, string[]> = {
    portal_link_direct: [
      "Would you like your portal link?",
      "Want me to send your portal link?",
      "Ready for your portal link?"
    ],
    get_started: [
      "Should we get started?",
      "Ready to get started?",
      "Shall we get you set up?",
      "Want to get moving on your claim?"
    ],
    questions_before_signup: [
      "Any other questions before we sign you up?",
      "Anything else you'd like to know before we proceed?",
      "Any questions before we get started?",
      "Ready to move forward, or any other questions?"
    ],
    ready_to_proceed: [
      "Ready to proceed?",
      "Does that help? Ready to move forward?",
      "Happy to continue?",
      "Shall we get you signed up?"
    ],
    next_steps: [
      "What would you like to do next?",
      "Would you like to take the next step?",
      "Ready for the next step?",
      "How would you like to proceed?"
    ],
    upload_documents: [
      "Ready to upload your documents?",
      "Want to get your documents uploaded?",
      "Shall we get your requirements sorted?"
    ],
    status_check: [
      "Would you like a status update?",
      "Want to check your progress?",
      "Ready to see where things stand?"
    ]
  }
  
  const options = variants[variant]
  
  // Use message count as seed for consistent but varied selection
  const messageCount = insights?.messageCount || 1
  const index = messageCount % options.length
  
  return options[index]
}

/**
 * Get value-addition templates based on question type
 */
function getValueAdditions(questionType: QuestionType): string[] {
  const valueMap: Record<QuestionType, string[]> = {
    fees_pricing: [
      "We work on a sliding scale - better results, lower fees",
      "We investigate multiple claim types to maximise your compensation"
    ],
    timeline_payment: [
      "We proactively chase and track your case throughout",
      "Most cases are stronger when we find older agreements"
    ],
    process_how_it_works: [
      "We handle everything from start to finish",
      "Secure portal keeps you updated on progress"
    ],
    safety_legitimacy: [
      "Fully regulated and working with qualified solicitors",
      "All data handled securely and compliantly"
    ],
    documents_requirements: [
      "We can find older agreements through our credit search",
      "Secure portal makes document upload simple"
    ],
    legal_regulatory: [
      "We track all regulatory changes for your benefit",
      "Multiple claim types ensure best possible outcome"
    ],
    objection_concern: [
      "We address all concerns transparently",
      "No obligation - you're in control throughout"
    ],
    general_inquiry: [
      "We're here to help with any questions",
      "No pressure - we want you to feel confident"
    ]
  }
  
  return valueMap[questionType] || []
}

/**
 * Check if response should be enhanced (not all responses need enhancement)
 */
export function shouldEnhanceResponse(
  originalResponse: string,
  userQuestion: string
): boolean {
  // Don't enhance if response is already long
  if (originalResponse.length > 200) return false
  
  // Don't enhance simple acknowledgments
  if (/^(ok|got it|understood|thanks)/i.test(originalResponse)) return false
  
  // Don't enhance if it's already a question
  if (originalResponse.includes('?') && originalResponse.length < 100) return false
  
  // Don't enhance if user just said hi/hello
  if (/^(hi|hello|hey)\b/i.test(userQuestion.trim())) return false
  
  return true
}
