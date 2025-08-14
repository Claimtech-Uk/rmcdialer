import { SMSService } from '@/modules/communications/services/sms.service'
import { MagicLinkService } from '@/modules/communications/services/magic-link.service'
import { sendPortalLinkAction, type PortalLinkActionParams, type PortalLinkActionResult } from './send-portal-link.action'

export type CaseStatusLinkActionParams = {
  userId: number
  phoneNumber: string
  userName?: string
  linkType?: 'statusUpdate' | 'documentUpload' | 'claimPortal'
  customMessage?: string
  reasoning?: string
  fromE164?: string
}

export type CaseStatusLinkActionResult = {
  success: boolean
  linkUrl?: string
  messageId?: string
  trackingId?: string
  error?: string
  reasoning?: string
}

/**
 * Send a secure link for users to review their case status, documents, and next steps
 */
export async function sendCaseStatusLinkAction(
  smsService: SMSService,
  params: CaseStatusLinkActionParams,
  magicLinkService?: MagicLinkService
): Promise<CaseStatusLinkActionResult> {
  try {
    // Use the existing portal link infrastructure for case status review
    const portalParams: PortalLinkActionParams = {
      userId: params.userId,
      phoneNumber: params.phoneNumber,
      userName: params.userName,
      linkType: params.linkType || 'statusUpdate', // Status review with appropriate messaging
      customMessage: params.customMessage,
      reasoning: params.reasoning || 'User requested case status review',
      fromE164: params.fromE164
    }

    const result: PortalLinkActionResult = await sendPortalLinkAction(
      smsService,
      portalParams,
      magicLinkService
    )

    return {
      success: result.success,
      linkUrl: result.linkUrl,
      messageId: result.messageId,
      trackingId: result.trackingId,
      error: result.error,
      reasoning: result.reasoning || 'Case status link sent for review'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Case status link action failed',
      reasoning: 'Unexpected error in case status link execution'
    }
  }
}
