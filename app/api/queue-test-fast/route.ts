import { NextRequest, NextResponse } from 'next/server'
import { smsQueueService } from '@/modules/ai-agents/core/sms-queue.service'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🚀 Fast Queue Test Starting...')
    
    const results = {
      startTime: new Date().toISOString(),
      steps: [] as any[],
      timing: {} as any,
      success: false
    }
    
    // Step 1: Clear queue
    const step1Start = Date.now()
    await smsQueueService.clearAll()
    results.steps.push({
      step: 1,
      action: 'clearAll',
      duration: Date.now() - step1Start,
      status: 'success'
    })
    
    // Step 2: Test enqueue
    const step2Start = Date.now()
    const testMessage = {
      phoneNumber: '447123456789',
      message: 'Fast test message',
      messageSid: `FAST_TEST_${Date.now()}`,
      receivedAt: new Date()
    }
    const messageId = await smsQueueService.enqueue(testMessage)
    results.steps.push({
      step: 2,
      action: 'enqueue',
      duration: Date.now() - step2Start,
      status: messageId === 'duplicate' ? 'duplicate' : 'success',
      messageId
    })
    
    if (messageId === 'duplicate') {
      return NextResponse.json({
        ...results,
        error: 'Unexpected duplicate on fresh queue',
        totalDuration: Date.now() - startTime
      })
    }
    
    // Step 3: Check stats after enqueue
    const step3Start = Date.now()
    const statsAfter = await smsQueueService.getStats()
    results.steps.push({
      step: 3,
      action: 'getStats after enqueue',
      duration: Date.now() - step3Start,
      status: 'success',
      queueDepth: statsAfter.queueDepth
    })
    
    // Step 4: Test lock acquisition
    const step4Start = Date.now()
    const lockAcquired = await smsQueueService.acquireLock(testMessage.phoneNumber, 5)
    results.steps.push({
      step: 4,
      action: 'acquireLock',
      duration: Date.now() - step4Start,
      status: lockAcquired ? 'success' : 'failed',
      acquired: lockAcquired
    })
    
    // Step 5: Test dequeue
    const step5Start = Date.now()
    const dequeuedMessage = await smsQueueService.dequeue()
    results.steps.push({
      step: 5,
      action: 'dequeue',
      duration: Date.now() - step5Start,
      status: dequeuedMessage ? 'success' : 'no_message',
      hasMessage: !!dequeuedMessage,
      messageId: dequeuedMessage?.id
    })
    
    // Step 6: Mark completed if we got a message
    if (dequeuedMessage) {
      const step6Start = Date.now()
      await smsQueueService.markCompleted(dequeuedMessage.id)
      results.steps.push({
        step: 6,
        action: 'markCompleted',
        duration: Date.now() - step6Start,
        status: 'success'
      })
    }
    
    // Step 7: Release lock
    const step7Start = Date.now()
    await smsQueueService.releaseLock(testMessage.phoneNumber)
    results.steps.push({
      step: 7,
      action: 'releaseLock',
      duration: Date.now() - step7Start,
      status: 'success'
    })
    
    // Step 8: Final stats
    const step8Start = Date.now()
    const finalStats = await smsQueueService.getStats()
    results.steps.push({
      step: 8,
      action: 'getStats final',
      duration: Date.now() - step8Start,
      status: 'success',
      queueDepth: finalStats.queueDepth
    })
    
    const totalDuration = Date.now() - startTime
    results.timing = {
      totalDuration,
      avgStepDuration: totalDuration / results.steps.length,
      maxStepDuration: Math.max(...results.steps.map(s => s.duration))
    }
    results.success = true
    
    console.log(`✅ Fast Queue Test Completed in ${totalDuration}ms`)
    
    return NextResponse.json({
      success: true,
      message: `Queue test completed in ${totalDuration}ms`,
      ...results,
      validation: {
        allStepsSucceeded: results.steps.every(s => s.status === 'success'),
        queueClearedProperly: finalStats.queueDepth === 0,
        performanceGood: totalDuration < 1000
      }
    })
    
  } catch (error) {
    const totalDuration = Date.now() - startTime
    console.error('❌ Fast Queue Test Failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
      totalDuration,
      results
    }, { status: 500 })
  }
}

