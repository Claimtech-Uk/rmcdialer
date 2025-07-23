#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function recreateAgents() {
  console.log('🔧 Recreating essential agents...');

  const agents = [
    {
      email: 'agent@test.com',
      firstName: 'Standard',
      lastName: 'Agent',
      role: 'agent',
      description: 'Standard agent account'
    },
    {
      email: 'supervisor@test.com', 
      firstName: 'Team',
      lastName: 'Supervisor',
      role: 'supervisor',
      description: 'Team supervisor with analytics'
    },
    {
      email: 'admin@test.com',
      firstName: 'System',
      lastName: 'Administrator', 
      role: 'admin',
      description: 'Full system administrator'
    }
  ];

  // Default password for all agents
  const defaultPassword = 'password123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  console.log('📋 Creating agents with default password:', defaultPassword);

  for (const agent of agents) {
    try {
      // Check if agent already exists
      const existing = await prisma.agent.findUnique({
        where: { email: agent.email }
      });

      if (existing) {
        console.log(`✅ Agent ${agent.email} already exists (ID: ${existing.id})`);
        continue;
      }

      // Create new agent
      const newAgent = await prisma.agent.create({
        data: {
          email: agent.email,
          passwordHash,
          firstName: agent.firstName,
          lastName: agent.lastName,
          role: agent.role,
          isActive: true,
          isAiAgent: false
        }
      });

      console.log(`✅ Created ${agent.role}: ${agent.email} (ID: ${newAgent.id}) - ${agent.description}`);

    } catch (error) {
      console.error(`❌ Failed to create agent ${agent.email}:`, error);
    }
  }

  console.log('\n🎯 Agent recreation completed!');
  console.log('📝 Login credentials:');
  console.log('   Email: agent@test.com | supervisor@test.com | admin@test.com');
  console.log('   Password: password123');
  console.log('\n⚠️  Remember to change passwords in production!');
}

// Run the script
recreateAgents()
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 