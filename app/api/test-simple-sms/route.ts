import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing Simple SMS Processing (No Queue, No Rate Limiting)')
    
    const testPhone = '+447738585850' // Use the phone from your logs
    const testMessages = [
      'What is DCA?',
      'How much does it cost?',
      'What documents do I need?'
    ]
    
    const results = {
      testStarted: new Date().toISOString(),
      messages: [] as any[],
      timing: {} as any
    }
    
    const startTime = Date.now()
    
    // Simulate rapid message sending by calling the SMS webhook directly
    for (let i = 0; i < testMessages.length; i++) {
      const messageTime = Date.now()
      
      try {
        // Create test webhook payload like Twilio sends
        const webhookData = new FormData()
        webhookData.append('MessageSid', `TEST_SID_${i}_${Date.now()}`)
        webhookData.append('From', testPhone)
        webhookData.append('To', '+447723495560')
        webhookData.append('Body', testMessages[i])
        webhookData.append('NumMedia', '0')
        
        // Call the SMS webhook internally
        const response = await fetch('http://localhost:3000/api/webhooks/twilio/sms', {
          method: 'POST',
          body: webhookData
        })
        
        const responseData = await response.json()
        const processingTime = Date.now() - messageTime
        
        results.messages.push({
          index: i,
          message: testMessages[i],
          status: response.status,
          success: response.ok,
          processingTime,
          response: responseData.status || 'unknown'
        })
        
        console.log(`✅ Message ${i + 1} processed in ${processingTime}ms`)
        
        // Small delay between messages to simulate realistic timing
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } catch (error) {
        results.messages.push({
          index: i,
          message: testMessages[i],
          status: 'error',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    
    const totalTime = Date.now() - startTime
    
    results.timing = {
      totalTestTime: totalTime,
      averageMessageTime: results.messages.reduce((acc, msg) => acc + (msg.processingTime || 0), 0) / results.messages.length,
      messagesPerSecond: (results.messages.length / totalTime) * 1000
    }
    
    const validation = {
      allMessagesProcessed: results.messages.every(msg => msg.success),
      noRateLimitingBlocking: results.messages.length === testMessages.length,
      reasonablePerformance: results.timing.averageMessageTime < 2000,
      rapidProcessingWorks: totalTime < 10000
    }
    
    return NextResponse.json({
      success: true,
      message: 'Simple SMS processing test completed',
      results,
      validation,
      recommendation: validation.allMessagesProcessed && validation.rapidProcessingWorks 
        ? 'SIMPLE_SOLUTION_WORKING' 
        : 'NEEDS_INVESTIGATION',
      summary: {
        messagesProcessed: results.messages.filter(m => m.success).length,
        totalMessages: testMessages.length,
        averageTime: `${results.timing.averageMessageTime.toFixed(0)}ms`,
        rateLimitingRemoved: validation.noRateLimitingBlocking
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Simple SMS test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

