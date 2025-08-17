import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * SMS Batch Status Debug Endpoint
 * 
 * Provides visibility into SMS batch processing:
 * - Current batches and their status
 * - Messages waiting to be processed
 * - Processing statistics
 * - Manual batch trigger capability
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 SMS Batch Status Check');
    
    // Get batch statistics
    const [
      totalBatches,
      pendingBatches,
      processingBatches,
      completedBatches,
      failedBatches
    ] = await Promise.all([
      prisma.smsBatchStatus.count(),
      prisma.smsBatchStatus.count({ where: { processingStarted: false } }),
      prisma.smsBatchStatus.count({ where: { processingStarted: true, processingCompleted: false } }),
      prisma.smsBatchStatus.count({ where: { processingCompleted: true } }),
      prisma.smsBatchStatus.count({ where: { errorMessage: { not: null } } })
    ]);
    
    // Get recent batches
    const recentBatches = await prisma.smsBatchStatus.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    // Get messages by batch status
    const unbatchedMessages = await prisma.smsMessage.count({
      where: {
        direction: 'inbound',
        batchId: null
      }
    });
    
    const batchedUnprocessed = await prisma.smsMessage.count({
      where: {
        direction: 'inbound',
        batchId: { not: null },
        batchProcessed: false
      }
    });
    
    const batchedProcessed = await prisma.smsMessage.count({
      where: {
        direction: 'inbound',
        batchId: { not: null },
        batchProcessed: true
      }
    });
    
    // Get current batch window
    const currentBatchWindow = Math.floor(Date.now() / 15000);
    const currentBatchIds = await prisma.smsMessage.findMany({
      where: {
        batchId: {
          contains: `:${currentBatchWindow}`
        }
      },
      select: {
        batchId: true,
        phoneNumber: true,
        body: true,
        createdAt: true
      },
      take: 5
    });
    
    // Format response
    const response = {
      timestamp: new Date().toISOString(),
      currentBatchWindow: {
        windowId: currentBatchWindow,
        windowStart: new Date(currentBatchWindow * 15000).toISOString(),
        windowEnd: new Date((currentBatchWindow + 1) * 15000).toISOString(),
        activeBatches: currentBatchIds.length
      },
      statistics: {
        batches: {
          total: totalBatches,
          pending: pendingBatches,
          processing: processingBatches,
          completed: completedBatches,
          failed: failedBatches
        },
        messages: {
          unbatched: unbatchedMessages,
          batchedUnprocessed,
          batchedProcessed
        }
      },
      recentBatches: recentBatches.map(batch => ({
        batchId: batch.batchId,
        phoneNumber: batch.phoneNumber,
        messageCount: batch.messageCount,
        status: batch.processingCompleted ? 'completed' : 
                batch.processingStarted ? 'processing' : 'pending',
        createdAt: batch.createdAt,
        processingStartedAt: batch.processingStartedAt,
        processingCompletedAt: batch.processingCompletedAt,
        responseSent: batch.responseSent,
        error: batch.errorMessage
      })),
      currentWindowMessages: currentBatchIds.map(msg => ({
        batchId: msg.batchId,
        phone: msg.phoneNumber,
        preview: msg.body?.substring(0, 50),
        age: Math.floor((Date.now() - msg.createdAt.getTime()) / 1000) + 's'
      })),
      health: {
        isHealthy: pendingBatches < 10 && failedBatches === 0,
        warnings: []
      }
    };
    
    // Add health warnings
    if (pendingBatches > 10) {
      response.health.warnings.push(`⚠️ ${pendingBatches} batches pending - cron job may not be running`);
    }
    if (failedBatches > 0) {
      response.health.warnings.push(`❌ ${failedBatches} batches failed - check error logs`);
    }
    if (processingBatches > 5) {
      response.health.warnings.push(`⏳ ${processingBatches} batches stuck in processing`);
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Failed to get SMS batch status:', error);
    return NextResponse.json({
      error: 'Failed to get batch status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Manually trigger batch processing
 */
export async function POST(request: NextRequest) {
  try {
    const { batchId, phoneNumber } = await request.json();
    
    if (!batchId && !phoneNumber) {
      return NextResponse.json({
        error: 'Provide either batchId or phoneNumber'
      }, { status: 400 });
    }
    
    // Find batch to process
    let targetBatchId = batchId;
    
    if (!targetBatchId && phoneNumber) {
      // Find most recent batch for phone number
      const recentBatch = await prisma.smsBatchStatus.findFirst({
        where: {
          phoneNumber,
          processingCompleted: false
        },
        orderBy: { createdAt: 'desc' }
      });
      
      if (!recentBatch) {
        return NextResponse.json({
          error: 'No pending batches found for this phone number'
        }, { status: 404 });
      }
      
      targetBatchId = recentBatch.batchId;
    }
    
    // Reset batch for processing
    await prisma.smsBatchStatus.update({
      where: { batchId: targetBatchId },
      data: {
        processingStarted: false,
        processingStartedAt: null,
        errorMessage: null
      }
    });
    
    // Reset messages
    await prisma.smsMessage.updateMany({
      where: { batchId: targetBatchId },
      data: {
        batchProcessed: false,
        batchResponseSent: false
      }
    });
    
    // Trigger the cron job manually
    const cronResponse = await fetch(
      `${request.nextUrl.origin}/api/cron/process-sms-batches`,
      { method: 'GET' }
    );
    
    const cronResult = await cronResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'Batch processing triggered',
      batchId: targetBatchId,
      cronResult
    });
    
  } catch (error) {
    console.error('❌ Failed to trigger batch processing:', error);
    return NextResponse.json({
      error: 'Failed to trigger processing',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
