// Legacy magic link action - redirects to comprehensive portal link action
// Maintained for backward compatibility

import { sendPortalLinkAction, type PortalLinkActionParams } from './send-portal-link.action'
import { SMSService } from '@/modules/communications/services/sms.service'
import { MagicLinkService } from '@/modules/communications/services/magic-link.service'

/**
 * Legacy magic link sender - use sendPortalLinkAction for new implementations
 * @deprecated Use sendPortalLinkAction instead
 */
export async function sendMagicLinkAction(
  smsService: SMSService,
  args: {
    userId: number
    phoneNumber: string
    userName?: string
    linkType?: 'claimPortal' | 'documentUpload'
    fromE164?: string
  },
  magicLinkService?: MagicLinkService
) {
  // Redirect to comprehensive portal link action
  const params: PortalLinkActionParams = {
    userId: args.userId,
    phoneNumber: args.phoneNumber,
    userName: args.userName,
    linkType: args.linkType || 'claimPortal',
    reasoning: 'Legacy magic link action compatibility',
    fromE164: args.fromE164
  }
  
  return sendPortalLinkAction(smsService, params, magicLinkService)
}
