import { SMSService, MagicLinkService } from '@/modules/communications'
import { AgentRuntimeService, type AgentTurnInput, type AgentTurnOutput } from '../../core/agent-runtime.service'
import { SmsAgentRouter } from './router/sms-agent-router'
import { popDueFollowups } from '../../core/followup.store'
import { containsAbuseIntent, containsComplaintIntent } from '../../core/guardrails'
import { isAutomationHalted, setAutomationHalt, checkAndBumpRate, isIdempotencyKeyUsed, markIdempotencyKeyUsed, getLastReviewAskAt, setLastReviewAskAt } from '../../core/memory.store'

export class SmsAgentService {
  constructor(
    private readonly smsService: SMSService,
    private readonly magicLinkService: MagicLinkService,
    private readonly runtime = new AgentRuntimeService(),
    private readonly router = new SmsAgentRouter()
  ) {}

  async handleInbound(input: Omit<AgentTurnInput, 'channel'> & { channel?: 'sms'; replyFromE164?: string }): Promise<AgentTurnOutput> {
    const startedAt = Date.now()
    console.log('AI SMS | 🤖 Handling inbound', { from: input.fromPhone })
    // Respect existing automation halt window
    if (await isAutomationHalted(input.fromPhone)) {
      console.log('AI SMS | 🚫 Automation halted for this number; skipping AI turn')
      return { actions: [], reply: undefined as any }
    }

    // Safety: complaint/abuse handling – acknowledge and halt automation for 24h
    const lower = (input.message || '').toLowerCase()
    // Detect STOP first elsewhere. Here, only treat as abuse if truly abusive.
    if (containsComplaintIntent(lower) || containsAbuseIntent(lower)) {
      const { formatSms } = await import('./formatter')
      const toE164 = (n: string) => (n?.startsWith('+') ? n : `+${n}`)
      const toNumber = toE164(input.fromPhone)
      const msg = containsComplaintIntent(lower)
        ? 'Thanks for letting us know—we’ll flag this for a specialist to review and contact you.'
        : 'Understood. I’ll pause automated messages and arrange human follow-up.'
      await this.smsService.sendSMS({
        phoneNumber: toNumber,
        message: formatSms(msg),
        messageType: 'auto_response',
        userId: input.userId,
        fromNumberOverride: input.replyFromE164
      })
      await setAutomationHalt(input.fromPhone)
      console.log('AI SMS | 🚩 Complaint/abuse acknowledged; automation halted 24h')
      return { actions: [], reply: { text: msg } }
    }

    // Cancel/consume any due follow-ups first (send them now, then proceed with current turn)
    try {
      const due = await popDueFollowups(input.fromPhone)
      if (due.length) {
        const { formatSms } = await import('./formatter')
        const { withinBusinessHours, scheduleFollowup } = await import('../../core/followup.store')
        for (const f of due) {
          if (!withinBusinessHours()) {
            // Outside business hours: reschedule to next 08:00
            const now = new Date()
            const next = new Date(now)
            next.setDate(now.getDate() + 1)
            next.setHours(8, 0, 0, 0)
            const delaySec = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000))
            await scheduleFollowup(input.fromPhone, { text: f.text, delaySec, metadata: f.metadata })
            continue
          }
          await this.smsService.sendSMS({
            phoneNumber: input.fromPhone.startsWith('+') ? input.fromPhone : `+${input.fromPhone}`,
            message: formatSms(f.text),
            messageType: 'auto_response',
            userId: input.userId,
            fromNumberOverride: input.replyFromE164
          })
        }
        console.log('AI SMS | ⏰ Sent due follow-ups', { count: due.length })
      }
    } catch {}
    // Lightweight routing: choose agent type via sticky session and user signals
    const userSignals = await this.runtime.getUserSignalsForRouting(input.fromPhone)
    const route = await this.router.route(input.fromPhone, userSignals)
    console.log('AI SMS | 🧭 Route decision', { type: route.type, reason: route.reason, sessionStarted: route.sessionStarted })
    // Basic per-number rate limit to avoid bursts
    if (!(await checkAndBumpRate(input.fromPhone))) {
      console.log('AI SMS | ⏳ Rate limited; skipping turn', { from: input.fromPhone })
      return { actions: [], reply: undefined as any }
    }

    const turn = await this.runtime.handleTurn({ ...input, channel: 'sms', /* future: profile */ } as any)
    console.log('AI SMS | 🤖 Runtime output', { reply: turn.reply?.text, actions: turn.actions?.map(a => a.type) })

    // Idempotency guard: if this plan was already executed, skip sending duplicates
    if (turn.idempotencyKey) {
      const used = await isIdempotencyKeyUsed(turn.idempotencyKey)
      if (used) {
        console.log('AI SMS | 🧿 Idempotency: duplicate plan detected, skipping sends', { key: turn.idempotencyKey })
        return { actions: [], reply: undefined as any, idempotencyKey: turn.idempotencyKey }
      }
    }

    const toE164 = (n: string) => (n?.startsWith('+') ? n : `+${n}`)
    const toNumber = toE164(input.fromPhone)

    // Small helpers ----------------------------------------------------------
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))
    const sendOnce = async (key: string, fn: () => Promise<void>) => {
      if (await isIdempotencyKeyUsed(key)) {
        console.log('AI SMS | 🧿 Idempotent skip', { key })
        return
      }
      await fn()
      await markIdempotencyKeyUsed(key)
    }
    const sendSmsWithRetry = async (args: Parameters<SMSService['sendSMS']>[0], retries: number = 2) => {
      let attempt = 0
      while (true) {
        try {
          return await this.smsService.sendSMS(args)
        } catch (err) {
          attempt++
          const isLast = attempt > retries
          console.error('AI SMS | ❌ SMS send failed', { attempt, err })
          if (isLast) throw err
          await sleep(300 * attempt)
        }
      }
    }

    if (turn.reply && typeof turn.reply.text === 'string' && turn.reply.text.length > 0) {
      // Ensure SMS length stays reasonable (160-ish characters)
      const { formatSms } = await import('./formatter')
      const replyText = turn.reply.text
      const replyKey = turn.idempotencyKey ? `${turn.idempotencyKey}:reply` : `reply:${toNumber}:${replyText}`
      console.log('AI SMS | 📤 Sending reply', { to: toNumber, fromOverride: input.replyFromE164 })
      await sendOnce(replyKey, async () => {
        const { withinBusinessHours, scheduleAtBusinessOpen } = await import('../../core/followup.store')
        const msg = formatSms(replyText)
        if (!withinBusinessHours()) {
          console.log('AI SMS | 🕗 Outside business hours, deferring reply to open')
          await scheduleAtBusinessOpen(input.fromPhone, msg, { kind: 'primary_reply' })
          return
        }
        await sendSmsWithRetry({
          phoneNumber: toNumber,
          message: msg,
          messageType: 'auto_response',
          userId: input.userId,
          fromNumberOverride: input.replyFromE164
        })
      })
      console.log('AI SMS | ✅ Reply send invoked')
    }

    // Execute simple actions
    for (let i = 0; i < turn.actions.length; i++) {
      const action = turn.actions[i]
      const actionKeyBase = turn.idempotencyKey ? `${turn.idempotencyKey}:action:${i}` : `action:${toNumber}:${JSON.stringify(action)}`
      if (action.type === 'send_magic_link') {
        await sendOnce(actionKeyBase, async () => {
          console.log('AI SMS | 🔗 Sending magic link', { userId: action.userId, to: action.phoneNumber || input.fromPhone })
          const { withinBusinessHours, scheduleAtBusinessOpen } = await import('../../core/followup.store')
          if (!withinBusinessHours()) {
            console.log('AI SMS | 🕗 Outside business hours, deferring magic link to open')
            await scheduleAtBusinessOpen(input.fromPhone, 'I can send your secure portal link when we open at 8am. Shall I do that?', { kind: 'magic_link_prompt' })
          } else {
            await this.magicLinkService.sendMagicLink({
              userId: action.userId,
              linkType: action.linkType,
              deliveryMethod: 'sms',
              phoneNumber: toE164(action.phoneNumber || input.fromPhone),
              fromNumberOverride: input.replyFromE164
            })
          }
          const userSignalsAfter = await this.runtime.getUserSignalsForRouting(input.fromPhone)
          await this.router.endIfGoalAchieved(input.fromPhone, route.type, userSignalsAfter)
        })
      } else if (action.type === 'send_sms') {
        await sendOnce(actionKeyBase, async () => {
          const { formatSms } = await import('./formatter')
          const { withinBusinessHours, scheduleAtBusinessOpen } = await import('../../core/followup.store')
          console.log('AI SMS | 📨 Sending action SMS', { to: action.phoneNumber || input.fromPhone })
          const msg = formatSms(action.text)
          if (!withinBusinessHours()) {
            console.log('AI SMS | 🕗 Outside business hours, deferring action SMS to open')
            await scheduleAtBusinessOpen(input.fromPhone, msg, { kind: 'action_sms' })
          } else {
            await sendSmsWithRetry({
              phoneNumber: toE164(action.phoneNumber || input.fromPhone),
              message: msg,
              messageType: 'auto_response',
              userId: input.userId,
              fromNumberOverride: input.replyFromE164
            })
          }
        })
      } else if (action.type === 'send_review_link') {
        await sendOnce(actionKeyBase, async () => {
          const reviewUrl = process.env.TRUSTPILOT_REVIEW_URL || 'https://uk.trustpilot.com/review/resolvemyclaim.co.uk'
          const { formatSms } = await import('./formatter')
          const { withinBusinessHours, scheduleAtBusinessOpen } = await import('../../core/followup.store')
          // Throttle monthly
          const cooldownSec = Number(process.env.AI_SMS_REVIEW_THROTTLE_SECONDS || 30 * 24 * 60 * 60)
          const lastAsk = await getLastReviewAskAt(input.fromPhone)
          const now = Date.now()
          if (lastAsk && now - lastAsk < cooldownSec * 1000) {
            console.log('AI SMS | ⏳ Review link throttled; skipping send', { to: action.phoneNumber })
            return
          }
          console.log('AI SMS | ⭐ Sending review link', { to: action.phoneNumber })
          const msg = formatSms(`Here’s the review link: ${reviewUrl}`)
          if (!withinBusinessHours()) {
            console.log('AI SMS | 🕗 Outside business hours, deferring review link to open')
            await scheduleAtBusinessOpen(input.fromPhone, msg, { kind: 'review_link' })
          } else {
            await sendSmsWithRetry({
              phoneNumber: toE164(action.phoneNumber || input.fromPhone),
              message: msg,
              messageType: 'auto_response',
              userId: input.userId,
              fromNumberOverride: input.replyFromE164
            })
          }
          await setLastReviewAskAt(input.fromPhone, now, cooldownSec)
          // End review session immediately
          const signalsAfter = await this.runtime.getUserSignalsForRouting(input.fromPhone)
          await this.router.endIfGoalAchieved(input.fromPhone, 'review_collection' as any, signalsAfter)
        })
      }
    }

    // Mark idempotency key after successful sends
    if (turn.idempotencyKey) {
      await markIdempotencyKeyUsed(turn.idempotencyKey)
    }

    // If goal achieved, end sticky session
    const closed = await this.router.endIfGoalAchieved(input.fromPhone, route.type, await this.runtime.getUserSignalsForRouting(input.fromPhone))
    // Collect current KB IDs used (from prompt builder’s selection) for telemetry
    try {
      const { selectKbIdsForMessage } = await import('../../core/prompt-builder')
      const kbIds = selectKbIdsForMessage(input.message)
      console.log('AI SMS | 📚 KB', { phone: input.fromPhone, kb_ids_used: kbIds })
    } catch {}
    // Minimal telemetry (Phase 4)
    try {
      const latencyMs = Date.now() - startedAt
      console.log('AI SMS | 📊 Telemetry', {
        phone: input.fromPhone,
        agentType: route.type,
        reason: route.reason,
        actions: turn.actions?.map(a => a.type),
        goalClosed: closed,
        idempotencyKey: turn.idempotencyKey,
        latencyMs
      })
    } catch {}
    console.log('AI SMS | 🏁 Turn completed')
    return turn
  }
}


