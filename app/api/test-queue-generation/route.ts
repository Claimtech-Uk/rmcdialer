import { NextRequest, NextResponse } from 'next/server';
import { QueueGenerationService } from '@/modules/queue/services/queue-generation.service';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🧪 Testing automatic queue generation...');
    
    const queueService = new QueueGenerationService();
    
    // Get current queue status
    const beforeStatus = await queueService.getQueueStatus();
    console.log('📊 Before:', beforeStatus);
    
    // Generate fresh queues
    const results = await queueService.generateAllQueues();
    
    // Get updated queue status
    const afterStatus = await queueService.getQueueStatus();
    console.log('📊 After:', afterStatus);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: 'Queue generation test completed successfully',
      duration: `${duration}ms`,
      beforeStatus,
      afterStatus,
      results,
      summary: {
        totalQueuesGenerated: results.length,
        totalUsersAdded: results.reduce((sum, r) => sum + r.queuePopulated, 0),
        totalRemoved: results.reduce((sum, r) => sum + r.removed, 0)
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ Queue generation test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

// Also allow POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
} 