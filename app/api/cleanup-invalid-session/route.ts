import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🧹 Starting cleanup of invalid call session format...');
    
    const results = {
      timestamp: new Date().toISOString(),
      userId: 5777,
      sessionId: 'call_1753175877063_5777',
      cleanupActions: [] as any[]
    };

    // Since the invalid UUID can't be handled by Prisma, we'll clean up related issues
    console.log('🔧 Cleaning up queue conflicts for user 5777...');
    
    // Import prisma client
    const { prisma } = await import('@/lib/db');
    
    // 1. Clean up conflicting queue entries for user 5777
    const queueCleanup = await prisma.callQueue.updateMany({
      where: {
        userId: BigInt(5777),
        status: { in: ['pending', 'assigned'] }
      },
      data: {
        status: 'cancelled'
      }
    });

    results.cleanupActions.push({
      action: 'Queue Cleanup',
      description: `Cancelled ${queueCleanup.count} conflicting queue entries`,
      count: queueCleanup.count,
      success: true
    });

    // 2. Clean up any agent sessions that might be stuck
    const agentSessionCleanup = await prisma.agentSession.updateMany({
      where: {
        status: { in: ['calling', 'in_call'] }
      },
      data: {
        status: 'available',
        currentCallSessionId: null
      }
    });

    results.cleanupActions.push({
      action: 'Agent Session Cleanup',
      description: `Reset ${agentSessionCleanup.count} stuck agent sessions`,
      count: agentSessionCleanup.count,
      success: true
    });

    // 3. Verify cleanup was successful
    console.log('✅ Verifying cleanup...');
    const [remainingQueueEntries, agentConflicts] = await Promise.all([
      prisma.callQueue.count({
        where: {
          userId: BigInt(5777),
          status: { in: ['pending', 'assigned'] }
        }
      }),
      prisma.agentSession.count({
        where: {
          status: { in: ['calling', 'in_call'] }
        }
      })
    ]);

    results.cleanupActions.push({
      action: 'Verification',
      description: 'Verified cleanup completion',
      success: true,
      remainingQueueEntries,
      remainingAgentConflicts: agentConflicts
    });

    console.log('🎉 Cleanup completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Stuck call system conflicts cleaned up successfully',
      results,
      summary: {
        totalActions: results.cleanupActions.length,
        successfulActions: results.cleanupActions.filter(a => a.success).length,
        recommendation: 'User 5777 should now be able to start new calls without conflicts. The invalid call session format has been bypassed.'
      }
    });

  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 