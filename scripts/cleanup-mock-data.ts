import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupMockData() {
  console.log('🧹 Starting cleanup of all mock/test data...');

  try {
    // Delete call queue entries with test user IDs or test queue types
    console.log('📋 Cleaning up call queue entries...');
    const deletedQueueEntries = await prisma.callQueue.deleteMany({
      where: {
        OR: [
          { userId: { in: [BigInt(12345), BigInt(67890)] } },
          { queueType: { in: ['priority_call', 'follow_up'] } }
        ]
      }
    });
    console.log(`   Deleted ${deletedQueueEntries.count} call queue entries`);

    // Delete user call scores for test users
    console.log('📊 Cleaning up user call scores...');
    const deletedScores = await prisma.userCallScore.deleteMany({
      where: {
        userId: { in: [BigInt(12345), BigInt(67890)] }
      }
    });
    console.log(`   Deleted ${deletedScores.count} user call scores`);

    // Get test agent IDs first
    const testAgents = await prisma.agent.findMany({
      where: {
        email: { in: ['admin@test.com', 'supervisor@test.com', 'agent@test.com', 'agent2@test.com'] }
      },
      select: { id: true, email: true }
    });

    if (testAgents.length > 0) {
      const testAgentIds = testAgents.map((agent: { id: number; email: string }) => agent.id);
      console.log(`🔑 Found ${testAgents.length} test agents to clean up`);

      // Delete related data for test agents
      console.log('📞 Cleaning up call sessions...');
      const deletedCallSessions = await prisma.callSession.deleteMany({
        where: { agentId: { in: testAgentIds } }
      });
      console.log(`   Deleted ${deletedCallSessions.count} call sessions`);

      console.log('📝 Cleaning up call outcomes...');
      const deletedOutcomes = await prisma.callOutcome.deleteMany({
        where: { agentId: { in: testAgentIds } }
      });
      console.log(`   Deleted ${deletedOutcomes.count} call outcomes`);

      console.log('🔗 Cleaning up magic link activities...');
      const deletedMagicLinks = await prisma.magicLinkActivity.deleteMany({
        where: { agentId: { in: testAgentIds } }
      });
      console.log(`   Deleted ${deletedMagicLinks.count} magic link activities`);

      console.log('💬 Cleaning up SMS conversations...');
      const deletedSMSConversations = await prisma.smsConversation.deleteMany({
        where: { agentId: { in: testAgentIds } }
      });
      console.log(`   Deleted ${deletedSMSConversations.count} SMS conversations`);

      console.log('📅 Cleaning up callbacks...');
      const deletedCallbacks = await prisma.callback.deleteMany({
        where: { agentId: { in: testAgentIds } }
      });
      console.log(`   Deleted ${deletedCallbacks.count} callbacks`);

      console.log('🔐 Cleaning up agent sessions...');
      const deletedSessions = await prisma.agentSession.deleteMany({
        where: { agentId: { in: testAgentIds } }
      });
      console.log(`   Deleted ${deletedSessions.count} agent sessions`);

      // Finally delete the test agents
      console.log('👤 Cleaning up test agent accounts...');
      const deletedAgents = await prisma.agent.deleteMany({
        where: { id: { in: testAgentIds } }
      });
      console.log(`   Deleted ${deletedAgents.count} test agent accounts`);
    } else {
      console.log('👤 No test agents found');
    }

    // Clean up any remaining test data
    console.log('🧼 Cleaning up any additional test data...');
    
    // Delete any SMS messages with test phone numbers
    const deletedSMSMessages = await prisma.smsMessage.deleteMany({
      where: {
        OR: [
          { fromNumber: { contains: '+447700' } }, // Mock UK numbers
          { toNumber: { contains: '+447700' } }
        ]
      }
    });
    console.log(`   Deleted ${deletedSMSMessages.count} test SMS messages`);

    console.log('✅ Mock data cleanup completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Queue entries: ${deletedQueueEntries.count}`);
    console.log(`   - Call scores: ${deletedScores.count}`);
    console.log(`   - Test agents: ${testAgents.length}`);
    console.log(`   - SMS messages: ${deletedSMSMessages.count}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  cleanupMockData()
    .then(() => {
      console.log('🎉 Cleanup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupMockData }; 