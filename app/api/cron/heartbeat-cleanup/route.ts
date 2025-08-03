// =============================================================================
// Heartbeat Cleanup Cron Job
// =============================================================================
// Periodically cleans up expired agent heartbeats and marks agents offline

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAgentHeartbeatService } from '@/modules/agents/services/agent-heartbeat.service';
import { INBOUND_CALL_FLAGS } from '@/lib/config/features';

export async function GET(request: NextRequest) {
  try {
    console.log('🧹 Starting agent heartbeat cleanup cron job...');

    // Check if heartbeat feature is enabled
    if (!INBOUND_CALL_FLAGS.ENHANCED_AGENT_HEARTBEAT) {
      return NextResponse.json({
        success: false,
        message: 'Agent heartbeat feature is not enabled'
      });
    }

    const heartbeatService = createAgentHeartbeatService(prisma);

    // Cleanup expired heartbeats
    const result = await heartbeatService.cleanupExpiredHeartbeats();

    console.log(`✅ Heartbeat cleanup completed`, {
      expiredCount: result.expiredCount,
      timestamp: new Date().toISOString()
    });

    // Get updated stats after cleanup
    const stats = await heartbeatService.getHeartbeatStats();

    return NextResponse.json({
      success: true,
      message: 'Heartbeat cleanup completed successfully',
      result: {
        expiredAgentsCleanedUp: result.expiredCount,
        currentStats: stats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Heartbeat cleanup cron job failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Heartbeat cleanup failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}