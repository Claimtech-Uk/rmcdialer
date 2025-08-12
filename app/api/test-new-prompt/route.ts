import { NextRequest, NextResponse } from 'next/server'
import { buildConversationalResponse } from '@/modules/ai-agents/core/conversational-response-builder'

export async function GET(request: NextRequest) {
  console.log('🧪 Testing new 3-part conversational response structure...')
  
  try {
    const { searchParams } = new URL(request.url)
    const message = searchParams.get('message') || 'What are your fees?'
    const userName = searchParams.get('userName') || 'James'
    
    console.log(`📝 Testing with message: "${message}" from user: "${userName}"`)
    
    const context = {
      userMessage: message,
      userName: userName,
      userStatus: 'unsigned',
      recentMessages: [],
      knowledgeContext: 'Motor finance claims specialist'
    }

    const phoneNumber = '+447123456789' // Test phone number
    const startTime = Date.now()
    const response = await buildConversationalResponse(phoneNumber, context)
    const duration = Date.now() - startTime
    
    console.log('✅ Response generated:', {
      messageCount: response.messages.length,
      duration: `${duration}ms`,
      conversationTone: response.conversationTone
    })
    
    // Log each message
    response.messages.forEach((msg, index) => {
      console.log(`Message ${index + 1}: "${msg}"`)
    })
    
    // Structure validation
    const hasGreeting = response.messages[0]?.toLowerCase().includes('hi ')
    const hasThreeMessages = response.messages.length === 3
    const hasCallToAction = response.messages[response.messages.length - 1]?.includes('?')
    
    const structureCheck = {
      hasGreeting,
      hasThreeMessages,
      hasCallToAction,
      allValid: hasGreeting && hasThreeMessages && hasCallToAction
    }
    
    console.log('🔍 Structure Check:', structureCheck)
    
    return NextResponse.json({
      success: true,
      input: {
        message,
        userName,
        userStatus: 'unsigned'
      },
      response: {
        messages: response.messages,
        messageCount: response.messages.length,
        conversationTone: response.conversationTone
      },
      structureCheck,
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      },
      examples: {
        fees: `?message=What are your fees?&userName=James`,
        documents: `?message=What documents do you need?&userName=Sarah`,
        timeline: `?message=How long will this take?&userName=Alex`
      }
    })
    
  } catch (error) {
    console.error('❌ Error testing prompt:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  
  try {
    const context = {
      userMessage: body.message || 'What are your fees?',
      userName: body.userName || 'James',
      userStatus: body.userStatus || 'unsigned',
      recentMessages: body.recentMessages || [],
      knowledgeContext: body.knowledgeContext || 'Motor finance claims specialist'
    }

    const phoneNumber = body.phoneNumber || '+447123456789'
    const response = await buildConversationalResponse(phoneNumber, context)
    
    return NextResponse.json({
      success: true,
      response,
      structureCheck: {
        messageCount: response.messages.length,
        hasGreeting: response.messages[0]?.toLowerCase().includes('hi '),
        hasCallToAction: response.messages[response.messages.length - 1]?.includes('?')
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
