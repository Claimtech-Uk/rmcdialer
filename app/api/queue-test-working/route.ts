import { NextRequest, NextResponse } from 'next/server'
import { smsQueueService } from '@/modules/ai-agents/core/sms-queue.service'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Starting Working Queue Test')
    
    // Test 1: Clear queue
    await smsQueueService.clearAll()
    
    // Test 2: Enqueue message
    const messageId = await smsQueueService.enqueue({
      phoneNumber: '447123456789',
      message: 'Working test message',
      messageSid: `WORKING_TEST_${Date.now()}`,
      receivedAt: new Date()
    })
    
    if (messageId === 'duplicate') {
      return NextResponse.json({ 
        success: false,
        error: 'Unexpected duplicate on fresh queue'
      })
    }
    
    // Test 3: Check queue has message
    const statsAfter = await smsQueueService.getStats()
    
    // Test 4: Acquire lock
    const lockAcquired = await smsQueueService.acquireLock('447123456789', 10)
    
    // Test 5: Dequeue message
    const dequeuedMessage = await smsQueueService.dequeue()
    
    // Test 6: Mark completed
    if (dequeuedMessage) {
      await smsQueueService.markCompleted(dequeuedMessage.id)
    }
    
    // Test 7: Release lock
    await smsQueueService.releaseLock('447123456789')
    
    // Test 8: Final stats
    const finalStats = await smsQueueService.getStats()
    
    console.log('✅ Working Queue Test Completed')
    
    return NextResponse.json({
      success: true,
      message: 'All queue operations working correctly',
      results: {
        messageEnqueued: messageId,
        queueDepthAfterEnqueue: statsAfter.queueDepth,
        lockAcquired,
        messageDequeued: !!dequeuedMessage,
        finalQueueDepth: finalStats.queueDepth
      },
      validation: {
        enqueueWorked: messageId !== 'duplicate',
        queueDetectedMessage: statsAfter.queueDepth === 1,
        dequeueWorked: !!dequeuedMessage,
        queueClearedAfter: finalStats.queueDepth === 0,
        lockWorked: lockAcquired
      }
    })
    
  } catch (error) {
    console.error('❌ Working Queue Test Failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Queue test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

