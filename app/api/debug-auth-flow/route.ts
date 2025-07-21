import { NextResponse } from 'next/server'
import { createTRPCContext } from '@/lib/trpc/server'

export async function GET(request: Request) {
  console.log('🔍 Debugging authentication flow...')
  
  const results = {
    step1_headers: { success: false, details: null as any },
    step2_trpc_context: { success: false, details: null as any },
    step3_agent_context: { success: false, details: null as any }
  }
  
  try {
    // Step 1: Check request headers for auth token
    const authHeader = request.headers.get('authorization')
    const cookieHeader = request.headers.get('cookie')
    
    results.step1_headers = {
      success: true,
      details: {
        hasAuthHeader: !!authHeader,
        authHeaderType: authHeader?.startsWith('Bearer ') ? 'Bearer' : 'Other',
        hasCookies: !!cookieHeader,
        tokenFromStorage: 'Check localStorage in browser',
        message: authHeader ? 'Authorization header found' : 'No authorization header - using development mode'
      }
    }
    
    console.log('📋 Headers checked:', results.step1_headers.details)
    
    // Step 2: Test tRPC context creation
    try {
      const mockReq = new Request(request.url, {
        headers: request.headers
      }) as any
      
      const context = await createTRPCContext({ req: mockReq })
      
      results.step2_trpc_context = {
        success: true,
        details: {
          hasAgent: !!context.agent,
          agentId: context.agent?.id || null,
          agentEmail: context.agent?.email || null,
          agentRole: context.agent?.role || null,
          message: context.agent ? 'Agent found in context' : 'No agent in context - not authenticated'
        }
      }
      
      console.log('🔑 tRPC context:', results.step2_trpc_context.details)
      
    } catch (contextError: any) {
      results.step2_trpc_context = {
        success: false,
        details: { 
          error: contextError.message,
          message: 'Failed to create tRPC context'
        }
      }
      console.error('❌ tRPC context creation failed:', contextError)
    }
    
    // Step 3: Analyze agent context
    const agentContext = results.step2_trpc_context.details
    if (agentContext?.hasAgent) {
      results.step3_agent_context = {
        success: true,
        details: {
          analysis: 'Agent found in context - FK error means this agentId does not exist in agents table',
          agentId: agentContext.agentId,
          recommendation: 'Check if agentId exists in database or create missing agent record'
        }
      }
    } else {
      results.step3_agent_context = {
        success: false,
        details: {
          analysis: 'No agent in context - authentication required',
          recommendation: 'User needs to login first, or development mode needs default agent setup'
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Auth flow debug failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
  
  // Determine diagnosis
  let diagnosis = "Authentication flow analyzed"
  let solution = "Check detailed results"
  
  if (!results.step2_trpc_context.details?.hasAgent) {
    diagnosis = "🔑 ISSUE: No agent in authentication context"
    solution = "User needs to login OR setup development agent seeding"
  } else if (results.step2_trpc_context.details?.hasAgent) {
    diagnosis = "🎯 LIKELY ISSUE: Agent in context but ID doesn't exist in database"
    solution = `Create agent record with ID ${results.step2_trpc_context.details.agentId} or fix authentication`
  }
  
  return NextResponse.json({
    success: true,
    diagnosis,
    solution,
    results,
    timestamp: new Date().toISOString()
  })
} 