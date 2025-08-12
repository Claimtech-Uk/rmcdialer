import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getQueueReason(score: number): string {
  if (score === 0) return 'New lead - Missing signature';
  if (score <= 5) return 'High priority - Missing signature';
  if (score <= 10) return 'Medium priority - Missing signature';
  return 'Aged lead - Missing signature';
}

async function main() {
  console.log('🔄 Resetting unsigned_users_queue from user_call_scores...');

  const start = Date.now();

  // Select eligible users first
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const users = await prisma.userCallScore.findMany({
    where: {
      currentQueueType: 'unsigned_users',
      isActive: true,
      OR: [{ nextCallAfter: null }, { nextCallAfter: { lte: new Date() } }],
      createdAt: { lte: twoHoursAgo }
    },
    orderBy: [{ currentScore: 'asc' }, { createdAt: 'desc' }],
    take: 200
  });

  // Clear existing queue
  const removed = (await (prisma as any).unsignedUsersQueue.deleteMany({})).count;

  // Prepare rows and bulk insert
  const now = new Date();
  const data = users.map((u, idx) => ({
    userId: u.userId,
    claimId: null,
    priorityScore: u.currentScore,
    queuePosition: idx + 1,
    status: 'pending',
    queueReason: getQueueReason(u.currentScore),
    signatureMissingSince: u.createdAt,
    signatureType: 'initial',
    availableFrom: u.nextCallAfter || now,
    createdAt: now,
    updatedAt: now
  }));

  const created = data.length
    ? (await (prisma as any).unsignedUsersQueue.createMany({ data, skipDuplicates: true })).count
    : 0;

  const duration = Date.now() - start;
  console.log(`✅ Reset complete. Removed ${removed}, populated ${created}. (${duration}ms)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌ Failed to reset unsigned queue:', err);
    await prisma.$disconnect();
    process.exit(1);
  });


