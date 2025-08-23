/**
 * Send Review Link Action
 * Sends a Trustpilot review link to satisfied customers
 */

import { voiceDatabaseService } from '../services/voice-database.js'
import { voiceSMSService } from '../services/voice-sms.js'

export async function sendReviewLinkAction(context, parameters) {
  const { callSid, from: phoneNumber } = context
  const { method } = parameters

  console.log('⭐ [REVIEW-LINK] Sending review link:', {
    callSid,
    phoneNumber: voiceSMSService.maskPhoneNumber(phoneNumber),
    method
  })

  try {
    // 1. Try to find the user for personalization
    let user = { found: false }
    try {
      user = await voiceDatabaseService.findUserByPhone(phoneNumber)
    } catch (error) {
      console.warn('⚠️ [REVIEW-LINK] Could not lookup user, proceeding without personalization:', error.message)
    }

    // 2. Send review link via requested method
    let deliveryResult = { success: false, error: 'Method not supported' }
    
    if (method === 'sms') {
      deliveryResult = await voiceSMSService.sendReviewLink(
        phoneNumber,
        user.found ? user.firstName : null
      )
    } else if (method === 'email') {
      deliveryResult = {
        success: false,
        error: 'Email sending not available in voice service yet'
      }
    }

    // 3. Log the action
    await voiceDatabaseService.logVoiceAction({
      callSid,
      phoneNumber,
      userId: user.found ? user.id : null,
      actionName: 'send_review_link',
      parameters: { method },
      result: {
        deliveryMethod: method,
        deliverySuccess: deliveryResult.success,
        messageId: deliveryResult.messageId,
        reviewUrl: 'https://uk.trustpilot.com/review/solvosolutions.co.uk'
      }
    })

    // 4. Return appropriate response
    if (deliveryResult.success) {
      const customerName = user.found ? user.firstName : null
      const greeting = customerName ? `, ${customerName}` : ''
      
      const response = {
        success: true,
        message: `Thank you${greeting}! I've sent you our Trustpilot review link via ${method}. Your feedback really helps other customers understand our service. We appreciate you taking the time to share your experience.`,
        data: {
          delivery_method: method,
          message_id: deliveryResult.messageId,
          review_url: 'https://uk.trustpilot.com/review/solvosolutions.co.uk',
          customer_name: user.found ? user.fullName : null
        }
      }

      console.log('✅ [REVIEW-LINK] Successfully sent review link:', {
        method,
        messageId: deliveryResult.messageId,
        userFound: user.found
      })

      return response
    } else {
      return {
        success: false,
        message: `I'm sorry, I couldn't send the review link via ${method} right now. You can always find us on Trustpilot by searching for 'Solve Solutions' if you'd like to leave a review.`,
        error: deliveryResult.error,
        data: {
          delivery_method: method,
          delivery_failed: true,
          review_url: 'https://uk.trustpilot.com/review/solvosolutions.co.uk'
        }
      }
    }

  } catch (error) {
    console.error('❌ [REVIEW-LINK] Failed to send review link:', {
      error: error.message,
      callSid,
      phoneNumber: voiceSMSService.maskPhoneNumber(phoneNumber)
    })

    return {
      success: false,
      message: "I'm having trouble sending the review link right now, but you can find us on Trustpilot by searching for 'Solve Solutions' if you'd like to leave feedback.",
      error: error.message,
      data: {
        delivery_method: method,
        error_type: 'system_error'
      }
    }
  }
}
