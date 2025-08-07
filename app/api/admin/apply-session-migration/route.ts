import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting enhanced agent session migration...');
    
    // Check current state
    const currentSessions = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM agent_sessions
    ` as any[];
    
    console.log(`📊 Current sessions in table: ${currentSessions[0]?.count || 0}`);
    
    // Since the table is empty, we can apply the schema changes directly
    // Step 1: Add endedAt column
    await prisma.$executeRaw`
      ALTER TABLE agent_sessions 
      ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP
    `;
    
    // Step 2: Create unique constraint for active sessions (one active session per agent)
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_active_agent_session 
      ON agent_sessions (agent_id) 
      WHERE logout_at IS NULL AND ended_at IS NULL
    `;
    
    // Step 3: Add cleanup index
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_cleanup 
      ON agent_sessions (status, ended_at)
    `;
    
    console.log('✅ Enhanced agent session migration completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Enhanced agent session migration applied successfully',
      changes: [
        'Added endedAt timestamp field for session termination tracking',
        'Added unique constraint to prevent multiple active sessions per agent',
        'Added cleanup performance index for efficient session management'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error applying session migration:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to apply session migration',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}