import { prisma } from '@/lib/db';

type QueueType = 'unsigned_users' | 'outstanding_requests';

export interface ClaimedCallback {
  id: string;
  userId: bigint;
  queueType: QueueType;
  callbackReason?: string | null;
  preferredAgentId?: number | null;
  scheduledFor: Date;
}

export class CallbackService {
  private readonly defaultLeaseMs = 5 * 60 * 1000;

  async findAndAssignNextDue(agentId: number, queueType: QueueType): Promise<ClaimedCallback | null> {
    // Oldest due, preferred agent first
    const candidate = await prisma.callback.findFirst({
      where: {
        status: 'pending',
        queueType,
        scheduledFor: { lte: new Date() }
      },
      orderBy: [
        { preferredAgentId: 'desc' },
        { scheduledFor: 'asc' }
      ]
    });

    if (!candidate) return null;

    const leaseUntil = new Date(Date.now() + this.defaultLeaseMs);
    const claimed = await prisma.callback.updateMany({
      where: {
        id: candidate.id,
        status: 'pending',
        OR: [
          { assignedToAgentId: null },
          { leaseExpiresAt: { lt: new Date() } }
        ]
      },
      data: {
        status: 'assigned',
        assignedToAgentId: agentId,
        assignedAt: new Date(),
        leaseExpiresAt: leaseUntil,
        lastAttemptAt: new Date()
      }
    });

    if (claimed.count !== 1) return null;

    const cb = await prisma.callback.findUnique({ where: { id: candidate.id } });
    if (!cb) return null;
    return {
      id: cb.id,
      userId: cb.userId,
      queueType: cb.queueType as QueueType,
      callbackReason: cb.callbackReason ?? undefined,
      preferredAgentId: cb.preferredAgentId ?? undefined,
      scheduledFor: cb.scheduledFor
    };
  }

  async complete(callbackId: string, outcome: 'answered' | 'no_answer' | 'busy' | 'reschedule', options?: { rescheduleAt?: Date }): Promise<void> {
    const cb = await prisma.callback.findUnique({ where: { id: callbackId } });
    if (!cb) return;

    if (outcome === 'answered') {
      await prisma.callback.update({
        where: { id: callbackId },
        data: { status: 'completed', completedAt: new Date(), assignedToAgentId: null, leaseExpiresAt: null }
      });
      return;
    }

    if (outcome === 'reschedule' && options?.rescheduleAt) {
      await prisma.callback.update({
        where: { id: callbackId },
        data: {
          status: 'pending',
          scheduledFor: options.rescheduleAt,
          assignedToAgentId: null,
          assignedAt: null,
          leaseExpiresAt: null
        }
      });
      return;
    }

    // Fail with retry rule: attempt once after +15m, then push back to normal queue
    const nextRetry = (cb.retryCount ?? 0) + 1;
    if (nextRetry <= (cb.maxRetries ?? 1)) {
      await prisma.callback.update({
        where: { id: callbackId },
        data: {
          status: 'pending',
          scheduledFor: new Date(Date.now() + 15 * 60 * 1000),
          retryCount: nextRetry,
          assignedToAgentId: null,
          assignedAt: null,
          leaseExpiresAt: null
        }
      });
      return;
    }

    // Exhausted retries -> mark completed and push back to normal process
    await prisma.callback.update({
      where: { id: callbackId },
      data: { status: 'completed', completedAt: new Date(), assignedToAgentId: null, leaseExpiresAt: null }
    });

    await this.pushBackToRegularQueue(Number(cb.userId), (cb.queueType as QueueType) || 'outstanding_requests');
  }

  async skip(callbackId: string): Promise<void> {
    await prisma.callback.update({
      where: { id: callbackId },
      data: {
        status: 'pending',
        scheduledFor: new Date(Date.now() + 15 * 60 * 1000),
        assignedToAgentId: null,
        assignedAt: null,
        leaseExpiresAt: null
      }
    });
  }

  async releaseExpiredLeases(): Promise<number> {
    const res = await prisma.callback.updateMany({
      where: { status: 'assigned', leaseExpiresAt: { lt: new Date() } },
      data: { status: 'pending', assignedToAgentId: null, assignedAt: null, leaseExpiresAt: null }
    });
    return res.count;
  }

  private async pushBackToRegularQueue(userId: number, preferredQueue: QueueType): Promise<void> {
    // Minimal push-back: create a row in the appropriate separated queue tables if not present
    // We choose preferredQueue as provided by callback, but callers can override after validation
    if (preferredQueue === 'unsigned_users') {
      await prisma.unsignedUsersQueue.create({
        data: {
          userId: BigInt(userId),
          priorityScore: 0,
          queuePosition: 0,
          status: 'pending',
          availableFrom: new Date()
        } as any
      }).catch(() => {});
      return;
    }
    // outstanding_requests fallback
    await prisma.outstandingRequestsQueue.create({
      data: {
        userId: BigInt(userId),
        priorityScore: 0,
        queuePosition: 0,
        status: 'pending',
        availableFrom: new Date(),
        requirementTypes: []
      } as any
    }).catch(() => {});
  }
}


