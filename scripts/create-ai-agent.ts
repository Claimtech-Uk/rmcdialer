#!/usr/bin/env tsx

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAiAgent() {
  console.log('🤖 Creating AI Agent for Hume voice calls...');

  const aiAgentData = {
    email: 'ai-agent@rmc-dialler.system',
    firstName: 'Hume',
    lastName: 'AI Agent',
    role: 'agent',
    team: 'ai',
    description: 'AI agent for automated call handling via Hume voice system'
  };

  // Generate a secure random password for the AI agent (won't be used for login)
  const securePassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
  const passwordHash = await bcrypt.hash(securePassword, 12);

  try {
    // Check if AI agent already exists
    const existing = await prisma.agent.findUnique({
      where: { email: aiAgentData.email }
    });

    if (existing) {
      if (existing.isAiAgent) {
        console.log(`✅ AI Agent already exists (ID: ${existing.id})`);
        console.log(`📧 Email: ${existing.email}`);
        console.log(`🤖 Type: AI Agent`);
        console.log(`🏷️  Team: ${existing.team}`);
        return existing;
      } else {
        // Update existing agent to be an AI agent
        const updatedAgent = await prisma.agent.update({
          where: { email: aiAgentData.email },
          data: {
            isAiAgent: true,
            team: aiAgentData.team,
            firstName: aiAgentData.firstName,
            lastName: aiAgentData.lastName,
            allowedQueues: JSON.stringify(["unsigned_users", "outstanding_requests", "ai_handled"])
          }
        });
        console.log(`🔄 Updated existing agent to AI Agent (ID: ${updatedAgent.id})`);
        return updatedAgent;
      }
    }

    // Create new AI agent
    const newAgent = await prisma.agent.create({
      data: {
        email: aiAgentData.email,
        passwordHash,
        firstName: aiAgentData.firstName,
        lastName: aiAgentData.lastName,
        role: aiAgentData.role,
        team: aiAgentData.team,
        allowedQueues: JSON.stringify(["unsigned_users", "outstanding_requests", "ai_handled"]),
        isActive: true,
        isAiAgent: true
      }
    });

    console.log(`✅ Created AI Agent: ${aiAgentData.email} (ID: ${newAgent.id})`);
    console.log(`🤖 Name: ${newAgent.firstName} ${newAgent.lastName}`);
    console.log(`🏷️  Team: ${newAgent.team}`);
    console.log(`🔧 Role: ${newAgent.role}`);
    console.log(`🎯 Purpose: ${aiAgentData.description}`);
    
    console.log('\n📋 Usage Instructions:');
    console.log('• This AI agent should be assigned to calls handled by Hume voice system');
    console.log('• Use this agent ID when calls are missed and handled by auto-response');
    console.log('• The agent provides clarity and tracking for AI-handled interactions');
    
    return newAgent;

  } catch (error) {
    console.error(`❌ Failed to create AI agent:`, error);
    throw error;
  }
}

async function main() {
  try {
    await createAiAgent();
    console.log('\n🎉 AI Agent setup completed successfully!');
  } catch (error) {
    console.error('Failed to create AI agent:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { createAiAgent }; 