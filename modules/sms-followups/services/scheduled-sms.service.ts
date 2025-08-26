// =============================================================================
// Scheduled SMS Service
// =============================================================================
// Core service for enqueueing, processing, and canceling scheduled SMS follow-ups

import { prisma } from '@/lib/db';
import { SMSService } from '@/modules/communications';
import { UserService } from '@/modules/users';
import { logger } from '@/modules/core';
import { scheduledSmsPolicies, isEligibleToSend, getCancelEvents } from './scheduled-sms.policy';
import { generateMessage } from './scheduled-sms.templates';
import type {
  EnqueueSmsInput,
  ProcessDueOptions,
  ProcessDueResult,
  CancelByEventOptions,
  CancelByEventResult,
  FollowUpType,
  ScheduledSmsStatus,
  EligibilityContext
} from '../types';

export class ScheduledSmsService {
  private smsService: SMSService;
  private userService: UserService;

  constructor() {
    // Initialize dependencies
    const authForComms = {
      getCurrentAgent: async () => ({ id: 0, role: 'system' })
    };
    
    const userServiceAdapter = {
      async getUserData(userId: number) {
        const userService = new UserService();
        const context = await userService.getUserCallContext(userId);
        if (!context) {
          throw new Error(`User ${userId} not found`);
        }
        return {
          id: context.user.id,
          firstName: context.user.firstName || 'Unknown',
          lastName: context.user.lastName || 'User',
          email: context.user.email || '',
          phoneNumber: context.user.phoneNumber || ''
        };
      }
    };

    this.smsService = new SMSService({ 
      authService: authForComms,
      userService: userServiceAdapter
    });
    this.userService = new UserService();
  }

  // ---------------------------------------------------------------------------
  // Enqueue SMS
  // ---------------------------------------------------------------------------

  async enqueue(input: EnqueueSmsInput): Promise<string> {
    const {
      userId,
      phoneNumber,
      followUpType,
      messageType,
      templateKey,
      message,
      scheduledFor,
      origin = 'system',
      createdByAgentId,
      dedupKey,
      meta
    } = input;

    // Generate dedup key if not provided
    const finalDedupKey = dedupKey || this.generateDedupKey(userId, followUpType, scheduledFor);

    // NO LONGER ADJUSTING FOR QUIET HOURS - Messages go out at scheduled time
    // Quiet hours check happens at send-time in the policy eligibility checks

    try {
      const scheduledSms = await prisma.scheduledSms.create({
        data: {
          userId: BigInt(userId),
          phoneNumber,
          followUpType,
          messageType,
          templateKey,
          message,
          scheduledFor, // Using original scheduled time, not adjusted
          origin,
          createdByAgentId,
          dedupKey: finalDedupKey,
          meta: meta || {}
        }
      });

      logger.info('SMS followup scheduled', {
        id: scheduledSms.id,
        userId,
        followUpType,
        scheduledFor, // Logging original time
        origin,
        dedupKey: finalDedupKey
      });

      return scheduledSms.id;
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('dedup_key')) {
        logger.info('SMS followup already scheduled (dedup)', { userId, followUpType, dedupKey: finalDedupKey });
        return 'duplicate';
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Process Due Messages
  // ---------------------------------------------------------------------------

  async processDue(options: ProcessDueOptions = {}): Promise<ProcessDueResult> {
    const { limit = 50, dryRun = false } = options;
    
    const result: ProcessDueResult = {
      processed: 0,
      sent: 0,
      canceled: 0,
      failed: 0,
      errors: []
    };

    try {
      // Find due messages
      const dueMessages = await prisma.scheduledSms.findMany({
        where: {
          status: 'pending',
          scheduledFor: {
            lte: new Date()
          }
        },
        orderBy: {
          scheduledFor: 'asc'
        },
        take: limit
      });

      if (dueMessages.length === 0) {
        logger.info('No SMS follow-ups due for processing');
        return result;
      }

      logger.info(`Processing ${dueMessages.length} due SMS follow-ups`, { dryRun });

      // Process each message
      for (const msg of dueMessages) {
        result.processed++;

        try {
          // Atomically claim the message
          const claimed = await prisma.scheduledSms.updateMany({
            where: {
              id: msg.id,
              status: 'pending'
            },
            data: {
              status: 'processing',
              processingAt: new Date()
            }
          });

          if (claimed.count === 0) {
            // Another process claimed it
            continue;
          }

          if (dryRun) {
            logger.info('DRY RUN: Would process SMS', {
              id: msg.id,
              userId: msg.userId,
              followUpType: msg.followUpType,
              scheduledFor: msg.scheduledFor
            });
            continue;
          }

          // Run eligibility check
          const eligibilityContext: EligibilityContext = {
            userId: Number(msg.userId),
            phoneNumber: msg.phoneNumber,
            scheduledFor: msg.scheduledFor,
            followUpType: msg.followUpType as FollowUpType,
            meta: msg.meta as Record<string, any>
          };

          const { eligible, reason } = await isEligibleToSend(msg.followUpType, eligibilityContext);

          if (!eligible) {
            // Cancel with reason
            await prisma.scheduledSms.update({
              where: { id: msg.id },
              data: {
                status: 'canceled',
                canceledAt: new Date(),
                canceledByEvent: 'preflight_check',
                canceledReason: reason || 'Eligibility check failed'
              }
            });

            result.canceled++;
            logger.info('SMS follow-up canceled at send time', {
              id: msg.id,
              userId: msg.userId,
              followUpType: msg.followUpType,
              reason
            });
            continue;
          }

          // Generate final message
          let finalMessage = msg.message;
          if (msg.templateKey) {
            const userContext = await this.userService.getUserCallContext(Number(msg.userId));
            const templateContext = {
              userId: Number(msg.userId),
              firstName: userContext?.user.firstName || undefined,
              lastName: userContext?.user.lastName || undefined,
              phoneNumber: msg.phoneNumber,
              meta: msg.meta as Record<string, any>
            };

            const generated = await generateMessage(msg.templateKey, templateContext);
            finalMessage = generated.message;
          }

          if (!finalMessage) {
            throw new Error('No message content available');
          }

          // Send via SMS service
          const sendResult = await this.smsService.sendSMS({
            phoneNumber: msg.phoneNumber,
            message: finalMessage,
            messageType: msg.messageType as 'manual' | 'auto_response' | 'magic_link' | 'callback_confirmation' | 'review_request' | 'no_answer_checkin' | 'completion_reminder',
            userId: Number(msg.userId),
            agentId: msg.createdByAgentId || undefined
          });

          // Update as sent
          await prisma.scheduledSms.update({
            where: { id: msg.id },
            data: {
              status: 'sent',
              sentAt: new Date()
            }
          });

          result.sent++;
          logger.info('SMS follow-up sent successfully', {
            id: msg.id,
            userId: msg.userId,
            followUpType: msg.followUpType,
            twilioSid: sendResult.twilioSid
          });

        } catch (error: any) {
          // Mark as failed
          await prisma.scheduledSms.update({
            where: { id: msg.id },
            data: {
              status: 'failed',
              errorMessage: error.message
            }
          });

          result.failed++;
          result.errors.push(`${msg.id}: ${error.message}`);
          logger.error('SMS follow-up failed', {
            id: msg.id,
            userId: msg.userId,
            followUpType: msg.followUpType,
            error: error.message
          });
        }
      }

      return result;
    } catch (error: any) {
      logger.error('Error processing due SMS follow-ups', error);
      result.errors.push(`Processing error: ${error.message}`);
      return result;
    }
  }

  // ---------------------------------------------------------------------------
  // Cancel by Event
  // ---------------------------------------------------------------------------

  async cancelByEvent(options: CancelByEventOptions): Promise<CancelByEventResult> {
    const { userId, eventType, followUpTypes, reason, meta } = options;

    // Determine which follow-up types to cancel
    let typesToCancel: string[] = [];
    
    if (followUpTypes) {
      typesToCancel = followUpTypes;
    } else {
      // Cancel all types that listen to this event
      typesToCancel = Object.entries(scheduledSmsPolicies)
        .filter(([_, policy]) => policy.cancelOnEvents?.includes(eventType))
        .map(([type, _]) => type);
    }

    if (typesToCancel.length === 0) {
      return { canceled: 0, items: [] };
    }

    // Find and cancel matching items
    const itemsToCancel = await prisma.scheduledSms.findMany({
      where: {
        userId: BigInt(userId),
        status: 'pending',
        followUpType: {
          in: typesToCancel
        }
      },
      select: {
        id: true,
        followUpType: true,
        scheduledFor: true
      }
    });

    if (itemsToCancel.length === 0) {
      return { canceled: 0, items: [] };
    }

    // Cancel them
    const canceledCount = await prisma.scheduledSms.updateMany({
      where: {
        id: {
          in: itemsToCancel.map(item => item.id)
        }
      },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
        canceledByEvent: eventType,
        canceledReason: reason || `Canceled due to ${eventType}`,
        meta: meta ? { ...(meta as any), cancelMeta: meta } : undefined
      }
    });

    logger.info('SMS follow-ups canceled by event', {
      userId,
      eventType,
      canceled: canceledCount.count,
      types: typesToCancel
    });

    return {
      canceled: canceledCount.count,
      items: itemsToCancel.map(item => ({
        id: item.id,
        followUpType: item.followUpType as FollowUpType,
        scheduledFor: item.scheduledFor
      }))
    };
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private generateDedupKey(userId: number, followUpType: string, scheduledFor: Date): string {
    // Format: u:{userId}:{followUpType}:{date}
    const dateKey = scheduledFor.toISOString().split('T')[0]; // YYYY-MM-DD
    return `u:${userId}:${followUpType}:${dateKey}`;
  }

  private async adjustForQuietHours(scheduledFor: Date): Promise<Date> {
    // Simple approach: UK is UTC+0 (GMT) or UTC+1 (BST)
    const ukOffsetHours = 1; // BST offset
    
    // Convert scheduled time to UK timezone
    const ukTime = new Date(scheduledFor.getTime() + (ukOffsetHours * 60 * 60 * 1000));
    const hour = ukTime.getUTCHours();

    // If outside 9am-8pm UK time, move to next 9am
    if (hour < 9 || hour >= 20) {
      const ukDate = new Date(ukTime);
      
      if (hour >= 20) {
        // After 8pm, move to next day 9am
        ukDate.setUTCDate(ukDate.getUTCDate() + 1);
      }
      
      // Set to 9 AM UK time
      const year = ukDate.getUTCFullYear();
      const month = ukDate.getUTCMonth();
      const day = ukDate.getUTCDate();
      
      // Create 9 AM UK time and convert back to UTC
      const ukMorning = new Date(Date.UTC(year, month, day, 9, 0, 0));
      return new Date(ukMorning.getTime() - (ukOffsetHours * 60 * 60 * 1000));
    }

    return scheduledFor;
  }

  // ---------------------------------------------------------------------------
  // Query Utilities
  // ---------------------------------------------------------------------------

  async getPendingCount(userId?: number): Promise<number> {
    return await prisma.scheduledSms.count({
      where: {
        status: 'pending',
        ...(userId && { userId: BigInt(userId) })
      }
    });
  }

  async getScheduledItems(userId: number): Promise<any[]> {
    return await prisma.scheduledSms.findMany({
      where: {
        userId: BigInt(userId),
        status: {
          in: ['pending', 'processing']
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });
  }
}
