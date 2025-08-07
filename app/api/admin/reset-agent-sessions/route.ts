import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting agent session table reset...');
    
    // Get current stats before clearing
    const statsBefore = await prisma.agentSession.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    const totalBefore = await prisma.agentSession.count();
    
    console.log(`📊 Current agent sessions: ${totalBefore} total`);
    console.log('📊 Status breakdown:', statsBefore);
    
    // Clear ALL agent sessions (they're broken anyway)
    const deleteResult = await prisma.agentSession.deleteMany({});
    
    console.log(`✅ Cleared ${deleteResult.count} agent sessions`);
    
    // Verify table is empty
    const remainingCount = await prisma.agentSession.count();
    
    if (remainingCount > 0) {
      throw new Error(`Failed to clear all sessions. ${remainingCount} remaining.`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Agent sessions table successfully reset',
      result: {
        deletedCount: deleteResult.count,
        statsBefore: statsBefore,
        remainingCount: remainingCount,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error resetting agent sessions:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to reset agent sessions',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}