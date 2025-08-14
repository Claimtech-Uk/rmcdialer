import { SMSService } from '@/modules/communications'
import { sendSmsAction } from './send-sms.action'

export type ReviewLinkActionParams = {
  phoneNumber: string
  userName?: string
  fromE164?: string
  userId?: number
}

export type ReviewLinkActionResult = {
  success: boolean
  messageId?: string
  reviewUrl: string
  error?: string
}

/**
 * Send a Trustpilot review link to satisfied customers
 */
export async function sendReviewLinkAction(
  smsService: SMSService, 
  params: ReviewLinkActionParams
): Promise<ReviewLinkActionResult> {
  try {
    const userName = params.userName || 'there'
    const reviewUrl = 'https://uk.trustpilot.com/review/resolvemyclaim.co.uk'
    const reviewMessage = `Hi ${userName}, we'd love your feedback! Please leave a review: ${reviewUrl}`

    const result = await sendSmsAction(smsService, {
      phoneNumber: params.phoneNumber,
      text: reviewMessage,
      fromE164: params.fromE164,
      userId: params.userId
    })

    return {
      success: true,
      messageId: result.messageId,
      reviewUrl
    }

  } catch (error) {
    return {
      success: false,
      reviewUrl: 'https://uk.trustpilot.com/review/resolvemyclaim.co.uk',
      error: error instanceof Error ? error.message : 'Failed to send Trustpilot review link'
    }
  }
}
