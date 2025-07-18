import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Hash passwords
  const saltRounds = 12;
  
  // Create admin account
  const adminPasswordHash = await bcryptjs.hash('admin123', saltRounds);
  const admin = await prisma.agent.upsert({
    where: { email: 'admin@dialler.com' },
    update: {},
    create: {
      email: 'admin@dialler.com',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      isAiAgent: false,
    },
  });

  // Create supervisor account
  const supervisorPasswordHash = await bcryptjs.hash('supervisor123', saltRounds);
  const supervisor = await prisma.agent.upsert({
    where: { email: 'supervisor@dialler.com' },
    update: {},
    create: {
      email: 'supervisor@dialler.com',
      passwordHash: supervisorPasswordHash,
      firstName: 'Supervisor',
      lastName: 'User',
      role: 'supervisor',
      isActive: true,
      isAiAgent: false,
    },
  });

  // Create agent account
  const agentPasswordHash = await bcryptjs.hash('agent123', saltRounds);
  const agent = await prisma.agent.upsert({
    where: { email: 'agent1@dialler.com' },
    update: {},
    create: {
      email: 'agent1@dialler.com',
      passwordHash: agentPasswordHash,
      firstName: 'Agent',
      lastName: 'One',
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
  console.log('📋 Created accounts:');
  console.log(`   Admin: ${admin.email} / admin123`);
  console.log(`   Supervisor: ${supervisor.email} / supervisor123`);
  console.log(`   Agent: ${agent.email} / agent123`);
  console.log('📞 Created sample call queue entries');
  console.log('📊 Created sample user call scores');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 