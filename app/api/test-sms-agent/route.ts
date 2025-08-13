// Direct SMS Agent Testing Endpoint
// Bypasses Twilio for direct AI agent testing

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

    console.log('🧪 [TEST] Direct AI agent test:', { message, phoneNumber });

    // Initialize agent runtime
    const agentService = new AgentRuntimeService();
    
    // Call the agent directly
    const result = await agentService.handleTurn({
      channel: 'sms',
      fromPhone: phoneNumber,
      message: message
    });

    // Format response for easy analysis
    const testResult = {
      success: true,
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
        followupsScheduled: result.followups?.length || 0
      }
    };

    console.log('🧪 [TEST RESULT]', JSON.stringify(testResult, null, 2));

    return new Response(JSON.stringify(testResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🧪 [TEST ERROR]', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({
    message: "SMS Agent Test Endpoint",
    usage: "POST with { message: 'your test message', phoneNumber: '+447700900001' }",
    examples: [
      { message: "What is motor finance mis-selling?", expected: "Educational response" },
      { message: "Send me the link", expected: "Portal link action" },
      { message: "How much do you charge?", expected: "Fee explanation with possible link offer" },
      { message: "Is this a scam?", expected: "Legitimacy assurance" }
    ]
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
