import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/modules/users/services/user.service'
import { AgentContextBuilder } from '@/modules/ai-agents/core/context-builder'
import { buildSimplifiedResponse } from '@/modules/ai-agents/core/simplified-response-builder'
import { getConversationInsights } from '@/modules/ai-agents/core/memory.store'

/**
 * Debug endpoint to test the enhanced prompt system with real user data
 * Shows the full prompt that would be generated for a specific user
 */
// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Safely extract search params with validation
    let userId = 2064
    let message = 'Do you need anything from me?'
    
    try {
      const searchParams = request.nextUrl?.searchParams || new URLSearchParams()
      userId = parseInt(searchParams.get('userId') || '2064')
      message = searchParams.get('message') || 'Do you need anything from me?'
    } catch (urlError) {
      console.warn(`⚠️ [API] URL parsing failed, using defaults:`, urlError)
    }
    
    console.log(`🧪 [DEBUG] Testing enhanced prompt for user ${userId}`)
    
    // Step 1: Get user data using the same services the AI agent uses
    const userService = new UserService()
    const contextBuilder = new AgentContextBuilder(userService)
    
    // Get user by ID (we'll need to get their phone first)
    const userCallContext = await userService.getUserCallContext(userId, {
      includeAddress: true,
      includeRequirementDetails: true
    })
    
    if (!userCallContext) {
      return NextResponse.json({
        success: false,
        error: `User ${userId} not found`
      }, { status: 404 })
    }
    
    // Step 2: Build agent context (this is what the AI agent actually sees)
    const phoneNumber = userCallContext.user.phoneNumber || '+1234567890'
    const agentContext = await contextBuilder.buildFromPhone(phoneNumber)
    
    // Step 3: Get conversation insights 
    const insights = await getConversationInsights(phoneNumber)
    
    // Step 4: Build the context that goes into the prompt
    const context = {
      userMessage: message,
      userName: agentContext.firstName,
      recentMessages: [
        { direction: 'inbound' as const, body: 'Morning sexy' },
        { direction: 'outbound' as const, body: 'Hi James, good morning! 😊 I\'m here to help you with your claim investigation. Right now, we need to gather some more information from you for the process.' },
        { direction: 'inbound' as const, body: message }
      ],
      conversationInsights: insights,
      userContext: {
        found: agentContext.found,
        userId: agentContext.userId,
        queueType: agentContext.queueType,
        hasSignature: agentContext.queueType !== 'unsigned_users', // Infer from queue type
        pendingRequirementTypes: agentContext.pendingRequirementTypes,
        primaryClaimStatus: agentContext.primaryClaimStatus,
        claimLenders: agentContext.claimLenders,
        claimRequirements: agentContext.claimRequirements // ENHANCED: Include claim-specific requirements
      }
    }
    
    // Step 5: Show what the AI would actually see (without making the API call)
    // We'll extract the prompt building logic
    console.log('🔍 [DEBUG] Context that would be passed to AI:', context)
    
    // Get the prompt that would be built (we need to examine the simplified response builder)
    const response = {
      success: true,
      debug: {
        userId,
        message,
        phoneNumber,
        userCallContext: {
          user: {
            id: userCallContext.user.id,
            firstName: userCallContext.user.firstName,
            lastName: userCallContext.user.lastName,
            phoneNumber: userCallContext.user.phoneNumber,
            status: userCallContext.user.status,
            isEnabled: userCallContext.user.isEnabled
          },
          claims: userCallContext.claims.map(claim => ({
            id: claim.id,
            status: claim.status,
            lender: claim.lender,
            requirementCount: claim.requirements?.length || 0,
            pendingRequirements: claim.requirements?.filter(r => r.status === 'PENDING').map(r => r.type) || []
          }))
        },
        agentContext,
        promptContext: context,
        priorityMatrix: {
          found: context.userContext.found,
          hasSignature: context.userContext.hasSignature,
          pendingRequirementTypes: context.userContext.pendingRequirementTypes,
          currentPriority: !context.userContext.hasSignature 
            ? "🥇 PRIORITY 1: Get Signature (They're unsigned)"
            : context.userContext.pendingRequirementTypes?.length > 0
            ? "🥈 PRIORITY 2: Upload Documents (Outstanding requirements)"
            : "🥉 PRIORITY 3: Status Updates or Reviews (All requirements met)"
        }
      }
    }
    
    // Add formatted prompt sections
    const contextAwareness = `
🧠 CRITICAL CONTEXT AWARENESS - You Already Know This About The Customer:

📊 CUSTOMER DATA INVENTORY:
• Found in System: ${context.userContext.found ? 'YES ✅' : 'NO ❌'}
• Customer Name: ${context.userName ? `${context.userName} ✅` : 'Not available ❌'}
• Signature Status: ${context.userContext.hasSignature ? 'SIGNED ✅' : 'UNSIGNED ⚠️ (TOP PRIORITY)'}
• Outstanding Requirements: ${(context.userContext.pendingRequirementTypes?.length || 0) > 0 
        ? `${context.userContext.pendingRequirementTypes?.join(', ')} ⚠️` 
        : 'None ✅'}
• Primary Claim Status: ${context.userContext.primaryClaimStatus || 'Unknown'}
• Queue Type: ${context.userContext.queueType || 'Customer Service'}

🚨 CRITICAL: DO NOT ASK FOR INFORMATION YOU ALREADY HAVE!
• If you have their name, don't ask for it again
• If they're in the system, you likely have basic details
• Focus on what you actually need to move them forward

🎯 CONVERSATION PRIORITY MATRIX:
${response.debug.priorityMatrix.currentPriority}

🎯 THIS TELLS YOU:
• What to focus the conversation on
• What call-to-action to use in your ending
• What NOT to ask for (data you already have)
• How to be maximally helpful right now
`

    response.debug = {
      ...response.debug,
      enhancedPromptSections: {
        contextAwareness,
        priorityGuidance: {
          currentPriority: response.debug.priorityMatrix.currentPriority,
          shouldFocusOn: !context.userContext.hasSignature 
            ? "Getting them to sign via portal - they already have the info needed"
            : context.userContext.pendingRequirementTypes?.length > 0
            ? `Uploading specific documents: ${context.userContext.pendingRequirementTypes?.join(', ')}`
            : "Status updates or gathering satisfaction feedback",
          conversationEnding: !context.userContext.hasSignature 
            ? "Ready to get started with the 2-minute signup?"
            : context.userContext.pendingRequirementTypes?.length > 0
            ? `Ready to upload those ${context.userContext.pendingRequirementTypes?.join(', ')}?`
            : "Want to check your current claim status?"
        }
      }
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
    
  } catch (error: any) {
    console.error('🧪 [DEBUG] Error testing user prompt:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

/**
 * POST endpoint to test with custom parameters
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId = 2064, message = 'Do you need anything from me?', phoneNumber } = body
    
    // Safe URL construction with fallback
    try {
      const url = request.nextUrl ? new URL(request.nextUrl.href) : new URL('http://localhost:3000')
      url.searchParams.set('userId', userId.toString())
      url.searchParams.set('message', message)
      
      return GET(new NextRequest(url.toString()))
    } catch (urlError) {
      console.warn(`⚠️ [API] URL construction failed:`, urlError)
      return GET(new NextRequest(`http://localhost:3000?userId=${userId}&message=${encodeURIComponent(message)}`))
    }
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
