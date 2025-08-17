import { NextRequest, NextResponse } from 'next/server'
import { buildConversationalResponse } from '@/modules/ai-agents/core/conversational-response-builder'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('🧪 Testing updated FCA timeline knowledge...')
  
  try {
    // Safely extract search params with validation
    let message = 'How long will this take?'
    let userName = 'James'
    
    try {
      const searchParams = request.nextUrl?.searchParams || new URLSearchParams()
      message = searchParams.get('message') || 'How long will this take?'
      userName = searchParams.get('userName') || 'James'
    } catch (urlError) {
      console.warn(`⚠️ [API] URL parsing failed, using defaults:`, urlError)
    }
    
    console.log(`📝 Testing timeline question: "${message}" from user: "${userName}"`)
    
    const context = {
      userMessage: message,
      userName: userName,
      userStatus: 'unsigned',
      recentMessages: [],
      knowledgeContext: 'Motor finance claims with FCA timeline information'
    }

    const phoneNumber = '+447123456789'
    const startTime = Date.now()
    const response = await buildConversationalResponse(phoneNumber, context)
    const duration = Date.now() - startTime
    
    console.log('✅ Timeline response generated:', {
      messageCount: response.messages.length,
      duration: `${duration}ms`
    })
    
    // Log each message
    response.messages.forEach((msg, index) => {
      console.log(`Message ${index + 1}: "${msg}"`)
    })
    
    // Check if it mentions FCA pause and 2025/2026 timelines
    const responseText = response.messages.join(' ').toLowerCase()
    const hasFCAPause = responseText.includes('fca') || responseText.includes('december') || responseText.includes('dec')
    const has2026Timeline = responseText.includes('2026') || responseText.includes('early 2026')
    const hasCorrectTimeline = hasFCAPause || has2026Timeline
    const hasWrongTimeline = responseText.includes('3') && responseText.includes('month')
    
    const timelineCheck = {
      hasFCAPause,
      has2026Timeline,
      hasCorrectTimeline,
      hasWrongTimeline: hasWrongTimeline,
      isAccurate: hasCorrectTimeline && !hasWrongTimeline
    }
    
    console.log('🔍 Timeline Accuracy Check:', timelineCheck)
    
    return NextResponse.json({
      success: true,
      input: {
        message,
        userName
      },
      response: {
        messages: response.messages,
        conversationTone: response.conversationTone
      },
      timelineCheck,
      analysis: {
        responseText: responseText.substring(0, 200) + '...',
        expectedElements: [
          'FCA pause until December 2025',
          'Payments expected early 2026',
          'No incorrect 3-6 month timeline'
        ]
      },
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ Error testing timeline:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

