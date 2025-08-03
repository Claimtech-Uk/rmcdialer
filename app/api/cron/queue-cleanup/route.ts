// =============================================================================
// Queue Cleanup Cron Job
// =============================================================================
// Periodically cleans up old queue entries and maintains queue health

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createInboundCallQueueService } from '@/modules/call-queue/services/inbound-call-queue.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

export async function GET(request: NextRequest) {
  try {
    console.log('🧹 Starting queue cleanup cron job...');

    // Check if queue feature is enabled
    if (!INBOUND_CALL_FLAGS.ENHANCED_INBOUND_QUEUE) {
      return NextResponse.json({
        success: false,
        message: 'Queue system is not enabled'
      });
    }

    const queueService = createInboundCallQueueService(prisma);

    // Clean up completed and abandoned calls older than 24 hours
    const cleanupResult = await queueService.cleanupOldEntries(24);

    // Get current queue statistics
    const stats = await queueService.getQueueStats();

    // Check for any stuck calls (in queue for more than max wait time)
    const maxWaitTimeMinutes = INBOUND_CALL_FLAGS.MAX_QUEUE_WAIT_TIME / 60;
    const stuckCallsThreshold = new Date(Date.now() - INBOUND_CALL_FLAGS.MAX_QUEUE_WAIT_TIME * 1000);
    
    const stuckCalls = await prisma.inboundCallQueue.findMany({
      where: {
        status: { in: ['waiting', 'assigned'] },
        enteredQueueAt: { lt: stuckCallsThreshold },
        maxWaitReached: false
      }
    });

    // Mark stuck calls as reaching max wait time
    if (stuckCalls.length > 0) {
      await prisma.inboundCallQueue.updateMany({
        where: {
          id: { in: stuckCalls.map(call => call.id) }
        },
        data: {
          maxWaitReached: true,
          status: 'abandoned',
          abandonedAt: new Date()
        }
      });

      console.log(`⏰ Marked ${stuckCalls.length} calls as reaching max wait time`);
    }

    console.log(`✅ Queue cleanup completed`, {
      cleanedEntries: cleanupResult.cleanedCount,
      stuckCallsHandled: stuckCalls.length,
      currentQueueSize: stats.totalInQueue,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Queue cleanup completed successfully',
      result: {
        cleanedEntries: cleanupResult.cleanedCount,
        stuckCallsHandled: stuckCalls.length,
        currentStats: stats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Queue cleanup cron job failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Queue cleanup failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}