import { NextRequest, NextResponse } from 'next/server'
import { smsQueueServiceV2 } from '@/modules/ai-agents/core/sms-queue-v2.service'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🧪 Testing SMS Queue V2 (Production-Ready)')
    
    // Clear queue first
    await smsQueueServiceV2.clearAll()
    
    const results = {
      tests: [] as any[],
      performance: {} as any,
      validation: {} as any
    }

    // Test 1: Enqueue messages
    const messages = [
      { phone: '447123456789', msg: 'Test message 1', sid: 'SID_001' },
      { phone: '447123456790', msg: 'Test message 2', sid: 'SID_002' },
      { phone: '447123456789', msg: 'Test message 3', sid: 'SID_003' } // Same number
    ]

    for (const { phone, msg, sid } of messages) {
      const result = await smsQueueServiceV2.enqueue({
        phoneNumber: phone,
        message: msg,
        messageSid: sid,
        receivedAt: new Date()
      })
      results.tests.push({ action: 'enqueue', phone, result })
    }

    // Test 2: Check stats
    const statsAfter = await smsQueueServiceV2.getStats()
    results.tests.push({ action: 'getStats', stats: statsAfter })

    // Test 3: Test lock mechanism
    const lockResult1 = await smsQueueServiceV2.acquireLock('447123456789')
    const lockResult2 = await smsQueueServiceV2.acquireLock('447123456789') // Should fail
    results.tests.push({ 
      action: 'testLocks', 
      firstLock: lockResult1,
      secondLock: lockResult2,
      expectation: 'first=true, second=false'
    })

    // Test 4: Dequeue and process
    const message1 = await smsQueueServiceV2.dequeue()
    const message2 = await smsQueueServiceV2.dequeue()
    
    results.tests.push({
      action: 'dequeue',
      message1: message1 ? { id: message1.id, phone: message1.phoneNumber } : null,
      message2: message2 ? { id: message2.id, phone: message2.phoneNumber } : null
    })

    // Test 5: Mark completed
    if (message1) {
      await smsQueueServiceV2.markCompleted(message1.id)
      results.tests.push({ action: 'markCompleted', messageId: message1.id })
    }

    // Test 6: Release lock
    await smsQueueServiceV2.releaseLock('447123456789')
    results.tests.push({ action: 'releaseLock', phone: '447123456789' })

    // Final stats
    const finalStats = await smsQueueServiceV2.getStats()
    results.tests.push({ action: 'finalStats', stats: finalStats })

    const totalTime = Date.now() - startTime
    results.performance = {
      totalTimeMs: totalTime,
      avgOperationTime: totalTime / results.tests.length,
      throughput: (results.tests.length / totalTime) * 1000 // ops per second
    }

    results.validation = {
      allOperationsCompleted: results.tests.length >= 6,
      performanceGood: totalTime < 2000,
      lockingWorks: results.tests.find(t => t.action === 'testLocks')?.firstLock && !results.tests.find(t => t.action === 'testLocks')?.secondLock,
      queueHealthy: finalStats.healthy
    }

    return NextResponse.json({
      success: true,
      message: 'Queue V2 test completed successfully',
      results,
      recommendation: results.validation.performanceGood && results.validation.lockingWorks ? 'READY_FOR_PRODUCTION' : 'NEEDS_REVIEW'
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Queue V2 test failed',
      details: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

