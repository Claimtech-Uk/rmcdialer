import { NextRequest, NextResponse } from 'next/server'
import { smsQueueService } from '@/modules/ai-agents/core/sms-queue.service'
import { processQueue } from '@/modules/ai-agents/core/queue-processor'

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Test endpoint disabled in production' }, { status: 403 })
  }
  
  try {
    console.log('🧪 Starting SMS Queue Test')
    
    // Clear queue before starting
    await smsQueueService.clearAll()
    
    const results = {
      cleared: true,
      test1_rapid: [] as string[],
      test2_multiple: [] as string[],
      test3_duplicate: { first: '', second: '' },
      stats_before: {} as any,
      stats_after: {} as any
    }
    
    // Test 1: Rapid fire messages from same number
    const testPhone = '447723495560'
    const messages = [
      'What is DCA?',
      'How much does it cost?',
      'Can I do this myself?',
      'What documents do I need?',
      'How long does it take?'
    ]
    
    for (let i = 0; i < messages.length; i++) {
      const queueId = await smsQueueService.enqueue({
        phoneNumber: testPhone,
        message: messages[i],
        messageSid: `TEST_SID_${i}_${Date.now()}`,
        receivedAt: new Date()
      })
      results.test1_rapid.push(`${messages[i]} => ${queueId}`)
    }
    
    // Test 2: Messages from multiple numbers
    const multipleNumbers = [
      { phone: '447700900001', message: 'Is this a scam?' },
      { phone: '447700900002', message: 'I need help with my claim' },
      { phone: '447700900003', message: 'What is motor finance?' }
    ]
    
    for (const { phone, message } of multipleNumbers) {
      const queueId = await smsQueueService.enqueue({
        phoneNumber: phone,
        message,
        messageSid: `TEST_SID_${phone}_${Date.now()}`,
        receivedAt: new Date()
      })
      results.test2_multiple.push(`${phone}: ${message} => ${queueId}`)
    }
    
    // Test 3: Duplicate message detection
    const duplicateSid = `DUPLICATE_TEST_SID_${Date.now()}`
    
    results.test3_duplicate.first = await smsQueueService.enqueue({
      phoneNumber: '447700900999',
      message: 'This is a duplicate test',
      messageSid: duplicateSid,
      receivedAt: new Date()
    })
    
    results.test3_duplicate.second = await smsQueueService.enqueue({
      phoneNumber: '447700900999',
      message: 'This is a duplicate test',
      messageSid: duplicateSid,
      receivedAt: new Date()
    })
    
    // Get stats before processing
    results.stats_before = await smsQueueService.getStats()
    
    // Process the queue with a mock handler
    let processedCount = 0
    await processQueue(async (message) => {
      console.log(`Processing: ${message.phoneNumber} - "${message.message}"`)
      processedCount++
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100))
    })
    
    // Get stats after processing
    results.stats_after = await smsQueueService.getStats()
    
    return NextResponse.json({
      success: true,
      processed: processedCount,
      results,
      summary: {
        duplicate_detection_working: results.test3_duplicate.second === 'duplicate',
        queue_cleared: results.stats_after.queueDepth === 0,
        all_processed: results.stats_after.processingCount === 0
      }
    })
    
  } catch (error) {
    console.error('Test failed:', error)
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}

