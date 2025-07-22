import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    console.log('🧹 Starting cleanup of stuck call session and queue conflicts...');
    
    const results = {
      timestamp: new Date().toISOString(),
      userId: 5777,
      sessionId: 'call_1753175877063_5777',
      cleanupActions: [] as any[]
    };

    // 1. Clean up conflicting queue entries for user 5777
    console.log('🔧 Cleaning up queue conflicts for user 5777...');
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

    // 2. Try to clean up the invalid call session (if it exists)
    console.log('🔧 Attempting to clean up invalid call session...');
    try {
      // First, try to find and delete using raw SQL since the UUID is invalid
      const invalidSessionCleanup = await prisma.$executeRaw`
        DELETE FROM call_sessions 
        WHERE id = 'call_1753175877063_5777'
      `;

      results.cleanupActions.push({
        action: 'Invalid Call Session Cleanup',
        description: 'Removed invalid call session with malformed UUID',
        success: true,
        rowsAffected: invalidSessionCleanup
      });
    } catch (sessionError: any) {
      results.cleanupActions.push({
        action: 'Invalid Call Session Cleanup',
        description: 'Session not found or already cleaned',
        success: false,
        error: sessionError.message
      });
    }

    // 3. Clean up any agent sessions pointing to the invalid call session
    console.log('🔧 Cleaning up agent sessions...');
    const agentSessionCleanup = await prisma.$executeRaw`
      UPDATE agent_sessions 
      SET current_call_session_id = NULL, 
          status = 'available',
          last_activity = NOW()
      WHERE current_call_session_id = 'call_1753175877063_5777'
    `;

    results.cleanupActions.push({
      action: 'Agent Session Cleanup',
      description: 'Reset agent sessions pointing to invalid call session',
      success: true,
      rowsAffected: agentSessionCleanup
    });

    // 4. Verify cleanup was successful
    console.log('✅ Verifying cleanup...');
    const [remainingQueueEntries, agentConflicts] = await Promise.all([
      prisma.callQueue.count({
        where: {
          userId: BigInt(5777),
          status: { in: ['pending', 'assigned'] }
        }
      }),
      prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM agent_sessions 
        WHERE current_call_session_id = 'call_1753175877063_5777'
      `
    ]);

    results.cleanupActions.push({
      action: 'Verification',
      description: 'Verified cleanup completion',
      success: true,
      remainingQueueEntries,
      remainingAgentConflicts: (agentConflicts as any)[0]?.count || 0
    });

    console.log('🎉 Cleanup completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Stuck call session and queue conflicts cleaned up successfully',
      results,
      summary: {
        totalActions: results.cleanupActions.length,
        successfulActions: results.cleanupActions.filter(a => a.success).length,
        recommendation: 'User 5777 should now be able to start new calls without conflicts'
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