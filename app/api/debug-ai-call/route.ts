// Debug Direct AI Call - Test OpenAI integration directly
// Bypasses all agent logic to test pure AI functionality

import { NextRequest } from 'next/server';
import { universalChat } from '@/modules/ai-agents/core/multi-provider-llm.client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return new Response(JSON.stringify({ 
        error: 'Message is required' 
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    console.log('🔬 [AI DEBUG] Direct AI call test starting');
    
    // Test the exact system and user prompts that would be used
    const systemPrompt = `You are Sophie from Resolve My Claim, a UK motor finance claims company. 

You help customers with motor finance mis-selling claims (PCP/HP agreements from 2007-2020).

RESPONSE FORMAT: Respond with a JSON object containing:
{
  "messages": ["message 1", "message 2", "message 3"],
  "actions": [{"type": "send_portal_link|none", "reasoning": "why you chose this"}],
  "conversationTone": "helpful|consultative|encouraging"
}

KEY BEHAVIORS:
- Be conversational and natural
- Answer questions directly
- Offer portal links when user seems ready to proceed
- Keep responses concise but helpful`;

    const userPrompt = `User Message: "${message}"

Context: New conversation, user found in system, eligible for claims.

Respond naturally and decide if they need a portal link to proceed.`;

    console.log('🔬 [AI DEBUG] Calling OpenAI with prompts...');
    
    const startTime = Date.now();
    const aiResponse = await universalChat({
      system: systemPrompt,
      user: userPrompt,
      model: 'gpt-4o-mini',
      responseFormat: { type: 'json_object' }
    });
    const responseContent = aiResponse.content || '';
    
    const duration = Date.now() - startTime;
    
    console.log('🔬 [AI DEBUG] AI responded successfully', {
      duration: `${duration}ms`,
      responseLength: responseContent.length,
      responsePreview: responseContent.substring(0, 100) + '...',
      provider: aiResponse.provider,
      modelUsed: aiResponse.modelUsed
    });

    // Try to parse the JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
      console.log('🔬 [AI DEBUG] JSON parsing successful');
    } catch (parseError) {
      console.log('🔬 [AI DEBUG] JSON parsing failed:', parseError);
      return new Response(JSON.stringify({
        success: false,
        error: 'JSON parsing failed',
        rawResponse: responseContent,
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    console.log('🔬 [AI DEBUG] Complete success!');

    return new Response(JSON.stringify({
      success: true,
      debug: {
        duration: `${duration}ms`,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
        timestamp: new Date().toISOString()
      },
      input: {
        message,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length
      },
      rawResponse: responseContent,
      parsedResponse,
      analysis: {
        hasMessages: Array.isArray(parsedResponse.messages),
        messageCount: parsedResponse.messages?.length || 0,
        hasActions: Array.isArray(parsedResponse.actions),
        actionCount: parsedResponse.actions?.length || 0,
        tone: parsedResponse.conversationTone || 'unknown'
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🔬 [AI DEBUG ERROR]', error);
    
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'UnknownError'
    };
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorDetails.message,
      debug: {
        fullError: errorDetails,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 15) + '...' || 'not set',
        timestamp: new Date().toISOString()
      }
    }, null, 2), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({
    message: "Direct AI Call Debug Endpoint",
    purpose: "Test OpenAI integration directly without agent logic",
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 15) + '...' || 'not set'
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
