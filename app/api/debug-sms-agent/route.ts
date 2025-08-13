// Debug SMS Agent Testing Endpoint
// Shows detailed logging and error information

import { NextRequest } from 'next/server';
import { AgentRuntimeService } from '@/modules/ai-agents/core/agent-runtime.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, phoneNumber = '+447700900001' } = body;

    if (!message) {
      return new Response(JSON.stringify({ 
        error: 'Message is required' 
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    console.log('🔍 [DEBUG] Starting agent debug test:', { 
      message, 
      phoneNumber,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) + '...'
    });

    // Initialize agent runtime
    const agentService = new AgentRuntimeService();
    
    // Add detailed logging
    console.log('🔍 [DEBUG] Agent service created');
    
    // Call the agent directly
    console.log('🔍 [DEBUG] Calling handleTurn...');
    const result = await agentService.handleTurn({
      channel: 'sms',
      fromPhone: phoneNumber,
      message: message
    });
    
    console.log('🔍 [DEBUG] Agent response received:', {
      replyLength: result.reply.text.length,
      replyPreview: result.reply.text.substring(0, 100),
      actionsCount: result.actions?.length || 0,
      followupsCount: result.followups?.length || 0
    });

    // Check if this is the fallback response
    const isFallbackResponse = result.reply.text.includes("I understand your question. How can I help you with your motor finance claim?");
    
    if (isFallbackResponse) {
      console.log('🔍 [DEBUG] ⚠️ FALLBACK RESPONSE DETECTED - Something went wrong in AI processing');
    }

    // Format detailed debug response
    const debugResult = {
      success: true,
      debug: {
        isFallbackResponse,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        openAIKeyStatus: process.env.OPENAI_API_KEY ? 'present' : 'missing',
        timestamp: new Date().toISOString()
      },
      input: {
        message,
        phoneNumber
      },
      output: {
        reply: result.reply.text,
        actions: result.actions,
        followups: result.followups || []
      },
      analysis: {
        messageCount: result.reply.text.split('\n\n').length,
        hasPortalLink: result.reply.text.includes('claim.resolvemyclaim.co.uk') || 
                       result.reply.text.toLowerCase().includes('portal'),
        actionsTriggered: result.actions?.length || 0,
        actionTypes: result.actions?.map(a => a.type) || [],
        followupsScheduled: result.followups?.length || 0,
        replyCharCount: result.reply.text.length,
        containsLinkPlaceholder: result.reply.text.includes('{LINK_PLACEHOLDER}')
      }
    };

    console.log('🔍 [DEBUG] Full debug result prepared');

    return new Response(JSON.stringify(debugResult, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🔍 [DEBUG ERROR]', error);
    
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
    message: "SMS Agent Debug Endpoint",
    purpose: "Shows detailed debug information about AI agent processing",
    usage: "POST with { message: 'your test message' }",
    debugInfo: {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 15) + '...' || 'not set',
      timestamp: new Date().toISOString()
    }
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
