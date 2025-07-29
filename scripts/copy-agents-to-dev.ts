#!/usr/bin/env tsx

/**
 * Copy Agents from Production to Development Database
 * 
 * This script copies only agent data from production to development
 * with standardized dev passwords for testing.
 * 
 * Usage: PROD_DATABASE_URL=your-prod-connection npm run copy-agents
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const DEV_PASSWORD_HASH = bcrypt.hashSync('devpass123', 10);

async function main() {
  console.log('🚀 Copying agents from production to development...\n');

  // Check environment variables
  if (!process.env.PROD_DATABASE_URL) {
    console.error('❌ PROD_DATABASE_URL environment variable required');
    console.log('   Example: PROD_DATABASE_URL=postgresql://... npm run copy-agents');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable required (dev database)');
    process.exit(1);
  }

  // Create database connections
  const prodPrisma = new PrismaClient({
    datasources: { db: { url: process.env.PROD_DATABASE_URL } }
  });

  const devPrisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  });

  try {
    // Get agents from production
    console.log('📋 Fetching agents from production...');
    const prodAgents = await prodPrisma.agent.findMany({
      select: {
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        team: true,
        allowedQueues: true,
        isActive: true,
        isAiAgent: true,
        twilioWorkerSid: true,
      }
    });

    console.log(`   Found ${prodAgents.length} agents in production`);

    // Clear existing dev agents
    console.log('🧹 Clearing existing dev agents...');
    await devPrisma.agent.deleteMany({});

    // Copy agents with dev passwords
    console.log('👥 Creating agents in development...');
    for (const agent of prodAgents) {
      await devPrisma.agent.create({
        data: {
          email: agent.email,
          passwordHash: DEV_PASSWORD_HASH,
          firstName: agent.firstName,
          lastName: agent.lastName,
          role: agent.role,
          team: agent.team,
          allowedQueues: agent.allowedQueues as any,
          isActive: agent.isActive,
          isAiAgent: agent.isAiAgent,
          twilioWorkerSid: agent.twilioWorkerSid
        }
      });
    }

    console.log(`\n🎉 Successfully copied ${prodAgents.length} agents!`);
    console.log('\n📝 Next steps:');
    console.log('   1. All agents now use password: devpass123');
    console.log('   2. Test login at your dev environment');
    console.log('   3. Watch cron jobs populate fresh queue data');
    console.log('\n✨ Your development environment now has a clean slate with real agents!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prodPrisma.$disconnect();
    await devPrisma.$disconnect();
  }
}

main(); 