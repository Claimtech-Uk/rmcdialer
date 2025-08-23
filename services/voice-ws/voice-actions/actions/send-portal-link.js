/**
 * Send Portal Link Action
 * Generates secure portal link and sends via SMS or email
 */

import { voiceDatabaseService } from '../services/voice-database.js'
import { voiceSMSService } from '../services/voice-sms.js'

export async function sendPortalLinkAction(context, parameters) {
  const { callSid, from: phoneNumber } = context
  const { method, link_type } = parameters

  console.log('🔗 [PORTAL-LINK] Sending portal link:', {
    callSid,
    phoneNumber: voiceSMSService.maskPhoneNumber(phoneNumber),
    method,
    linkType: link_type
  })

  try {
    // 1. Find the user
    let user = { found: false }
    try {
      user = await voiceDatabaseService.findUserByPhone(phoneNumber)
    } catch (error) {
      console.warn('⚠️ [PORTAL-LINK] Could not lookup user:', error.message)
    }

    // 2. For voice calls, we need a user ID to generate secure links
    // If user not found, we might need to suggest they register first
    if (!user.found) {
      return {
        success: false,
        message: "I couldn't find your account in our system. You may need to register first or provide additional verification. Would you like me to help you with that?",
        data: {
          user_found: false,
          suggested_action: 'register_or_verify',
          portal_url: null
        }
      }
    }

    // 3. Generate secure portal link
    const linkTypeMap = {
      'claims': 'claims',
      'documents': 'documents', 
      'status': 'status',
      'upload': 'documents'
    }
    
    const portalLinkType = linkTypeMap[link_type] || 'claims'
    const portalUrl = voiceSMSService.generatePortalLink(user.id, portalLinkType)

    // 4. Send via requested method
    let deliveryResult = { success: false, error: 'Method not supported' }
    
    if (method === 'sms') {
      deliveryResult = await voiceSMSService.sendPortalLink(
        phoneNumber,
        user.firstName,
        portalUrl,
        null // Use default message
      )
    } else if (method === 'email') {
      // Email sending not implemented in voice service yet
      deliveryResult = {
        success: false,
        error: 'Email sending not available in voice service yet'
      }
    }

    // 5. Log the action
    await voiceDatabaseService.logVoiceAction({
      callSid,
      phoneNumber,
      userId: user.id,
      actionName: 'send_portal_link',
      parameters: { method, link_type },
      result: {
        portalUrl: portalUrl,
        deliveryMethod: method,
        deliverySuccess: deliveryResult.success,
        messageId: deliveryResult.messageId
      }
    })

    // 6. Return appropriate response
    if (deliveryResult.success) {
      const response = {
        success: true,
        message: `Perfect! I've sent you a secure portal link via ${method}. You should receive it shortly. The link will expire in 24 hours for security.`,
        data: {
          portal_url: portalUrl,
          delivery_method: method,
          message_id: deliveryResult.messageId,
          customer_name: user.fullName,
          expires_in_hours: 24
        }
      }

      console.log('✅ [PORTAL-LINK] Successfully sent:', {
        userId: user.id,
        method,
        messageId: deliveryResult.messageId
      })

      return response
    } else {
      return {
        success: false,
        message: `I generated your portal link, but I couldn't send it via ${method} right now. Let me try a different approach or you can call back later.`,
        error: deliveryResult.error,
        data: {
          portal_url: portalUrl, // Still provide the URL for potential alternative delivery
          delivery_method: method,
          delivery_failed: true,
          customer_name: user.fullName
        }
      }
    }

  } catch (error) {
    console.error('❌ [PORTAL-LINK] Failed to send portal link:', {
      error: error.message,
      stack: error.stack,
      callSid,
      phoneNumber: voiceSMSService.maskPhoneNumber(phoneNumber)
    })

    return {
      success: false,
      message: "I'm sorry, I couldn't generate your portal link right now. Please try calling back or contact us directly for assistance.",
      error: error.message,
      data: {
        delivery_method: method,
        error_type: 'system_error'
      }
    }
  }
}
