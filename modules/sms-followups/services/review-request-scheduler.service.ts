// =============================================================================
// Review Request Scheduler Service
// =============================================================================
// Handles scheduling review requests for signed users

import { ScheduledSmsService } from './scheduled-sms.service';
import { UserService } from '@/modules/users';

export class ReviewRequestScheduler {
  private scheduledSmsService: ScheduledSmsService;
  private userService: UserService;

  constructor() {
    this.scheduledSmsService = new ScheduledSmsService();
    this.userService = new UserService();
  }

  /**
   * Schedule review request for a signed user
   * Triggers on: conversion creation or new user discovery (already signed)
   */
  async scheduleReviewRequest(userId: number, trigger: 'conversion' | 'new_user_signed'): Promise<void> {
    try {
      // Get user context for phone number and name
      const userContext = await this.userService.getUserCallContext(userId);
      if (!userContext?.user.phoneNumber) {
        console.log(`⚠️ No phone number for user ${userId}, skipping review SMS`);
        return;
      }

      const phoneNumber = userContext.user.phoneNumber;

      // Schedule for next morning at 9 AM UK time
      const nextMorning = this.getNextMorning();
      
      await this.scheduledSmsService.enqueue({
        userId,
        phoneNumber,
        followUpType: 'review_request',
        messageType: 'review_request',
        templateKey: 'review_request',
        scheduledFor: nextMorning,
        origin: 'system',
        dedupKey: `u:${userId}:review:day2`,
        meta: {
          trigger,
          scheduledReason: 'signed_user_review_request',
          scheduledFor: 'day_2_morning'
        }
      });

      console.log(`📨 Scheduled review request SMS for user ${userId} (${trigger}) at ${nextMorning.toISOString()}`);

    } catch (error) {
      console.error(`❌ Failed to schedule review request for user ${userId}:`, error);
      // Don't throw - we don't want to fail the main process if SMS scheduling fails
    }
  }

  /**
   * Get next morning at 9 AM UK time
   */
  private getNextMorning(): Date {
    // Simple approach: UK is UTC+0 (GMT) or UTC+1 (BST)
    const ukOffsetHours = 1; // BST offset
    
    // Get current date in UK timezone
    const now = new Date();
    const ukNow = new Date(now.getTime() + (ukOffsetHours * 60 * 60 * 1000));
    
    // Get tomorrow's date in UK timezone
    const tomorrow = new Date(ukNow);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
    // Set to 9 AM UK time
    const year = tomorrow.getUTCFullYear();
    const month = tomorrow.getUTCMonth();
    const day = tomorrow.getUTCDate();
    
    // Create 9 AM UK time and convert back to UTC
    const ukMorning = new Date(Date.UTC(year, month, day, 9, 0, 0)); // 9 AM UK
    return new Date(ukMorning.getTime() - (ukOffsetHours * 60 * 60 * 1000)); // Convert to UTC
  }
}
