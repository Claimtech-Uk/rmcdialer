import { NextRequest, NextResponse } from 'next/server'
import { smsQueueService } from '@/modules/ai-agents/core/sms-queue.service'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing SMS Queue Service (direct - no background processor)...')
    
    const results = {
      queueServiceExists: !!smsQueueService,
      tests: {},
      timing: {}
    }
    
    const startTime = Date.now()
    
    // Test clear (to start clean)
    try {
      await smsQueueService.clearAll()
      results.tests.clearAll = 'success'
    } catch (error) {
      results.tests.clearAll = `failed: ${error.message}`
      return NextResponse.json({ success: false, results }, { status: 500 })
    }
    
    // Test enqueue
    try {
      const id = await smsQueueService.enqueue({
        phoneNumber: '447123456789',
        message: 'Debug test message',
        messageSid: 'DEBUG_SID_123',
        receivedAt: new Date()
      })
      results.tests.enqueue = { success: true, id }
    } catch (error) {
      results.tests.enqueue = `failed: ${error.message}`
      return NextResponse.json({ success: false, results }, { status: 500 })
    }
    
    // Test stats after enqueue
    try {
      const stats = await smsQueueService.getStats()
      results.tests.statsAfterEnqueue = { success: true, stats }
    } catch (error) {
      results.tests.statsAfterEnqueue = `failed: ${error.message}`
    }
    
    // Test dequeue
    try {
      const message = await smsQueueService.dequeue()
      results.tests.dequeue = { 
        success: true, 
        hasMessage: !!message,
        messageId: message?.id,
        phoneNumber: message?.phoneNumber
      }
      
      // If we got a message, mark it completed
      if (message) {
        await smsQueueService.markCompleted(message.id)
        results.tests.markCompleted = 'success'
      }
    } catch (error) {
      results.tests.dequeue = `failed: ${error.message}`
    }
    
    // Test stats after processing
    try {
      const finalStats = await smsQueueService.getStats()
      results.tests.finalStats = { success: true, stats: finalStats }
    } catch (error) {
      results.tests.finalStats = `failed: ${error.message}`
    }
    
    const endTime = Date.now()
    results.timing.totalMs = endTime - startTime
    
    return NextResponse.json({ 
      success: true,
      message: 'Queue service test completed',
      totalTimeMs: endTime - startTime,
      results 
    })
    
  } catch (error) {
    console.error('Queue debug failed:', error)
    return NextResponse.json({ 
      error: 'Queue debug failed', 
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
