/**
 * Schedule Callback Action
 * Creates a missed call entry and sends SMS confirmation
 */

import { voiceDatabaseService } from '../services/voice-database.js'
import { voiceSMSService } from '../services/voice-sms.js'

export async function scheduleCallbackAction(context, parameters) {
  const { callSid, from: phoneNumber } = context
  const { preferred_time, reason } = parameters

  console.log('📅 [CALLBACK] Scheduling callback:', {
    callSid,
    phoneNumber: voiceSMSService.maskPhoneNumber(phoneNumber),
    preferredTime: preferred_time,
    reason
  })

  try {
    // 1. Try to find the user
    let user = { found: false }
    try {
      user = await voiceDatabaseService.findUserByPhone(phoneNumber)
    } catch (error) {
      console.warn('⚠️ [CALLBACK] Could not lookup user, proceeding without user context:', error.message)
    }

    // 2. Create missed call entry for callback scheduling
    const callbackData = {
      phoneNumber: phoneNumber,
      userId: user.found ? user.id : null,
      reason: reason || 'AI Voice Agent - Customer requested callback',
      requestedTime: preferred_time
    }

    const dbResult = await voiceDatabaseService.createMissedCall(callbackData)

    if (!dbResult.success) {
      throw new Error('Failed to create callback entry in database')
    }

    // 3. Send SMS confirmation
    const userName = user.found ? user.firstName : null
    const smsResult = await voiceSMSService.sendCallbackConfirmation(
      phoneNumber,
      userName, 
      preferred_time,
      reason
    )

    // 4. Log the action for audit
    await voiceDatabaseService.logVoiceAction({
      callSid,
      phoneNumber,
      userId: user.found ? user.id : null,
      actionName: 'schedule_callback',
      parameters: { preferred_time, reason },
      result: {
        missedCallId: dbResult.missedCallId,
        smsDelivered: smsResult.success,
        smsMessageId: smsResult.messageId
      }
    })

    // 5. Return success response
    const response = {
      success: true,
      message: `I've scheduled your callback for ${preferred_time}${smsResult.success ? ' and sent you an SMS confirmation' : ''}.`,
      data: {
        callback_id: dbResult.missedCallId,
        scheduled_time: preferred_time,
        sms_confirmation: smsResult.success,
        customer_name: userName
      }
    }

    console.log('✅ [CALLBACK] Successfully scheduled:', {
      callbackId: dbResult.missedCallId,
      smsConfirmation: smsResult.success,
      userFound: user.found
    })

    return response

  } catch (error) {
    console.error('❌ [CALLBACK] Failed to schedule callback:', {
      error: error.message,
      stack: error.stack,
      callSid,
      phoneNumber: voiceSMSService.maskPhoneNumber(phoneNumber)
    })

    return {
      success: false,
      message: "I'm sorry, I couldn't schedule your callback right now. Please try calling back or contact us directly.",
      error: error.message,
      data: {
        scheduled_time: preferred_time,
        error_type: 'system_error'
      }
    }
  }
}
