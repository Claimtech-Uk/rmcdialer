// =============================================================================
// SMS Follow-ups Policy Layer
// =============================================================================
// Eligibility checks and cancellation rules for each follow-up type

import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import type { 
  FollowUpPolicyMap, 
  EligibilityContext, 
  CancelEvent 
} from '../types';

// -----------------------------------------------------------------------------
// Common Eligibility Checks (DB-only)
// -----------------------------------------------------------------------------

const checks = {
  /**
   * Check if user has active SMS conversation in last N minutes
   */
  async noActiveConversation(userId: number, withinMinutes: number = 60): Promise<boolean> {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);
    
    const activeConversation = await prisma.smsConversation.findFirst({
      where: {
        userId: BigInt(userId),
        status: 'active',
        lastMessageAt: {
          gte: cutoff
        }
      }
    });
    
    return !activeConversation;
  },

  /**
   * Check if user has signed (has signature file)
   */
  async signed(userId: number): Promise<boolean> {
    try {
      const user = await replicaDb.user.findUnique({
        where: { id: BigInt(userId) },
        select: { current_signature_file_id: true }
      });
      
      return !!(user?.current_signature_file_id);
    } catch (error) {
      console.error(`Error checking signature status for user ${userId}:`, error);
      return false; // Fail safe - don't send if we can't verify
    }
  },

  /**
   * Check if user has NOT signed
   */
  async notSigned(userId: number): Promise<boolean> {
    return !(await this.signed(userId));
  },

  /**
   * Check if communications are allowed (not DNC/STOP)
   */
  async commsAllowed(userId: number): Promise<boolean> {
    // Check for do_not_contact outcome
    const dncOutcome = await prisma.callOutcome.findFirst({
      where: {
        callSession: {
          userId: BigInt(userId)
        },
        outcomeType: 'do_not_contact'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return !dncOutcome;
  },

  /**
   * Check if within quiet hours (9am-8pm UK time)
   */
  async quietHoursOk(): Promise<boolean> {
    const now = new Date();
    const ukTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
    const hour = ukTime.getHours();
    
    return hour >= 9 && hour < 20;
  },

  /**
   * Check review throttle (respect AI_SMS_REVIEW_THROTTLE_SECONDS)
   */
  async reviewThrottleOk(userId: number): Promise<boolean> {
    const throttleSeconds = parseInt(process.env.AI_SMS_REVIEW_THROTTLE_SECONDS || '2592000'); // 30 days default
    const cutoff = new Date(Date.now() - throttleSeconds * 1000);
    
    const recentReview = await prisma.smsMessage.findFirst({
      where: {
        conversation: {
          userId: BigInt(userId)
        },
        messageType: 'review_request',
        sentAt: {
          gte: cutoff
        }
      }
    });
    
    return !recentReview;
  },

  /**
   * Check if callback is still pending
   */
  async callbackPending(callbackId?: string): Promise<boolean> {
    if (!callbackId) return false;
    
    const callback = await prisma.callback.findUnique({
      where: { id: callbackId },
      select: { status: true }
    });
    
    return callback?.status === 'pending';
  },

  /**
   * Check if last outcome was no_answer and no inbound SMS since
   */
  async lastOutcomeIsNoAnswer(userId: number): Promise<boolean> {
    const lastOutcome = await prisma.callOutcome.findFirst({
      where: {
        callSession: {
          userId: BigInt(userId)
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        outcomeType: true,
        createdAt: true
      }
    });

    if (lastOutcome?.outcomeType !== 'no_answer') {
      return false;
    }

    // Check no inbound SMS since that outcome
    const inboundSince = await prisma.smsMessage.findFirst({
      where: {
        conversation: {
          userId: BigInt(userId)
        },
        direction: 'inbound',
        receivedAt: {
          gte: lastOutcome.createdAt
        }
      }
    });

    return !inboundSince;
  },

  /**
   * Check if this is first no_answer for user (for "first time only" logic)
   */
  async firstNoAnswerOnly(userId: number): Promise<boolean> {
    const noAnswerCount = await prisma.callOutcome.count({
      where: {
        callSession: {
          userId: BigInt(userId)
        },
        outcomeType: 'no_answer'
      }
    });

    return noAnswerCount === 1; // Only send on the very first no_answer
  }
};

// -----------------------------------------------------------------------------
// Follow-up Type Policies
// -----------------------------------------------------------------------------

export const scheduledSmsPolicies: FollowUpPolicyMap = {
  no_answer_checkin: {
    isEligible: async ({ userId }: EligibilityContext) => {
      return await checks.noActiveConversation(userId, 60)
        && await checks.commsAllowed(userId)
        && await checks.quietHoursOk();
    },
    cancelOnEvents: ['inbound_sms'],
    description: 'Check-in SMS after first call attempt no answer, canceled if user texts back'
  },

  callback_confirmation: {
    isEligible: async ({ meta }: EligibilityContext) => {
      return await checks.callbackPending(meta?.callbackId)
        && await checks.commsAllowed(meta?.userId || 0)
        && await checks.quietHoursOk();
    },
    cancelOnEvents: ['callback_canceled', 'callback_completed'],
    description: 'Confirm callback scheduled, canceled if callback changes'
  },

  completion_reminder_evening: {
    isEligible: async ({ userId }: EligibilityContext) => {
      return await checks.notSigned(userId)
        && await checks.noActiveConversation(userId, 60)
        && await checks.commsAllowed(userId)
        && await checks.quietHoursOk();
    },
    cancelOnEvents: ['inbound_sms', 'user_signed'],
    description: 'Evening reminder to complete form, canceled if signed or active chat'
  },

  completion_reminder_plus_3d: {
    isEligible: async ({ userId }: EligibilityContext) => {
      return await checks.notSigned(userId)
        && await checks.noActiveConversation(userId, 60)
        && await checks.commsAllowed(userId)
        && await checks.quietHoursOk();
    },
    cancelOnEvents: ['inbound_sms', 'user_signed'],
    description: '3-day reminder to complete form, canceled if signed or active chat'
  },

  maybe_completion_evening: {
    isEligible: async ({ userId }: EligibilityContext) => {
      return await checks.notSigned(userId)
        && await checks.noActiveConversation(userId, 60)
        && await checks.commsAllowed(userId)
        && await checks.quietHoursOk();
    },
    cancelOnEvents: ['inbound_sms', 'user_signed'],
    description: 'Evening follow-up for maybe completion, canceled if signed or active chat'
  },

  maybe_completion_plus_5d: {
    isEligible: async ({ userId }: EligibilityContext) => {
      return await checks.notSigned(userId)
        && await checks.noActiveConversation(userId, 60)
        && await checks.commsAllowed(userId)
        && await checks.quietHoursOk();
    },
    cancelOnEvents: ['inbound_sms', 'user_signed'],
    description: '5-day follow-up for maybe completion, canceled if signed or active chat'
  },

  review_request: {
    isEligible: async ({ userId }: EligibilityContext) => {
      return await checks.signed(userId)
        && await checks.reviewThrottleOk(userId)
        && await checks.commsAllowed(userId)
        && await checks.quietHoursOk();
    },
    cancelOnEvents: [],
    description: 'Review request for signed users, respects throttle window'
  }
};

// -----------------------------------------------------------------------------
// Policy Utilities
// -----------------------------------------------------------------------------

export async function isEligibleToSend(
  followUpType: string,
  context: EligibilityContext
): Promise<{ eligible: boolean; reason?: string }> {
  const policy = scheduledSmsPolicies[followUpType as keyof typeof scheduledSmsPolicies];
  
  if (!policy) {
    return { eligible: false, reason: `Unknown follow-up type: ${followUpType}` };
  }

  try {
    const eligible = await policy.isEligible(context);
    return { eligible, reason: eligible ? undefined : 'Policy check failed' };
  } catch (error) {
    console.error(`Error checking eligibility for ${followUpType}:`, error);
    return { eligible: false, reason: `Policy check error: ${error}` };
  }
}

export function getCancelEvents(followUpType: string): CancelEvent[] {
  const policy = scheduledSmsPolicies[followUpType as keyof typeof scheduledSmsPolicies];
  return policy?.cancelOnEvents || [];
}
