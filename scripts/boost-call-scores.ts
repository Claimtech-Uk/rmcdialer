/*
 * Boost current scores for early users
 * - Adds +50 to user_call_scores.current_score for users with user_id <= 3500
 * - Keeps queue tables in sync by incrementing priority_score for affected users
 *
 * Safety:
 * - Uses a single transaction
 * - Optional DRY_RUN via env var DRY_RUN=1
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const threshold = BigInt(3500);
  const incrementBy = 50;
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  console.log(`Boosting current scores by +${incrementBy} for users with id <= 3500`);
  if (dryRun) {
    console.log('Running in DRY_RUN mode – no changes will be written.');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update user_call_scores
    const scoreUpdate = dryRun
      ? await tx.userCallScore.count({ where: { userId: { lte: threshold } } })
      : (await tx.userCallScore.updateMany({
          where: { userId: { lte: threshold } },
          data: { currentScore: { increment: incrementBy }, updatedAt: new Date() }
        })).count;

    // Update monolithic call_queue
    const callQueueUpdate = dryRun
      ? await tx.callQueue.count({ where: { userId: { lte: threshold } } })
      : (await tx.callQueue.updateMany({
          where: { userId: { lte: threshold } },
          data: { priorityScore: { increment: incrementBy }, updatedAt: new Date() }
        })).count;

    // Update separated queues if present
    const unsignedQueueUpdate = dryRun
      ? await tx.unsignedUsersQueue.count({ where: { userId: { lte: threshold } } })
      : (await tx.unsignedUsersQueue.updateMany({
          where: { userId: { lte: threshold } },
          data: { priorityScore: { increment: incrementBy }, updatedAt: new Date() }
        })).count;

    const outstandingQueueUpdate = dryRun
      ? await tx.outstandingRequestsQueue.count({ where: { userId: { lte: threshold } } })
      : (await tx.outstandingRequestsQueue.updateMany({
          where: { userId: { lte: threshold } },
          data: { priorityScore: { increment: incrementBy }, updatedAt: new Date() }
        })).count;

    return {
      scoreUpdate,
      callQueueUpdate,
      unsignedQueueUpdate,
      outstandingQueueUpdate
    };
  });

  console.log(
    dryRun
      ? 'DRY_RUN counts:'
      : 'Applied increments successfully:'
  );
  console.table(result);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('Failed to boost scores:', err);
    await prisma.$disconnect();
    process.exit(1);
  });


