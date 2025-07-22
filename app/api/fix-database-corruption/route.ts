import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    console.log('🔧 Starting database corruption cleanup...');
    
    // 1. Get all valid agent IDs first
    const validAgentIds = await prisma.agent.findMany({ 
      select: { id: true } 
    }).then(agents => agents.map(a => a.id));
    
    console.log(`📊 Found ${validAgentIds.length} valid agents`);
    
    // 2. Clean up call sessions with invalid agent references
    console.log('📋 Step 1: Cleaning corrupted call sessions...');
    
    const deletedCorruptedSessions = await prisma.callSession.deleteMany({
      where: {
        agentId: {
          notIn: validAgentIds
        }
      }
    });
    
    console.log(`🗑️ Deleted ${deletedCorruptedSessions.count} corrupted call sessions`);
    
    // 3. Clean up agent sessions with invalid agent references
    console.log('📋 Step 2: Cleaning corrupted agent sessions...');
    
    const deletedCorruptedAgentSessions = await prisma.agentSession.deleteMany({
      where: {
        agentId: {
          notIn: validAgentIds
        }
      }
    });
    
    console.log(`🗑️ Deleted ${deletedCorruptedAgentSessions.count} corrupted agent sessions`);
    
    // 4. Ensure at least one valid agent exists
    console.log('📋 Step 3: Ensuring valid agent exists...');
    
    const agentCount = await prisma.agent.count();
    if (agentCount === 0) {
      const bcrypt = require('bcryptjs');
      const fallbackAgent = await prisma.agent.create({
        data: {
          email: 'system@rmcdialer.com',
          passwordHash: await bcrypt.hash('system123!', 12),
          firstName: 'System',
          lastName: 'Agent',
          role: 'agent',
          isActive: true,
          isAiAgent: false
        }
      });
      console.log(`✅ Created fallback agent ID: ${fallbackAgent.id}`);
    }
    
    // 5. Clean up call queue orphan records
    console.log('📋 Step 4: Cleaning orphaned queue records...');
    
    const updatedValidAgentIds = await prisma.agent.findMany({ 
      select: { id: true } 
    }).then(agents => agents.map(a => a.id));
    
    const deletedOrphanQueues = await prisma.callQueue.deleteMany({
      where: {
        AND: [
          { assignedToAgentId: { not: null } },
          { assignedToAgentId: { notIn: updatedValidAgentIds } }
        ]
      }
    });
    
    console.log(`🗑️ Deleted ${deletedOrphanQueues.count} orphaned queue records`);
    
    // 6. Get current state
    const finalCounts = {
      agents: await prisma.agent.count(),
      agentSessions: await prisma.agentSession.count(),
      callSessions: await prisma.callSession.count(),
      callQueues: await prisma.callQueue.count()
    };
    
    console.log('✅ Database cleanup completed:', finalCounts);
    
    return NextResponse.json({
      success: true,
      message: 'Database corruption cleanup completed',
      cleaned: {
        corruptedCallSessions: deletedCorruptedSessions.count,
        corruptedAgentSessions: deletedCorruptedAgentSessions.count,
        orphanedQueues: deletedOrphanQueues.count
      },
      finalCounts,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Database cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 