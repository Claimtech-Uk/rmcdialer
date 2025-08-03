// =============================================================================
// Agent Session Cleanup Cron Job
// =============================================================================
// Cleans up abandoned agent sessions to prevent stuck states

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('🧹 Starting agent session cleanup...');

    const now = new Date();
    
    // Clean up sessions that are clearly abandoned (no activity for 2+ hours)
    const result = await prisma.agentSession.updateMany({
      where: {
        logoutAt: null, // Only active sessions
        status: { in: ['available', 'break'] }, // Don't touch on_call sessions
        lastActivity: {
          lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours old
        }
      },
      data: {
        status: 'offline',
        logoutAt: now,
        currentCallSessionId: null // Clear any stuck call references
      }
    });

    console.log(`✅ Session cleanup completed: ${result.count} sessions cleaned`);

    // Get current session statistics for monitoring
    const stats = await prisma.agentSession.groupBy({
      by: ['status'],
      where: { logoutAt: null },
      _count: { id: true }
    });

    const sessionStats = stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.id;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      message: 'Session cleanup completed successfully',
      result: {
        cleanedSessions: result.count,
        currentSessions: sessionStats,
        timestamp: now.toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Session cleanup failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Session cleanup failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}