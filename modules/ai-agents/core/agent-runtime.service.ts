// Channel-agnostic agent runtime (SMS-first). Responsible for building context,
// calling LLM, applying policies, and returning actions/messages.

import { enhanceMessage } from '@/lib/utils/openai'
import { AgentContextBuilder } from './context-builder'

export type AgentTurnInput = {
  channel: 'sms'
  fromPhone: string
  userId?: number
  message: string
}

export type AgentAction =
  | { type: 'send_sms'; phoneNumber: string; text: string }
  | { type: 'send_magic_link'; userId: number; phoneNumber: string; linkType: 'claimPortal' | 'documentUpload' }
  | { type: 'none' }

export type AgentTurnOutput = {
  reply?: { text: string }
  actions: AgentAction[]
}

export class AgentRuntimeService {
  private readonly contextBuilder = new AgentContextBuilder()

  async handleTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    // Build user context (by phone). Used to tailor response and choose actions
    const userCtx = await this.contextBuilder.buildFromPhone(input.fromPhone)

    // MVP reply logic based on state
    const intentHint = userCtx.queueType === 'unsigned_users'
      ? 'User likely not signed yet; guide to magic link after answering.'
      : userCtx.queueType === 'outstanding_requests'
        ? 'User likely has pending requirements; guide back to portal.'
        : 'User may be signed or seeking status update.'

    const enhanced = await enhanceMessage({
      message: `User said: ${input.message}. ${intentHint} Keep under 160 chars.`,
      context: { isFollowUp: false, tone: 'professional' }
    })

    // Suggest actions for the orchestrator (not executed here)
    const actions: AgentAction[] = []
    if (userCtx.found && userCtx.userId) {
      if (userCtx.queueType === 'unsigned_users') {
        actions.push({ type: 'send_magic_link', userId: userCtx.userId, phoneNumber: input.fromPhone, linkType: 'claimPortal' })
      }
    }

    return { reply: { text: enhanced.enhancedMessage }, actions }
  }
}


