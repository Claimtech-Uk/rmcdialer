/**
 * Send Document Link Action
 * Sends a secure document upload link
 */

import { voiceDatabaseService } from '../services/voice-database.js'
import { voiceSMSService } from '../services/voice-sms.js'

export async function sendDocumentLinkAction(context, parameters) {
  const { callSid, from: phoneNumber } = context
  const { method, document_type } = parameters

  console.log('📎 [DOCUMENT-LINK] Sending document link:', {
    callSid,
    phoneNumber: voiceSMSService.maskPhoneNumber(phoneNumber),
    method,
    documentType: document_type
  })

  try {
    // 1. Find the user (required for secure document upload)
    let user = { found: false }
    try {
      user = await voiceDatabaseService.findUserByPhone(phoneNumber)
    } catch (error) {
      console.warn('⚠️ [DOCUMENT-LINK] Could not lookup user:', error.message)
    }

    // 2. Check if user exists (required for document upload)
    if (!user.found) {
      return {
        success: false,
        message: "I need to verify your account before I can send you a document upload link. Could you provide your claim reference number or contact us directly?",
        data: {
          user_found: false,
          suggested_action: 'verify_account',
          upload_url: null
        }
      }
    }

    // 3. Generate secure document upload link
    const uploadUrl = voiceSMSService.generatePortalLink(user.id, 'documents')
    
    // 4. Send via requested method
    let deliveryResult = { success: false, error: 'Method not supported' }
    
    if (method === 'sms') {
      deliveryResult = await voiceSMSService.sendDocumentLink(
        phoneNumber,
        user.firstName,
        uploadUrl,
        document_type || 'required documents'
      )
    } else if (method === 'email') {
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
      actionName: 'send_document_link',
      parameters: { method, document_type },
      result: {
        uploadUrl: uploadUrl,
        deliveryMethod: method,
        deliverySuccess: deliveryResult.success,
        messageId: deliveryResult.messageId,
        documentType: document_type
      }
    })

    // 6. Return appropriate response
    if (deliveryResult.success) {
      const docType = document_type || 'documents'
      
      const response = {
        success: true,
        message: `Perfect! I've sent you a secure link via ${method} to upload your ${docType}. The link will expire in 48 hours for security. Please upload your documents as soon as possible to avoid any delays.`,
        data: {
          upload_url: uploadUrl,
          delivery_method: method,
          message_id: deliveryResult.messageId,
          document_type: docType,
          customer_name: user.fullName,
          expires_in_hours: 48
        }
      }

      console.log('✅ [DOCUMENT-LINK] Successfully sent document link:', {
        userId: user.id,
        method,
        documentType: docType,
        messageId: deliveryResult.messageId
      })

      return response
    } else {
      return {
        success: false,
        message: `I generated your document upload link, but I couldn't send it via ${method} right now. Let me try a different approach or you can call back later.`,
        error: deliveryResult.error,
        data: {
          upload_url: uploadUrl, // Still provide URL for alternative delivery
          delivery_method: method,
          delivery_failed: true,
          document_type: document_type,
          customer_name: user.fullName
        }
      }
    }

  } catch (error) {
    console.error('❌ [DOCUMENT-LINK] Failed to send document link:', {
      error: error.message,
      callSid,
      phoneNumber: voiceSMSService.maskPhoneNumber(phoneNumber)
    })

    return {
      success: false,
      message: "I'm sorry, I couldn't generate your document upload link right now. Please try calling back or contact us directly for assistance.",
      error: error.message,
      data: {
        delivery_method: method,
        document_type: document_type,
        error_type: 'system_error'
      }
    }
  }
}
