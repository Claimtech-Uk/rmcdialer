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

    // 🎯 SIMPLIFIED: Basic stale session cleanup
    const result = await heartbeatService.cleanupStaleSessions();

    const totalCleaned = result.cleaned;
    
    console.log(`✅ Simplified heartbeat cleanup completed`, {
      cleaned: result.cleaned,
      totalCleaned,
      timestamp: new Date().toISOString()
    });

    // Get updated stats after cleanup (simplified)
    const activeAgents = await heartbeatService.getActiveAgents();
    const stats = { active: activeAgents.length, total: activeAgents.length };

    return NextResponse.json({
      success: true,
      message: 'Enhanced heartbeat cleanup completed successfully',
      result: {
        cleaned: result.cleaned,
        totalCleaned,
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