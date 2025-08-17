import { NextRequest, NextResponse } from 'next/server'
import { SmsAgentService } from '@/modules/ai-agents/channels/sms/sms-agent.service'
import { SMSService } from '@/modules/communications'
import { clearAutomationHalt, isAutomationHalted } from '@/modules/ai-agents/core/memory.store'
import { prisma } from '@/lib/db'

// Test SMS AI pipeline locally
export async function POST(req: NextRequest) {
  try {
    const { message, fromPhone, clearHalt = false } = await req.json()
    
    if (!message || !fromPhone) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing message or fromPhone' 
      }, { status: 400 })
    }

    console.log('🧪 TEST AI SMS PIPELINE | Starting test', { message, fromPhone, clearHalt })

    // Step 1: Clear halt if requested
    if (clearHalt) {
      console.log('🧪 TEST | Clearing automation halt for', fromPhone)
      await clearAutomationHalt(fromPhone)
    }

    // Step 2: Check halt status
    const isHalted = await isAutomationHalted(fromPhone)
    console.log('🧪 TEST | Halt status:', { fromPhone, isHalted })

    if (isHalted) {
      return NextResponse.json({
        success: true,
        halted: true,
        message: 'Number is still halted - automation blocked',
        recommendation: 'Set clearHalt: true to clear the halt first'
      })
    }

    // Step 3: Initialize services
    const authService = {
      getCurrentAgent: async () => ({ id: 999, role: 'system' as const })
    }
    
    // Mock SMS service to avoid sending actual SMS
    const mockSmsService = {
      ...new SMSService({ authService }),
      sendSMS: async (options: any) => {
        console.log('🧪 TEST | MOCK SMS SEND:', {
          to: options.phoneNumber,
          message: options.message?.substring(0, 100) + (options.message?.length > 100 ? '...' : ''),
          type: options.messageType
        })
        return {
          messageId: 'test-msg-id',
          twilioSid: 'test-twilio-sid',
          status: 'mock_sent'
        }
      }
    }
    
    // Create mock magic link service
    const mockMagicLinkService = {
      generateMagicLink: () => 'https://example.com/test-link'
    }
    
    const smsAgentService = new SmsAgentService(
      mockSmsService as any,
      mockMagicLinkService as any
    )

    // Step 4: Simulate conversation history by temporarily inserting test data
    let testConversationId: string | null = null
    const cleanPhone = fromPhone.replace(/^\+/, '')
    
    if (clearHalt) {
      console.log('🧪 TEST | Creating test conversation history for context')
      
      // Create test conversation
      const testConversation = await prisma.smsConversation.create({
        data: {
          phoneNumber: cleanPhone,
          status: 'active',
          lastMessageAt: new Date(),
          userId: null // Test user - no actual user record
        }
      })
      testConversationId = testConversation.id
      
      // Insert the conversation history from the screenshot
      const conversationHistory = [
        { direction: 'outbound', body: 'claim.resolvemyclaim.co.uk/claims?mlid=MjA2NA%3D%3D\n\nClick to upload your ID, proof of address, or other required items. Questions? Just reply!', createdAt: new Date(Date.now() - 300000) },
        { direction: 'inbound', body: 'Do you have my money yet?', createdAt: new Date(Date.now() - 240000) },
        { direction: 'outbound', body: 'Hi James,\n\nI understand that you\'re eager to know about the status of your compensation. Unfortunately, due to FCA rules, lenders have until December 4, 2025, to respond. Most payments are expected from early 2026. We actively chase for quicker resolutions where possible, so rest assured that we\'re on top of it to help expedite your claim.\n\nIf there\'s anything else you\'d like to know or if you have specific agreements you\'d like us to investigate further, just let me know!', createdAt: new Date(Date.now() - 180000) },
        { direction: 'inbound', body: 'Fuck off!', createdAt: new Date(Date.now() - 120000) },
        { direction: 'outbound', body: 'Understood. I\'ll pause automated messages and arrange human follow-up.', createdAt: new Date(Date.now() - 60000) },
        { direction: 'inbound', body: 'Joking I miss you', createdAt: new Date(Date.now() - 30000) },
        { direction: 'inbound', body: 'Hey', createdAt: new Date(Date.now() - 10000) }
      ]
      
      // Insert messages in sequence
      for (const msg of conversationHistory) {
        await prisma.smsMessage.create({
          data: {
            conversationId: testConversationId,
            direction: msg.direction as 'inbound' | 'outbound',
            body: msg.body,
            twilioMessageSid: `test-${Date.now()}-${Math.random()}`,
            isAutoResponse: msg.direction === 'outbound',
            createdAt: msg.createdAt,
            receivedAt: msg.createdAt
          }
        })
      }
      
      console.log('🧪 TEST | Conversation history created with', conversationHistory.length, 'messages')
    }

    // Prepare input (simulate SMS webhook format)
    const input = {
      fromPhone: cleanPhone,
      message: message,
      userId: undefined, // Will be looked up
      channel: 'sms' as const,
      timestamp: new Date()
    }

    console.log('🧪 TEST | Processing with SMS Agent Service:', input)

    // Step 5: Call the AI agent
    const startTime = Date.now()
    const result = await smsAgentService.handleInbound(input)
    const processingTime = Date.now() - startTime
    
    // Step 6: Cleanup test data
    if (testConversationId) {
      console.log('🧪 TEST | Cleaning up test conversation data')
      await prisma.smsMessage.deleteMany({
        where: { conversationId: testConversationId }
      })
      await prisma.smsConversation.delete({
        where: { id: testConversationId }
      })
    }

    console.log('🧪 TEST | AI Response received:', {
      processingTime: `${processingTime}ms`,
      hasReply: !!result.reply,
      actionsCount: result.actions?.length || 0,
      actions: result.actions?.map(a => a.type) || []
    })

    // Step 7: Extract and format response
    const response = {
      success: true,
      halted: false,
      processingTime: `${processingTime}ms`,
      input: {
        message,
        fromPhone,
        cleanPhone: input.fromPhone
      },
      ai_response: {
        reply: result.reply?.text || null,
        actions: result.actions || [],
        metadata: {
          hasReply: !!result.reply,
          actionsCount: result.actions?.length || 0,
          actionTypes: result.actions?.map(a => a.type) || []
        }
      },
      raw_result: result
    }

    // Step 8: Log the formatted response
    console.log('🧪 TEST | Final formatted response:')
    console.log('  📱 Input Message:', message)
    console.log('  🤖 AI Reply:', result.reply?.text || '(no reply)')
    console.log('  ⚡ Actions:', result.actions?.map(a => a.type).join(', ') || 'none')
    console.log('  ⏱️  Processing Time:', `${processingTime}ms`)

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('🧪 TEST | Error in AI SMS pipeline:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

// GET endpoint for easy testing
export async function GET(req: NextRequest) {
  // Safely extract search params with validation
  let message = 'Hey'
  let fromPhone = '447723495560'
  let clearHalt = false
  
  try {
    const searchParams = req.nextUrl?.searchParams || new URLSearchParams()
    message = searchParams.get('message') || 'Hey'
    fromPhone = searchParams.get('fromPhone') || '447723495560'
    clearHalt = searchParams.get('clearHalt') === 'true'
  } catch (urlError) {
    console.warn(`⚠️ [API] URL parsing failed, using defaults:`, urlError)
  }

  // Redirect to POST with default params
  return POST(new NextRequest(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, fromPhone, clearHalt })
  }))
}
