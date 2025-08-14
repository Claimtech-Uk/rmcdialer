import { SMSService } from '@/modules/communications/services/sms.service'
import { MissedCallService } from '@/modules/missed-calls/services/missed-call.service'
import { logger } from '@/modules/core'
import { prisma } from '@/lib/db'

export type ScheduleCallbackActionParams = {
  userId?: number
  phoneNumber: string
  userName?: string
  reason?: string
  requestedTime?: string // When user requested the callback (optional)
  fromE164?: string
}

export type ScheduleCallbackActionResult = {
  success: boolean
  missedCallId?: string
  error?: string
  reasoning?: string
}

/**
 * Schedule a callback by creating a missed call entry with reason "a.i sms agent callback"
 * This follows the same logic as the missed_calls table for priority callbacks
 */
export async function scheduleCallbackAction(
  smsService: SMSService,
  params: ScheduleCallbackActionParams
): Promise<ScheduleCallbackActionResult> {
  try {
    logger.info('AI SMS | 📞 Scheduling callback via missed call entry', {
      phoneNumber: params.phoneNumber.substring(0, 8) + '***',
      userId: params.userId,
      userName: params.userName,
      reason: params.reason
    })

    // Initialize missed call service
    const missedCallService = new MissedCallService({
      prisma,
      logger
    })

    // Create missed call entry with AI SMS agent reason
    // Note: We bypass the TypeScript interface constraint since the DB allows any string
    const missedCall = await missedCallService.createMissedCall({
      phoneNumber: params.phoneNumber,
      callerName: params.userName || undefined,
      userId: params.userId ? BigInt(params.userId) : undefined,
      reason: 'a.i sms agent callback' as any, // Override interface constraint
      twilioCallSid: undefined, // No Twilio call for AI-requested callbacks
      sessionId: undefined // No session for AI-requested callbacks
    })

    logger.info('AI SMS | ✅ Callback scheduled successfully via missed call', {
      missedCallId: missedCall.id,
      phoneNumber: params.phoneNumber.substring(0, 8) + '***',
      status: missedCall.status
    })

    return {
      success: true,
      missedCallId: missedCall.id,
      reasoning: `Callback scheduled - missed call entry created with ID ${missedCall.id}`
    }

  } catch (error) {
    logger.error('AI SMS | ❌ Failed to schedule callback', {
      phoneNumber: params.phoneNumber.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to schedule callback',
      reasoning: 'Error creating missed call entry for callback'
    }
  }
}
