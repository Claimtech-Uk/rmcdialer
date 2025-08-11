import { MagicLinkService } from '@/modules/communications'
import type { MagicLinkType } from '@/modules/communications'

export async function sendMagicLinkAction(magicLinkService: MagicLinkService, args: { userId: number; phoneNumber: string; linkType: MagicLinkType }) {
  return await magicLinkService.sendMagicLink({
    userId: args.userId,
    linkType: args.linkType,
    deliveryMethod: 'sms',
    phoneNumber: args.phoneNumber
  })
}


