import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Hash passwords
  const saltRounds = 12;
  
  // Common password for all development accounts
  const devPasswordHash = await bcryptjs.hash('password123', saltRounds);

  // Create admin account
  const admin = await prisma.agent.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      passwordHash: devPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      isAiAgent: false,
    },
  });

  // Create supervisor account
  const supervisor = await prisma.agent.upsert({
    where: { email: 'supervisor@test.com' },
    update: {},
    create: {
      email: 'supervisor@test.com',
      passwordHash: devPasswordHash,
      firstName: 'Supervisor',
      lastName: 'User',
      role: 'supervisor',
      isActive: true,
      isAiAgent: false,
    },
  });

  // Create agent account
  const agent = await prisma.agent.upsert({
    where: { email: 'agent@test.com' },
    update: {},
    create: {
      email: 'agent@test.com',
      passwordHash: devPasswordHash,
      firstName: 'Agent',
      lastName: 'User',
      role: 'agent',
      isActive: true,
      isAiAgent: false,
    },
  });

  // Create additional agent accounts for testing
  const agent2 = await prisma.agent.upsert({
    where: { email: 'agent2@test.com' },
    update: {},
    create: {
      email: 'agent2@test.com',
      passwordHash: devPasswordHash,
      firstName: 'Agent',
      lastName: 'Two',
      role: 'agent',
      isActive: true,
      isAiAgent: false,
    },
  });

  // Create sample user call scores for testing
  await prisma.userCallScore.upsert({
    where: { userId: BigInt(12345) },
    update: {},
    create: {
      userId: BigInt(12345),
      currentScore: 10,
      totalAttempts: 2,
      successfulCalls: 1,
      lastOutcome: 'contacted',
      baseScore: 5,
      outcomePenaltyScore: 5,
      timePenaltyScore: 0,
    },
  });

  await prisma.userCallScore.upsert({
    where: { userId: BigInt(67890) },
    update: {},
    create: {
      userId: BigInt(67890),
      currentScore: 25,
      totalAttempts: 5,
      successfulCalls: 0,
      lastOutcome: 'no_answer',
      baseScore: 10,
      outcomePenaltyScore: 15,
      timePenaltyScore: 0,
    },
  });

  // Create sample call queue entries
  await prisma.callQueue.create({
    data: {
      userId: BigInt(12345),
      claimId: BigInt(456),
      queueType: 'priority_call',
      priorityScore: 10,
      status: 'pending',
      queueReason: 'Pending document requirements',
    },
  });

  await prisma.callQueue.create({
    data: {
      userId: BigInt(67890),
      claimId: BigInt(789),
      queueType: 'follow_up',
      priorityScore: 25,
      status: 'pending',
      queueReason: 'Follow up on incomplete claim',
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('📋 Created development accounts (all use password: password123):');
  console.log(`   🔑 Admin: ${admin.email}`);
  console.log(`   🔑 Supervisor: ${supervisor.email}`);
  console.log(`   🔑 Agent: ${agent.email}`);
  console.log(`   🔑 Agent 2: ${agent2.email}`);
  console.log('📞 Created sample call queue entries');
  console.log('📊 Created sample user call scores');
  console.log('');
  console.log('🚀 Quick Login: Use the development buttons on the login page!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 