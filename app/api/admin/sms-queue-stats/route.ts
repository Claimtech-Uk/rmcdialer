import { NextRequest, NextResponse } from 'next/server'
import { smsQueueService } from '@/modules/ai-agents/core/sms-queue.service'
import { isProcessorRunning } from '@/modules/ai-agents/core/queue-processor'

export async function GET(request: NextRequest) {
  try {
    // TODO: Add proper admin authentication when auth pattern is established
    // For now, this endpoint is unprotected like other admin endpoints
    // Consider implementing middleware-based auth in the future

    // Get queue statistics
    const stats = await smsQueueService.getStats()
    
    const response = {
      timestamp: new Date().toISOString(),
      queue: {
        depth: stats.queueDepth,
        processing: stats.processingCount,
        lockedNumbers: stats.lockedNumbers
      },
      processor: {
        running: isProcessorRunning()
      },
      health: {
        status: stats.queueDepth > 100 ? 'warning' : 'healthy',
        message: stats.queueDepth > 100 
          ? `High queue depth: ${stats.queueDepth} messages pending`
          : 'Queue operating normally'
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching SMS queue stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queue stats' },
      { status: 500 }
    )
  }
}

// Clear queue endpoint (use with extreme caution!)
export async function DELETE(request: NextRequest) {
  try {
    // TODO: Add proper admin authentication when auth pattern is established
    // WARNING: This endpoint can clear all queued messages - use with extreme caution!

    // Clear all queue data
    await smsQueueService.clearAll()

    return NextResponse.json({
      message: 'Queue cleared successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error clearing SMS queue:', error)
    return NextResponse.json(
      { error: 'Failed to clear queue' },
      { status: 500 }
    )
  }
}
