import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AuthService } from '@/modules/auth';

// Simple logger for this endpoint
const logger = {
  info: (message: string, meta?: any) => console.log(`[ForceOffline] ${message}`, meta),
  error: (message: string, error?: any) => console.error(`[ForceOffline ERROR] ${message}`, error),
  warn: (message: string, meta?: any) => console.warn(`[ForceOffline WARN] ${message}`, meta)
};

// Initialize auth service
const authService = new AuthService({ prisma, logger });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, reason = 'admin_forced_offline' } = body;

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Agent ID is required'
      }, { status: 400 });
    }

    console.log(`🔒 Admin forcing Agent ${agentId} offline - Reason: ${reason}`);

    // Check if agent exists and is active
    const agent = await prisma.agent.findUnique({
      where: { id: agentId, isActive: true }
    });

    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent not found or inactive'
      }, { status: 404 });
    }

    // Force the agent offline (true offline, not just break)
    await authService.logout(agentId, true); // forceOffline = true

    console.log(`✅ Agent ${agentId} forcefully set to offline`);

    return NextResponse.json({
      success: true,
      message: 'Agent forcefully set to offline',
      agentId,
      reason,
      status: 'offline',
      forcedOffline: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error forcing agent offline:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to force agent offline',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}