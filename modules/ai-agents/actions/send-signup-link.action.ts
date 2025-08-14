// Signup Link Action for Unknown Users
// Sends new users to the main signup page when they're not found in the system

import { SMSService } from '@/modules/communications/services/sms.service'
import { sendSmsAction } from './send-sms.action'
import { logger } from '@/modules/core'

export type SignupLinkActionResult = {
  success: boolean
  messageId?: string
  error?: string
  reasoning?: string
}

export type SignupLinkActionParams = {
  phoneNumber: string
  userName?: string
  customMessage?: string
  reasoning?: string
  fromE164?: string
}

/**
 * Sends signup link to users who are not found in the system
 * Directs them to claim.resolvemyclaim.co.uk to register
 */
export async function sendSignupLinkAction(
  smsService: SMSService,
  params: SignupLinkActionParams
): Promise<SignupLinkActionResult> {
  try {
    const signupUrl = 'https://claim.resolvemyclaim.co.uk'
    
    logger.info('AI SMS | 🔗 Sending signup link to new user', {
      phoneNumber: params.phoneNumber.substring(0, 8) + '***',
      userName: params.userName,
      reasoning: params.reasoning
    })

    // Craft intelligent message for new users
    const message = craftSignupMessage(params.userName, signupUrl)

    // Send the SMS using the standard action
    const result = await sendSmsAction(smsService, {
      phoneNumber: params.phoneNumber,
      text: message,
      fromE164: params.fromE164
    })

    logger.info('AI SMS | ✅ Signup link sent successfully', {
      messageId: result.messageId,
      phoneNumber: params.phoneNumber.substring(0, 8) + '***',
      signupUrl
    })

    return {
      success: true,
      messageId: result.messageId,
      reasoning: 'Signup link sent to new user for registration'
    }

  } catch (error) {
    logger.error('AI SMS | ❌ Failed to send signup link', {
      phoneNumber: params.phoneNumber.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send signup link',
      reasoning: 'Error sending signup link to new user'
    }
  }
}

/**
 * Craft an intelligent signup message for new users
 */
function craftSignupMessage(userName?: string, signupUrl?: string): string {
  const greeting = userName ? `Hi ${userName}` : 'Hi there'
  
  return `${greeting},

It doesn't look like you've signed up with us yet.

To start your motor finance claim, please visit:
${signupUrl}

Our team is here to help you get the compensation you deserve! 

Any questions? Just reply to this message.`
}
