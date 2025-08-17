import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const results = { step: 'starting' }
    
    // Step 1: Just try to import
    results.step = 'importing'
    const { smsQueueService } = await import('@/modules/ai-agents/core/sms-queue.service')
    
    // Step 2: Check if it exists
    results.step = 'checking existence'
    if (!smsQueueService) {
      return NextResponse.json({ error: 'Queue service not found', results })
    }
    
    // Step 3: Try clearAll (simplest operation)
    results.step = 'testing clearAll'
    await smsQueueService.clearAll()
    
    results.step = 'completed'
    return NextResponse.json({ 
      success: true, 
      message: 'Minimal test passed',
      results 
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Minimal test failed', 
      details: error instanceof Error ? error.message : String(error),
      step: (error as any).step || 'unknown'
    }, { status: 500 })
  }
}

