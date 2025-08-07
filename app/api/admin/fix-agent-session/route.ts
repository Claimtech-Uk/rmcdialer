import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, status = 'available' } = body;

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Agent ID is required'
      }, { status: 400 });
    }

    console.log(`🔧 Fixing agent session for Agent ${agentId}...`);

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

    // Check for existing active session
    const existingSession = await prisma.agentSession.findFirst({
      where: {
        agentId,
        logoutAt: null
      }
    });

    if (existingSession) {
      // Update existing session
      const updatedSession = await prisma.agentSession.update({
        where: { id: existingSession.id },
        data: {
          status,
          lastActivity: new Date()
        }
      });

      console.log(`✅ Updated existing session for Agent ${agentId}`);
      return NextResponse.json({
        success: true,
        message: 'Existing session updated',
        sessionId: updatedSession.id,
        agentId,
        status,
        action: 'updated'
      });
    } else {
      // Create new active session
      const newSession = await prisma.agentSession.create({
        data: {
          agentId,
          status,
          loginAt: new Date(),
          lastActivity: new Date(),
          callsCompletedToday: 0,
          totalTalkTimeSeconds: 0
        }
      });

      console.log(`✅ Created new session for Agent ${agentId}`);
      return NextResponse.json({
        success: true,
        message: 'New session created',
        sessionId: newSession.id,
        agentId,
        status,
        action: 'created'
      });
    }

  } catch (error) {
    console.error('❌ Error fixing agent session:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fix agent session',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}