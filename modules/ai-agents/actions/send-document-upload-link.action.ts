import { SMSService } from '@/modules/communications/services/sms.service'
import { MagicLinkService } from '@/modules/communications/services/magic-link.service'
import { sendPortalLinkAction, type PortalLinkActionParams, type PortalLinkActionResult } from './send-portal-link.action'

export type DocumentUploadLinkActionParams = {
  userId: number
  phoneNumber: string
  userName?: string
  linkType?: 'documentUpload' | 'statusUpdate' | 'claimPortal'
  customMessage?: string
  reasoning?: string
  fromE164?: string
}

export type DocumentUploadLinkActionResult = {
  success: boolean
  linkUrl?: string
  messageId?: string
  trackingId?: string
  error?: string
  reasoning?: string
}

/**
 * Send a secure link for users to upload required documents
 * For users with outstanding document requests (lower priority than signature)
 */
export async function sendDocumentUploadLinkAction(
  smsService: SMSService,
  params: DocumentUploadLinkActionParams,
  magicLinkService?: MagicLinkService
): Promise<DocumentUploadLinkActionResult> {
  try {
    // Use the existing portal link infrastructure for document uploads
    const portalParams: PortalLinkActionParams = {
      userId: params.userId,
      phoneNumber: params.phoneNumber,
      userName: params.userName,
      linkType: params.linkType || 'documentUpload', // Specifically for document submission
      customMessage: params.customMessage,
      reasoning: params.reasoning || 'User requested document upload access',
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
      reasoning: result.reasoning || 'Document upload link sent'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document upload link action failed',
      reasoning: 'Unexpected error in document upload link execution'
    }
  }
}
