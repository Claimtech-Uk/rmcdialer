import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageEnhancementOptions {
  message: string;
  context?: {
    userName?: string;
    userStatus?: string;
    claimType?: string;
    isFollowUp?: boolean;
    tone?: 'professional' | 'friendly' | 'urgent' | 'empathetic';
  };
}

export interface MessageEnhancementResult {
  enhancedMessage: string;
  suggestions: string[];
  reasoning: string;
}

/**
 * Enhance an SMS message using OpenAI
 */
export async function enhanceMessage(options: MessageEnhancementOptions): Promise<MessageEnhancementResult> {
  const { message, context = {} } = options;
  
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const { userName, userStatus, claimType, isFollowUp, tone = 'professional' } = context;

  // Build context-aware system prompt
  const systemPrompt = `You are an expert customer service communication specialist for a claims management company. Your role is to enhance SMS messages to be more effective, professional, and empathetic while maintaining brevity suitable for SMS.

Key guidelines:
- Keep messages concise (under 160 characters when possible)
- Maintain a ${tone} tone
- Be clear and actionable
- Show empathy for customer situations
- Use proper grammar and spelling
- Avoid jargon or complex terms
- Include relevant next steps when appropriate

Context:
${userName ? `- Customer name: ${userName}` : ''}
${userStatus ? `- Customer status: ${userStatus}` : ''}
${claimType ? `- Claim type: ${claimType}` : ''}
${isFollowUp ? '- This is a follow-up message' : '- This is an initial contact'}

Your task is to enhance the provided message to be more effective while keeping the core intent intact.`;

  const userPrompt = `Original message: "${message}"

Please enhance this message and provide:
1. An improved version that's clear, professional, and SMS-appropriate
2. 2-3 alternative suggestions with different approaches
3. Brief reasoning for the improvements

Respond in JSON format:
{
  "enhancedMessage": "improved message here",
  "suggestions": ["alternative 1", "alternative 2", "alternative 3"],
  "reasoning": "explanation of improvements made"
}`;

  try {
    // Try GPT-4 first, fallback to GPT-3.5-turbo if needed
    let model = 'gpt-4';
    let useJsonFormat = true;
    
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      const parsed: MessageEnhancementResult = JSON.parse(result);
      
      // Validate the response structure
      if (!parsed.enhancedMessage || !parsed.suggestions || !parsed.reasoning) {
        throw new Error('Invalid response format from OpenAI');
      }

      return parsed;
    } catch (gpt4Error) {
      console.log('GPT-4 failed, trying GPT-3.5-turbo...', gpt4Error);
      
      // Fallback to GPT-3.5-turbo without strict JSON formatting
      const fallbackPrompt = `${systemPrompt}

Original message: "${message}"

Enhance this message to be more professional and effective for SMS. Respond with just the improved message (no JSON format needed).`;

      const fallbackResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: fallbackPrompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const enhancedMessage = fallbackResponse.choices[0]?.message?.content?.trim();
      if (!enhancedMessage) {
        throw new Error('No response from OpenAI fallback');
      }

      // Return a simplified result for fallback
      return {
        enhancedMessage,
        suggestions: [enhancedMessage], // Just return the same message as the only suggestion
        reasoning: 'Message enhanced for clarity and professionalism'
      };
    }
  } catch (error) {
    console.error('OpenAI enhancement error:', error);
    
    // Ultimate fallback - return a simple enhancement
    const simpleEnhancement = message
      .replace(/hi /gi, 'Hello ')
      .replace(/please /gi, 'please ')
      .replace(/thanks/gi, 'Thank you')
      .replace(/thx/gi, 'Thank you')
      .trim();

    return {
      enhancedMessage: simpleEnhancement,
      suggestions: [simpleEnhancement],
      reasoning: 'Basic text enhancement applied (AI service temporarily unavailable)'
    };
  }
}

/**
 * Generate quick response suggestions for common scenarios
 */
export async function generateQuickResponses(context: {
  scenario: 'initial_contact' | 'follow_up' | 'document_request' | 'status_update' | 'callback_scheduling';
  userName?: string;
  claimType?: string;
}): Promise<string[]> {
  const { scenario, userName, claimType } = context;

  const systemPrompt = `Generate 3 professional SMS templates for a claims management company. Each should be under 160 characters, friendly but professional, and include placeholders for personalization.

Scenario: ${scenario}
${userName ? `Customer: ${userName}` : ''}
${claimType ? `Claim type: ${claimType}` : ''}

Return as JSON array of strings.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      temperature: 0.8,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(result);
    return parsed.templates || parsed.responses || [];
  } catch (error) {
    console.error('Quick responses generation error:', error);
    return [];
  }
} 