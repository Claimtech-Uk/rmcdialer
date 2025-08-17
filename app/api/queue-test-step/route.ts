import { NextRequest, NextResponse } from 'next/server'
import { smsQueueService } from '@/modules/ai-agents/core/sms-queue.service'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const step = searchParams.get('step') || '1'
  
  try {
    const results = { step, timestamp: new Date().toISOString() }
    
    switch (step) {
      case '1':
        await smsQueueService.clearAll()
        return NextResponse.json({ success: true, operation: 'clearAll', results })
        
      case '2':
        const id = await smsQueueService.enqueue({
          phoneNumber: '447123456789',
          message: 'Test message',
          messageSid: 'STEP_TEST_123',
          receivedAt: new Date()
        })
        return NextResponse.json({ success: true, operation: 'enqueue', messageId: id, results })
        
      case '3':
        const stats = await smsQueueService.getStats()
        return NextResponse.json({ success: true, operation: 'getStats', stats, results })
        
      case '4':
        const message = await smsQueueService.dequeue()
        return NextResponse.json({ 
          success: true, 
          operation: 'dequeue', 
          hasMessage: !!message,
          messageId: message?.id,
          results 
        })
        
      case '5':
        const locked = await smsQueueService.acquireLock('447123456789', 5)
        return NextResponse.json({ success: true, operation: 'acquireLock', acquired: locked, results })
        
      default:
        return NextResponse.json({ error: 'Invalid step. Use ?step=1,2,3,4,5' })
    }
    
  } catch (error) {
    return NextResponse.json({ 
      success: false,
      step,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

