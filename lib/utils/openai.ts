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
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
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
  } catch (error) {
    console.error('OpenAI enhancement error:', error);
    throw new Error('Failed to enhance message with AI');
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