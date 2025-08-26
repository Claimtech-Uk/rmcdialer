// =============================================================================
// Outcome Follow-up Scheduler Service
// =============================================================================
// Handles scheduling SMS follow-ups based on call outcomes
// Keeps call service clean and focused on call logic

import { ScheduledSmsService } from './scheduled-sms.service';

export interface OutcomeFollowupContext {
  userId: number;
  phoneNumber: string;
  sessionId: string;
  agentId: number;
  outcomeType: string;
  outcomeResult: any;
  userScore?: {
    totalAttempts: number;
  };
}

export class OutcomeFollowupScheduler {
  private scheduledSmsService: ScheduledSmsService;

  constructor() {
    this.scheduledSmsService = new ScheduledSmsService();
  }

  /**
   * Schedule appropriate SMS follow-ups based on call outcome
   */
  async scheduleFollowUps(context: OutcomeFollowupContext): Promise<void> {
    const { userId, phoneNumber, sessionId, agentId, outcomeType, outcomeResult, userScore } = context;

    try {
      switch (outcomeType) {
        case 'no_answer':
          await this.scheduleNoAnswerFollowUp({
            userId,
            phoneNumber,
            sessionId,
            agentId,
            userScore
          });
          break;

        case 'call_back':
          await this.scheduleCallbackConfirmation({
            userId,
            phoneNumber,
            sessionId,
            agentId,
            outcomeResult
          });
          break;

        case 'going_to_complete':
          await this.scheduleCompletionReminders({
            userId,
            phoneNumber,
            sessionId,
            agentId,
            outcomeType,
            reminderPattern: 'going_to_complete' // evening + 3 days
          });
          break;

        case 'might_complete':
          await this.scheduleCompletionReminders({
            userId,
            phoneNumber,
            sessionId,
            agentId,
            outcomeType,
            reminderPattern: 'might_complete' // evening + 5 days
          });
          break;

        default:
          // No SMS follow-ups for other outcome types
          break;
      }

      console.log(`📨 SMS follow-ups scheduled for outcome: ${outcomeType}, user: ${userId}`);

    } catch (error) {
      console.error(`❌ Failed to schedule SMS follow-ups for outcome ${outcomeType}:`, error);
      // Don't throw - we don't want to fail the call outcome if SMS scheduling fails
    }
  }

  // ---------------------------------------------------------------------------
  // Individual Follow-up Schedulers
  // ---------------------------------------------------------------------------

  private async scheduleNoAnswerFollowUp({
    userId,
    phoneNumber,
    sessionId,
    agentId,
    userScore
  }: {
    userId: number;
    phoneNumber: string;
    sessionId: string;
    agentId: number;
    userScore?: { totalAttempts: number };
  }): Promise<void> {
    // Only schedule SMS if this is the first call attempt AND outcome is no_answer
    const isFirstCallAttempt = userScore && userScore.totalAttempts === 1;
    
    if (isFirstCallAttempt) {
      const checkInTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      
      await this.scheduledSmsService.enqueue({
        userId,
        phoneNumber,
        followUpType: 'no_answer_checkin',
        messageType: 'no_answer_checkin',
        templateKey: 'no_answer_checkin',
        scheduledFor: checkInTime,
        origin: 'system',
        createdByAgentId: agentId,
        dedupKey: `u:${userId}:no_answer:first_call_attempt`,
        meta: {
          sessionId,
          outcomeType: 'no_answer',
          agentId,
          scheduledReason: 'first_call_attempt_no_answer',
          totalAttempts: userScore.totalAttempts,
          callAttemptNumber: 1
        }
      });

      console.log(`📨 Scheduled no_answer checkin SMS for user ${userId} (first call attempt) at ${checkInTime.toISOString()}`);
    } else {
      console.log(`⏭️ Skipping no_answer SMS for user ${userId} (not first call attempt, total attempts: ${userScore?.totalAttempts || 'unknown'})`);
    }
  }

  private async scheduleCallbackConfirmation({
    userId,
    phoneNumber,
    sessionId,
    agentId,
    outcomeResult
  }: {
    userId: number;
    phoneNumber: string;
    sessionId: string;
    agentId: number;
    outcomeResult: any;
  }): Promise<void> {
    // Schedule immediate callback confirmation
    if (outcomeResult.callbackDateTime) {
      await this.scheduledSmsService.enqueue({
        userId,
        phoneNumber,
        followUpType: 'callback_confirmation',
        messageType: 'callback_confirmation',
        templateKey: 'callback_confirmation',
        scheduledFor: new Date(), // Send immediately
        origin: 'system',
        createdByAgentId: agentId,
        dedupKey: `u:${userId}:callback:${sessionId}`,
        meta: {
          sessionId,
          outcomeType: 'call_back',
          agentId,
          callbackTime: outcomeResult.callbackDateTime,
          callbackId: outcomeResult.callbackId || 'pending'
        }
      });

      console.log(`📨 Scheduled callback confirmation SMS for user ${userId}`);
    }
  }

  private async scheduleCompletionReminders({
    userId,
    phoneNumber,
    sessionId,
    agentId,
    outcomeType,
    reminderPattern
  }: {
    userId: number;
    phoneNumber: string;
    sessionId: string;
    agentId: number;
    outcomeType: string;
    reminderPattern: 'going_to_complete' | 'might_complete';
  }): Promise<void> {
    const eveningToday = this.getEveningTime(new Date());
    
    // Different delays based on pattern
    const laterDays = reminderPattern === 'going_to_complete' ? 3 : 5;
    const laterReminder = this.getEveningTime(new Date(Date.now() + laterDays * 24 * 60 * 60 * 1000));

    // Different follow-up types based on pattern
    const eveningType = reminderPattern === 'going_to_complete' 
      ? 'completion_reminder_evening' 
      : 'maybe_completion_evening';
    const laterType = reminderPattern === 'going_to_complete'
      ? 'completion_reminder_plus_3d'
      : 'maybe_completion_plus_5d';

    await Promise.all([
      this.scheduledSmsService.enqueue({
        userId,
        phoneNumber,
        followUpType: eveningType,
        messageType: 'completion_reminder',
        templateKey: eveningType,
        scheduledFor: eveningToday,
        origin: 'system',
        createdByAgentId: agentId,
        dedupKey: `u:${userId}:${reminderPattern}:evening:${eveningToday.toISOString().split('T')[0]}`,
        meta: { sessionId, outcomeType, agentId, step: 'evening' }
      }),
      this.scheduledSmsService.enqueue({
        userId,
        phoneNumber,
        followUpType: laterType,
        messageType: 'completion_reminder',
        templateKey: laterType,
        scheduledFor: laterReminder,
        origin: 'system',
        createdByAgentId: agentId,
        dedupKey: `u:${userId}:${reminderPattern}:later:${laterReminder.toISOString().split('T')[0]}`,
        meta: { sessionId, outcomeType, agentId, step: `plus_${laterDays}_days` }
      })
    ]);

    console.log(`📨 Scheduled ${reminderPattern} reminders for user ${userId}: evening + ${laterDays} days`);
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Get evening time (7 PM UK time) for a given date
   */
  private getEveningTime(date: Date): Date {
    // Determine if we're in BST (summer) or GMT (winter)
    // UK uses BST from last Sunday in March to last Sunday in October
    const isCurrentlyBST = this.isInBST(date);
    const ukOffsetHours = isCurrentlyBST ? 1 : 0; // BST = UTC+1, GMT = UTC+0
    
    // Get today's date in UK timezone
    const ukDate = new Date(date.getTime() + (ukOffsetHours * 60 * 60 * 1000));
    
    // Set to 7 PM UK time (within quiet hours which end at 8 PM)
    const year = ukDate.getUTCFullYear();
    const month = ukDate.getUTCMonth();
    const day = ukDate.getUTCDate();
    
    // Create 7 PM UK time and convert back to UTC
    const ukEvening = new Date(Date.UTC(year, month, day, 19, 0, 0)); // 7 PM UK
    return new Date(ukEvening.getTime() - (ukOffsetHours * 60 * 60 * 1000)); // Convert to UTC
  }

  /**
   * Check if a date falls within British Summer Time
   * BST runs from last Sunday in March to last Sunday in October
   */
  private isInBST(date: Date): boolean {
    const year = date.getFullYear();
    
    // Get last Sunday in March
    const marchLastSunday = new Date(year, 2, 31); // March 31
    marchLastSunday.setDate(31 - marchLastSunday.getDay()); // Go back to Sunday
    
    // Get last Sunday in October
    const octoberLastSunday = new Date(year, 9, 31); // October 31
    octoberLastSunday.setDate(31 - octoberLastSunday.getDay()); // Go back to Sunday
    
    // Check if date is within BST period
    return date >= marchLastSunday && date < octoberLastSunday;
  }
}
