import { SMSService, MagicLinkService } from '@/modules/communications'
import { AgentRuntimeService, type AgentTurnInput, type AgentTurnOutput } from '../../core/agent-runtime.service'

export class SmsAgentService {
  constructor(
    private readonly smsService: SMSService,
    private readonly magicLinkService: MagicLinkService,
    private readonly runtime = new AgentRuntimeService()
  ) {}

  async handleInbound(input: Omit<AgentTurnInput, 'channel'> & { channel?: 'sms'; replyFromE164?: string }): Promise<AgentTurnOutput> {
    const turn = await this.runtime.handleTurn({ ...input, channel: 'sms' })

    if (turn.reply?.text) {
      await this.smsService.sendSMS({
        phoneNumber: input.fromPhone,
        message: turn.reply.text,
        messageType: 'auto_response',
        userId: input.userId,
        fromNumberOverride: input.replyFromE164
      })
    }

    // Execute simple actions
    for (const action of turn.actions) {
      if (action.type === 'send_magic_link') {
        await this.magicLinkService.sendMagicLink({
          userId: action.userId,
          linkType: action.linkType,
          deliveryMethod: 'sms',
          phoneNumber: action.phoneNumber
        })
      }
    }
    return turn
  }
}


