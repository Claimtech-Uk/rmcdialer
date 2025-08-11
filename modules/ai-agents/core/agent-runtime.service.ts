// Channel-agnostic agent runtime (SMS-first). Responsible for building context,
// calling LLM, applying policies, and returning actions/messages.

import { AgentContextBuilder } from './context-builder'
import { getConversationSummary, setConversationSummary, getLastReply, setLastReply, getLastLinkSentAt, setLastLinkSentAt, getLastReviewAskAt, setLastReviewAskAt } from './memory.store'
import { chat } from './llm.client'
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder'
import { SmsAgentRouter } from '../channels/sms/router/sms-agent-router'
import { CustomerServiceProfile } from '../channels/sms/agents/customer-service.profile'
import { UnsignedChaseProfile } from '../channels/sms/agents/unsigned-chase.profile'
import { RequirementsProfile } from '../channels/sms/agents/requirements.profile'
import { ReviewCollectionProfile } from '../channels/sms/agents/review-collection.profile'
import { redactPII } from './guardrails'
import { prisma } from '@/lib/db'
import { scheduleFollowup, popDueFollowups } from './followup.store'
import crypto from 'crypto'

export type AgentTurnInput = {
  channel: 'sms'
  fromPhone: string
  userId?: number
  message: string
}

export type AgentAction =
  | { type: 'send_sms'; phoneNumber: string; text: string }
  | { type: 'send_magic_link'; userId: number; phoneNumber: string; linkType: 'claimPortal' | 'documentUpload' }
  | { type: 'send_review_link'; phoneNumber: string }
  | { type: 'none' }

export type AgentTurnOutput = {
  reply?: { text: string }
  actions: AgentAction[]
  idempotencyKey?: string
}

export class AgentRuntimeService {
  private readonly contextBuilder = new AgentContextBuilder()
  private readonly router = new SmsAgentRouter()

  async handleTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    // Build user context (by phone). Used to tailor response and choose actions
    const userCtx = await this.contextBuilder.buildFromPhone(input.fromPhone)

    // Load short-term conversation summary for context (per phone)
    const priorSummary = await getConversationSummary(input.fromPhone).catch(() => null)

    // MVP reply logic based on state
    const intentHint = userCtx.queueType === 'unsigned_users'
      ? 'User likely not signed yet; guide to magic link after answering.'
      : userCtx.queueType === 'outstanding_requests'
        ? 'User likely has pending requirements; guide back to portal.'
        : 'User may be signed or seeking status update.'

    // Build prompts (Sophie persona + policy + knowledge), with profile addendum
    const signals = await this.getUserSignalsForRouting(input.fromPhone)
    const route = await this.router.route(input.fromPhone, signals)
    const addendum = (
      route.type === 'unsigned_chase' ? UnsignedChaseProfile.systemAddendum
      : route.type === 'requirements' ? RequirementsProfile.systemAddendum
      : route.type === 'review_collection' ? ReviewCollectionProfile.systemAddendum
      : CustomerServiceProfile.systemAddendum
    )
    const system = buildSystemPrompt(addendum)
    // Fetch up to 5 most recent messages for this phone (inbound/outbound)
    let recentTranscript: string | undefined = undefined
    try {
      const phone = input.fromPhone.replace(/^\+/, '')
      const conversation = await prisma.smsConversation.findFirst({
        where: { OR: [{ phoneNumber: phone }, { phoneNumber: `+${phone}` }] },
        select: { id: true }
      })
      if (conversation?.id) {
        const recent = await prisma.smsMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { direction: true, body: true }
        })
        if (recent && recent.length) {
          const lines = recent
            .reverse()
            .map((m: any) => `${m.direction === 'inbound' ? 'User' : 'Sophie'}: ${redactPII(m.body).trim()}`)
          recentTranscript = lines.join('\n')
        }
      }
    } catch {}
    const userPrompt = buildUserPrompt({
      message: redactPII(input.message),
      userName: userCtx.firstName,
      statusHint: intentHint,
      conversationSummary: priorSummary || undefined,
      recentTranscript
    })

    // Call LLM using Chat Completions with json_object output
    const completion = await chat({
      system,
      user: userPrompt,
      model: process.env.AI_SMS_MODEL || 'gpt-4o-mini',
      responseFormat: { type: 'json_object' }
    })

    let actions: AgentAction[] = []
    let idempotencyKey: string | undefined
    let planVersion: string | undefined
    let replyText: string | undefined
    let followups: Array<{ text: string; delaySec?: number }> = []
    try {
      const parsed = JSON.parse(completion)
      const outputActions = Array.isArray(parsed?.actions) ? parsed.actions : []
      if (typeof parsed?.idempotency_key === 'string') {
        idempotencyKey = parsed.idempotency_key
      }
      if (typeof parsed?.plan_version === 'string') {
        planVersion = parsed.plan_version
      }
      for (const a of outputActions) {
        if (a?.type === 'send_magic_link' && userCtx.found && userCtx.userId) {
          actions.push({ type: 'send_magic_link', userId: userCtx.userId, phoneNumber: input.fromPhone, linkType: 'claimPortal' })
        } else if (a?.type === 'send_sms' && a.phoneNumber && a.text) {
          actions.push({ type: 'send_sms', phoneNumber: a.phoneNumber, text: String(a.text) })
        } else if (a?.type === 'send_review_link') {
          actions.push({ type: 'send_review_link', phoneNumber: input.fromPhone })
        }
      }
      if (typeof parsed?.reply === 'string' && parsed.reply.trim()) {
        replyText = parsed.reply.trim()
      }
      // Collect optional messages for follow-ups
      if (Array.isArray(parsed?.messages)) {
        type PlannedMsg = { text?: string; send_after_seconds?: number }
        followups = (parsed.messages as PlannedMsg[])
          .slice(1) // first message corresponds to reply
          .map((m: PlannedMsg) => ({ text: String(m.text || '').trim(), delaySec: typeof m.send_after_seconds === 'number' ? m.send_after_seconds : undefined }))
          .filter((m: { text: string; delaySec?: number }) => m.text)
      }
    } catch {
      // If schema unexpectedly fails, degrade gracefully
      replyText = String(completion).replace(/^"|"$/g, '')
    }

    // Consent-first heuristic: only send if explicit request to send/resend the link
    if (!actions.length && userCtx.found && userCtx.userId) {
      const explicitSend = /(send|resend|text|share|send\s*me)\b.*\b(portal|link)\b/i.test(input.message)
      if (explicitSend) {
        // Cooldown: avoid repeated link sends (default 60 minutes)
        const cooldownSec = Number(process.env.AI_SMS_LINK_COOLDOWN_SECONDS || 3600)
        const lastAt = await getLastLinkSentAt(input.fromPhone).catch(() => null)
        const now = Date.now()
        const inCooldown = lastAt && now - lastAt < cooldownSec * 1000
        if (!inCooldown) {
          actions.push({ type: 'send_magic_link', userId: userCtx.userId, phoneNumber: input.fromPhone, linkType: 'claimPortal' })
          await setLastLinkSentAt(input.fromPhone, now, cooldownSec)
          if (!replyText) replyText = 'I\'ll send your portal link now.'
        } else if (!replyText) {
          replyText = 'I sent your portal link recently. Would you like me to resend it, or answer anything first?'
        }
      }
    }

    // Remove implicit-send heuristic: do not send based on reply implying sending

    // Default friendly reply if LLM returned nothing usable
    if (!replyText) {
      // Avoid repeating the same intro back-to-back by switching to a clarifying question
      replyText = 'Got it—what would you like to do: get your portal link, upload ID, or check claim status?'
    }

    // Loop prevention: if same reply as last time, switch to a clarifying variant
    try {
      const last = await getLastReply(input.fromPhone)
      if (last && last.trim() === replyText.trim()) {
        replyText = 'Understood. Do you want your portal link, to upload ID, or a quick status update?'
      }
    } catch {}

    // Personalize with first name when we have a matched user and reply doesn't already start with a greeting
    const personalize = (text: string, name?: string, found?: boolean): string => {
      if (!found || !name || /^unknown$/i.test(name)) return text
      const startsWithGreeting = /^\s*(hi|hey|hello)\b/i.test(text)
      if (startsWithGreeting) return text
      return `Hi ${name}, ${text}`
    }

    const personalized = personalize(replyText, userCtx.firstName, userCtx.found)

    // Enqueue follow-ups (MVP, within business hours handled at send time later)
    try {
      for (const f of followups) {
        await scheduleFollowup(input.fromPhone, { text: personalize(f.text, userCtx.firstName, userCtx.found), delaySec: f.delaySec || 120 })
      }
    } catch {}

    // Update short-term conversation summary (very lightweight heuristic)
    try {
      const trimmedUser = String(input.message).slice(0, 160)
      const trimmedAgent = String(personalized).slice(0, 160)
      const newSummary = priorSummary
        ? `${priorSummary} | User: ${trimmedUser} → Sophie: ${trimmedAgent}`
        : `User: ${trimmedUser} → Sophie: ${trimmedAgent}`
      await setConversationSummary(input.fromPhone, newSummary)
      await setLastReply(input.fromPhone, personalized)
    } catch {}

    // Review link throttle + session end signal (for router) if we asked for a review this turn
    // MVP: detect simple intent; proper review tool to be added later.
    try {
      const askedForReview = /trustpilot|review\s+us/i.test(personalized)
      if (askedForReview) {
        const cooldownSec = Number(process.env.AI_SMS_REVIEW_THROTTLE_SECONDS || 30 * 24 * 60 * 60)
        const last = await getLastReviewAskAt(input.fromPhone)
        const now = Date.now()
        if (!last || now - last > cooldownSec * 1000) {
          await setLastReviewAskAt(input.fromPhone, now, cooldownSec)
        }
      }
    } catch {}

    // Ensure an idempotency key exists for this plan to prevent duplicate sends
    if (!idempotencyKey) {
      const planString = JSON.stringify({
        phone: input.fromPhone,
        reply: personalized,
        actions
      })
      idempotencyKey = crypto.createHash('sha256').update(planString).digest('hex').slice(0, 32)
    }

    return { reply: { text: personalized }, actions, idempotencyKey }
  }

  // Expose minimal routing signals without expanding public API elsewhere
  async getUserSignalsForRouting(fromPhone: string): Promise<{ found: boolean; hasSignature: boolean | null; pendingRequirements: number }> {
    const ctx = await this.contextBuilder.buildFromPhone(fromPhone)
    // Infer signature from queueType hint if callContext not available
    const hasSignature = ctx.queueType === 'unsigned_users' ? false : ctx.queueType ? true : null
    return {
      found: ctx.found,
      hasSignature,
      pendingRequirements: ctx.pendingRequirements || 0
    }
  }
}


