// Debug the simplified response builder specifically
// Test with detailed logging of every step

import { NextRequest } from 'next/server';
import { buildSimplifiedResponse, type SimplifiedResponseContext } from '@/modules/ai-agents/core/simplified-response-builder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message = "Send me the link" } = body;

    console.log('🔬 [SIMPLIFIED DEBUG] Starting test');

    // Create test context similar to what agent runtime would create
    const testContext: SimplifiedResponseContext = {
      userMessage: message,
      userName: "James",
      recentMessages: [], // Empty for test
      conversationInsights: null,
      knowledgeContext: undefined,
      userStatus: 'unsigned_users',
      userContext: {
        found: true,
        userId: 12345,
        queueType: 'unsigned_users',
        hasSignature: false,
        pendingRequirements: 1
      }
    };

    console.log('🔬 [SIMPLIFIED DEBUG] Context prepared:', {
      userMessage: testContext.userMessage,
      userName: testContext.userName,
      userFound: testContext.userContext.found,
      userStatus: testContext.userStatus
    });

    // Call the simplified response builder directly
    console.log('🔬 [SIMPLIFIED DEBUG] Calling buildSimplifiedResponse...');
    const result = await buildSimplifiedResponse('+447700900001', testContext);

    console.log('🔬 [SIMPLIFIED DEBUG] Result received:', {
      messageCount: result.messages.length,
      actionCount: result.actions.length,
      firstMessage: result.messages[0]?.substring(0, 50) + '...',
      primaryAction: result.actions[0]?.type,
      reasoning: result.actions[0]?.reasoning
    });

    return new Response(JSON.stringify({
      success: true,
      debug: {
        step: 'buildSimplifiedResponse completed successfully',
        timestamp: new Date().toISOString()
      },
      input: {
        message,
        contextSummary: {
          userFound: testContext.userContext.found,
          userName: testContext.userName,
          userStatus: testContext.userStatus
        }
      },
      output: {
        messages: result.messages,
        actions: result.actions,
        conversationTone: result.conversationTone,
        reasoning: result.reasoning
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🔬 [SIMPLIFIED DEBUG ERROR]', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'UnknownError'
    });
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        step: 'Error in buildSimplifiedResponse call',
        fullError: {
          message: error instanceof Error ? error.message : 'Unknown',
          name: error instanceof Error ? error.name : 'UnknownError',
          stack: error instanceof Error ? error.stack : undefined
        },
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
    message: "Simplified Response Builder Debug Endpoint",
    purpose: "Test buildSimplifiedResponse directly with detailed logging"
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
