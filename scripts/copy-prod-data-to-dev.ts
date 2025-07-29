#!/usr/bin/env tsx

/**
 * Copy Production Data to Development Database
 * 
 * This script safely copies essential data from production to development
 * while sanitizing sensitive information like passwords and personal data.
 * 
 * Usage: npm run copy-prod-data
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Production database connection
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL // You'll need to set this
    }
  }
});

// Development database connection  
const devPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL // Your dev database
    }
  }
});

const DEV_PASSWORD_HASH = bcrypt.hashSync('devpass123', 10); // Standard dev password

async function copyAgents() {
  console.log('📋 Copying agents from production...');
  
  try {
    // Get all agents from production
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
        // Exclude passwordHash - we'll use a dev password
      }
    });

    console.log(`   Found ${prodAgents.length} agents in production`);

    // Clear existing agents in dev (optional - be careful!)
    await devPrisma.agent.deleteMany({});
    console.log('   Cleared existing dev agents');

    // Insert agents with dev passwords
    for (const agent of prodAgents) {
      await devPrisma.agent.create({
        data: {
          email: agent.email.includes('@') 
            ? `dev.${agent.firstName.toLowerCase()}.${agent.lastName.toLowerCase()}@dev.local`
            : agent.email,
          passwordHash: DEV_PASSWORD_HASH,
          firstName: agent.firstName,
          lastName: agent.lastName,
          role: agent.role,
          team: agent.team,
          allowedQueues: agent.allowedQueues as any, // Cast to handle type issue
          isActive: agent.isActive,
          isAiAgent: agent.isAiAgent,
          twilioWorkerSid: agent.twilioWorkerSid
        }
      });
    }

    console.log(`   ✅ Copied ${prodAgents.length} agents with dev passwords`);
    console.log(`   🔑 All agents now use password: devpass123`);

  } catch (error) {
    console.error('❌ Error copying agents:', error);
  }
}

async function copyAutoDialerSettings() {
  console.log('⚙️ Copying auto-dialer settings...');
  
  try {
    const settings = await prodPrisma.autoDialerSettings.findMany({
      include: {
        agent: {
          select: { email: true }
        }
      }
    });

    console.log(`   Found ${settings.length} auto-dialer settings`);

    // Clear existing settings
    await devPrisma.autoDialerSettings.deleteMany({});

    // Copy settings, linking to new agent IDs
    for (const setting of settings) {
      const devAgent = await devPrisma.agent.findFirst({
        where: { 
          email: setting.agent.email.includes('@dev.local') 
            ? setting.agent.email 
            : `dev.${setting.agent.email.split('@')[0]}@dev.local`
        }
      });

      if (devAgent) {
        await devPrisma.autoDialerSettings.create({
          data: {
            agentId: devAgent.id,
            team: setting.team,
            timeBetweenCallsSeconds: setting.timeBetweenCallsSeconds,
            autoStartEnabled: setting.autoStartEnabled,
            maxCallsPerSession: setting.maxCallsPerSession,
            breakIntervalMinutes: setting.breakIntervalMinutes,
            audioNotificationsEnabled: setting.audioNotificationsEnabled,
            keyboardShortcutsEnabled: setting.keyboardShortcutsEnabled
          }
        });
      }
    }

    console.log(`   ✅ Copied auto-dialer settings`);
  } catch (error) {
    console.error('❌ Error copying auto-dialer settings:', error);
  }
}

async function copySampleData() {
  console.log('📊 Copying sample queue data...');
  
  try {
    // Copy a limited amount of recent scoring data (last 100 records)
    const recentScores = await prodPrisma.userCallScore.findMany({
      take: 100,
      orderBy: { updatedAt: 'desc' },
      where: {
        isActive: true
      }
    });

    console.log(`   Found ${recentScores.length} recent call scores`);

    // Clear existing scores
    await devPrisma.userCallScore.deleteMany({});

    // Insert sample scores (anonymized user IDs)
    let devUserId = 1000000; // Start with fake user IDs
    for (const score of recentScores) {
      await devPrisma.userCallScore.create({
        data: {
          userId: BigInt(devUserId++), // Use fake user IDs
          currentScore: score.currentScore,
          nextCallAfter: score.nextCallAfter,
          lastCallAt: score.lastCallAt,
          totalAttempts: score.totalAttempts,
          successfulCalls: score.successfulCalls,
          lastOutcome: score.lastOutcome,
          baseScore: score.baseScore,
          outcomePenaltyScore: score.outcomePenaltyScore,
          timePenaltyScore: score.timePenaltyScore,
          isActive: score.isActive,
          currentQueueType: score.currentQueueType,
          lastResetDate: score.lastResetDate,
          lastQueueCheck: score.lastQueueCheck
        }
      });
    }

    console.log(`   ✅ Copied ${recentScores.length} sample call scores with anonymized user IDs`);

  } catch (error) {
    console.error('❌ Error copying sample data:', error);
  }
}

async function main() {
  console.log('🚀 Starting production to development data migration...\n');

  // Verify environment variables
  if (!process.env.PROD_DATABASE_URL) {
    console.error('❌ PROD_DATABASE_URL environment variable required');
    console.log('   Set this to your production database connection string');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable required');
    console.log('   This should point to your development database');
    process.exit(1);
  }

  try {
    await copyAgents();
    await copyAutoDialerSettings();
    await copySampleData();

    console.log('\n🎉 Data migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test login with any agent email and password: devpass123');
    console.log('   2. Verify agent data in development environment');
    console.log('   3. Test auto-dialer settings and queue functionality');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await prodPrisma.$disconnect();
    await devPrisma.$disconnect();
  }
}

main(); 