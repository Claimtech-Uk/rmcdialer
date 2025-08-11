/**
 * Intelligent 3-Message Sequence Analyzer
 * 
 * Determines when a user's question/message would benefit from a 3-part response:
 * 1. Direct answer/response
 * 2. Value-add information 
 * 3. Engaging call-to-action
 * 
 * The AI intelligently decides based on question complexity, conversation context,
 * and opportunity for providing additional value.
 */

import { hybridChat } from './modern-llm.client'

export type SequenceDecision = {
  shouldUseSequence: boolean
  reason: string
  confidence: number // 0-1 scale
}

export type ThreeMessageSequence = {
  message1: string // Direct response
  message2: string // Value-add 
  message3: string // Call-to-action
  sequenceReason: string
}

export type SequenceAnalysisContext = {
  userMessage: string
  userName?: string
  conversationPhase?: string
  userEngagement?: 'high' | 'medium' | 'low'
  messageCount?: number
  recentQuestions?: number
  knowledgeContext?: string
}

/**
 * Analyzes if a 3-message sequence would add value to the response
 */
export async function analyzeSequenceOpportunity(context: SequenceAnalysisContext): Promise<SequenceDecision> {
  try {
    const systemPrompt = `You are an intelligent conversation analyzer. Determine if a user's message would benefit from a 3-part response sequence vs a single message.

A 3-message sequence works well when:
- Questions about fees, costs, charges, or pricing (almost always benefits from 3-part explanation)
- Process questions (how claims work, what happens next, timelines)
- Legal or complex topic questions (Supreme Court, regulations, eligibility)
- "What" or "How" questions that can include value-add information
- Any question where you can provide: Direct answer + Additional context + Next step
- User shows medium to high engagement (longer messages, specific questions)

A single message works better when:
- Simple yes/no questions or confirmations
- Quick clarifications or corrections
- Greeting messages or small talk
- User seems overwhelmed (very short messages, low engagement)
- Recent follow-up to a sequence that was just sent

CONTEXT:
- User engagement: ${context.userEngagement || 'unknown'}
- Conversation phase: ${context.conversationPhase || 'unknown'}
- Message count: ${context.messageCount || 0}
- Recent questions: ${context.recentQuestions || 0}

Respond in JSON format only:
{
  "shouldUseSequence": boolean,
  "reason": "Brief explanation of decision",
  "confidence": number // 0-1, how confident you are in this decision
}`

    const userPrompt = `User message: "${context.userMessage}"

${context.knowledgeContext ? `Relevant knowledge available: ${context.knowledgeContext}` : ''}

Should this message get a 3-part sequence response or single message?`

    const response = await hybridChat({
      systemPrompt,
      userPrompt,
      model: 'gpt-4o-mini'
    })

    if (response.content) {
      try {
        const decision = JSON.parse(response.content) as SequenceDecision
        
        console.log('AI SMS | 🎯 Sequence analysis decision:', {
          shouldUse: decision.shouldUseSequence,
          reason: decision.reason,
          confidence: decision.confidence
        })
        
        return decision
      } catch (parseError) {
        console.error('AI SMS | ❌ Failed to parse sequence decision:', parseError)
      }
    }
  } catch (error) {
    console.error('AI SMS | ❌ Error analyzing sequence opportunity:', error)
  }

  // Safe fallback - default to single message for simple cases
  const isSingleWord = context.userMessage.trim().split(' ').length <= 3
  const isGreeting = /^(hi|hey|hello|thanks|thank you|ok|okay|yes|no)$/i.test(context.userMessage.trim())
  
  return {
    shouldUseSequence: !isSingleWord && !isGreeting && (context.userEngagement === 'high'),
    reason: 'Fallback logic - prefer single message for safety',
    confidence: 0.3
  }
}

/**
 * Generates a strategic 3-message sequence
 */
export async function generateMessageSequence(context: SequenceAnalysisContext): Promise<ThreeMessageSequence | null> {
  try {
    const systemPrompt = `You are an expert conversation designer. Create a strategic 3-message sequence that feels natural and valuable.

SEQUENCE STRUCTURE:
1. DIRECT RESPONSE: Answer their immediate question/concern directly and clearly
2. VALUE-ADD: Provide additional helpful context, benefits, or relevant information they might not know
3. CALL-TO-ACTION: Engaging question or next step that maintains conversation momentum

GUIDELINES:
- Each message should be 1-2 sentences maximum
- Messages should flow naturally together
- Message 2 should genuinely add value, not just repeat message 1
- Message 3 should be engaging and specific to their situation
- Avoid generic "Would you like your portal link?" - be more creative
- Use confident, consultative tone
- ${context.userName ? `Occasionally use name "${context.userName}" but don't overuse` : 'No name available'}

CONTEXT:
- User engagement: ${context.userEngagement || 'medium'}
- Conversation phase: ${context.conversationPhase || 'discovery'}
- Knowledge context: ${context.knowledgeContext || 'General RMC assistance'}

Respond in JSON format only:
{
  "message1": "Direct answer to their question",
  "message2": "Value-added information or context", 
  "message3": "Engaging call-to-action or question",
  "sequenceReason": "Why this 3-part approach adds value"
}`

    const userPrompt = `User message: "${context.userMessage}"

Create a natural 3-message sequence that provides value and maintains engagement.`

    const response = await hybridChat({
      systemPrompt,
      userPrompt,
      model: 'gpt-4o-mini'
    })

    if (response.content) {
      try {
        const sequence = JSON.parse(response.content) as ThreeMessageSequence
        
        console.log('AI SMS | 📝 Generated 3-message sequence:', {
          message1Length: sequence.message1.length,
          message2Length: sequence.message2.length,
          message3Length: sequence.message3.length,
          reason: sequence.sequenceReason
        })
        
        return sequence
      } catch (parseError) {
        console.error('AI SMS | ❌ Failed to parse message sequence:', parseError)
      }
    }
  } catch (error) {
    console.error('AI SMS | ❌ Error generating message sequence:', error)
  }

  return null
}
