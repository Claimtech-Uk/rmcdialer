#!/usr/bin/env tsx

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAiAgentId() {
  console.log('🔧 Updating AI Agent ID to 999...');

  try {
    // First, check if ID 999 already exists
    const existingAgent999 = await prisma.agent.findUnique({
      where: { id: 999 }
    });

    if (existingAgent999) {
      if (existingAgent999.isAiAgent) {
        console.log('✅ AI Agent already has ID 999');
        return existingAgent999;
      } else {
        console.log('⚠️ Non-AI agent exists with ID 999, temporarily moving it...');
        // Move the existing agent to a higher ID
        const tempId = await getNextAvailableId();
        await prisma.agent.update({
          where: { id: 999 },
          data: { id: tempId }
        });
        console.log(`📦 Moved existing agent to ID ${tempId}`);
      }
    }

    // Find the current AI agent
    const currentAiAgent = await prisma.agent.findFirst({
      where: {
        isAiAgent: true,
        isActive: true
      }
    });

    if (!currentAiAgent) {
      console.error('❌ No AI agent found to update');
      return null;
    }

    console.log(`📍 Found AI agent with ID ${currentAiAgent.id}: ${currentAiAgent.email}`);

    // Begin transaction to update all related records
    const result = await prisma.$transaction(async (tx) => {
      // Update all call sessions that reference the old AI agent ID
      const updatedCallSessions = await tx.callSession.updateMany({
        where: { agentId: currentAiAgent.id },
        data: { agentId: 999 }
      });

      // Update all call outcomes that reference the old AI agent ID
      const updatedCallOutcomes = await tx.callOutcome.updateMany({
        where: { recordedByAgentId: currentAiAgent.id },
        data: { recordedByAgentId: 999 }
      });

      // Update all agent sessions that reference the old AI agent ID
      const updatedAgentSessions = await tx.agentSession.updateMany({
        where: { agentId: currentAiAgent.id },
        data: { agentId: 999 }
      });

      // Update all call queue assignments that reference the old AI agent ID
      const updatedCallQueues = await tx.callQueue.updateMany({
        where: { assignedToAgentId: currentAiAgent.id },
        data: { assignedToAgentId: 999 }
      });

      // Finally, update the agent itself
      const updatedAgent = await tx.agent.update({
        where: { id: currentAiAgent.id },
        data: { id: 999 }
      });

      return {
        agent: updatedAgent,
        stats: {
          callSessions: updatedCallSessions.count,
          callOutcomes: updatedCallOutcomes.count,
          agentSessions: updatedAgentSessions.count,
          callQueues: updatedCallQueues.count
        }
      };
    });

    console.log('✅ Successfully updated AI Agent ID to 999');
    console.log(`📧 Email: ${result.agent.email}`);
    console.log(`🤖 Name: ${result.agent.firstName} ${result.agent.lastName}`);
    console.log('📊 Updated related records:');
    console.log(`   • Call Sessions: ${result.stats.callSessions}`);
    console.log(`   • Call Outcomes: ${result.stats.callOutcomes}`);
    console.log(`   • Agent Sessions: ${result.stats.agentSessions}`);
    console.log(`   • Call Queue Assignments: ${result.stats.callQueues}`);

    return result.agent;

  } catch (error) {
    console.error('❌ Failed to update AI agent ID:', error);
    throw error;
  }
}

async function getNextAvailableId(): Promise<number> {
  // Find the highest agent ID and add 1000 to be safe
  const highestAgent = await prisma.agent.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true }
  });
  
  return (highestAgent?.id || 0) + 1000;
}

async function main() {
  try {
    await updateAiAgentId();
    console.log('\n🎉 AI Agent ID update completed successfully!');
  } catch (error) {
    console.error('Failed to update AI agent ID:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { updateAiAgentId }; 