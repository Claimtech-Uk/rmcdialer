import { SMSService, MagicLinkService } from '@/modules/communications'
import { AgentRuntimeService, type AgentTurnInput, type AgentTurnOutput } from '../../core/agent-runtime.service'
import { SmsAgentRouter } from './router/sms-agent-router'
import { popDueFollowups } from '../../core/followup.store'
import { containsAbuseIntent, containsComplaintIntent } from '../../core/guardrails'
import { isAutomationHalted, setAutomationHalt, checkAndBumpRate, isIdempotencyKeyUsed, markIdempotencyKeyUsed, getLastReviewAskAt, setLastReviewAskAt, recordLinkSent } from '../../core/memory.store'

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
         userId: input.userId
        // Note: SMS service automatically uses test number for auto_response messages
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
            userId: input.userId
            // Note: SMS service now automatically uses test number for auto_response messages
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
          userId: input.userId
          // Note: SMS service automatically uses test number for auto_response messages
        })
      })
      console.log('AI SMS | ✅ Reply send invoked')
    }

    // Execute actions with proper ordering for multi-SMS sequences
    const smsActions = turn.actions.filter(a => a.type === 'send_sms')
    const nonSmsActions = turn.actions.filter(a => a.type !== 'send_sms')
    
    // Process non-SMS actions first (no ordering issues)
    for (let i = 0; i < nonSmsActions.length; i++) {
      const action = nonSmsActions[i]
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
              // Note: SMS service automatically uses test number for auto_response messages
            })
            
            // Record link send for smart conversation intelligence
            await recordLinkSent(input.fromPhone, 'portal_link_sent')
            console.log('AI SMS | 🔗 Recorded portal link send for conversation intelligence')
          }
          const userSignalsAfter = await this.runtime.getUserSignalsForRouting(input.fromPhone)
          await this.router.endIfGoalAchieved(input.fromPhone, route.type, userSignalsAfter)
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
          const msg = formatSms(`Here's the review link: ${reviewUrl}`)
          if (!withinBusinessHours()) {
            console.log('AI SMS | 🕗 Outside business hours, deferring review link to open')
            await scheduleAtBusinessOpen(input.fromPhone, msg, { kind: 'review_link' })
          } else {
            await sendSmsWithRetry({
              phoneNumber: toE164(action.phoneNumber || input.fromPhone),
              message: msg,
              messageType: 'auto_response',
              userId: input.userId,
              // Note: SMS service automatically uses test number for auto_response messages
            })
            
            // Record review link send for conversation intelligence  
            await recordLinkSent(input.fromPhone, 'review_link_sent')
            console.log('AI SMS | ⭐ Recorded review link send for conversation intelligence')
          }
          await setLastReviewAskAt(input.fromPhone, now, cooldownSec)
          // End review session immediately
          const signalsAfter = await this.runtime.getUserSignalsForRouting(input.fromPhone)
          await this.router.endIfGoalAchieved(input.fromPhone, 'review_collection' as any, signalsAfter)
        })
      }
    }

    // Move multi-SMS sequencing to Redis follow-ups for guaranteed delivery
    if (smsActions.length > 0) {
      await sendOnce(turn.idempotencyKey ? `${turn.idempotencyKey}:redis_sequence` : `redis_sequence:${toNumber}:${smsActions.length}`, async () => {
        const { withinBusinessHours, scheduleFollowup, scheduleAtBusinessOpen } = await import('../../core/followup.store')
        const baseDelaySec = 2 // first follow-up in 2s to feel immediate but use queue
        let offset = 0
        for (let i = 0; i < smsActions.length; i++) {
          const action = smsActions[i]
          offset += i === 0 ? baseDelaySec : 2 // subsequent +2s steps
          const metadata = { kind: 'sequential_sms', sequenceIndex: i + 1, totalInSequence: smsActions.length }
          if (!withinBusinessHours()) {
            await scheduleAtBusinessOpen(input.fromPhone, action.text, metadata)
          } else {
            await scheduleFollowup(input.fromPhone, { text: action.text, delaySec: offset, metadata })
          }
        }
        console.log('AI SMS | 🗄️ Sequenced SMS via Redis follow-ups', { count: smsActions.length, baseDelaySec })
      })
    }

    // TESTING MODE: Use Promise.all with delays - work directly with turn followups, no Redis needed
    const isTestingMode = process.env.AI_SMS_IMMEDIATE_MULTIMSGS === 'true'
    if (isTestingMode && turn.reply?.text && turn.followups && turn.followups.length > 0) {
      console.log('AI SMS | 🚀 Testing mode: using Promise.all with delays (direct from AI)', { 
        count: turn.followups.length, 
        delays: turn.followups.map(f => `${f.delaySec || 2}s`) 
      })
      
      // Elegant Promise.all solution - all delays start immediately, resolve at scheduled times
      const sendWithDelay = (message: string, delay: number) => 
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              await sendSmsWithRetry({
                phoneNumber: toE164(input.fromPhone),
                message: message,
                messageType: 'auto_response',
                userId: input.userId
              })
              console.log('AI SMS | ✅ Testing mode message sent', { 
                delay: delay + 'ms', 
                messageLength: message.length
              })
            } catch (err) {
              console.error('AI SMS | ❌ Testing mode message failed', { delay, message: message.slice(0, 50), err })
            }
            resolve() // Always resolve to not block other messages
          }, delay)
        })

      // Fire all delayed messages in parallel - they'll send at their scheduled times
      const delayedSends = turn.followups.map(f => 
        sendWithDelay(f.text, (f.delaySec || 2) * 1000)
      )
      
      // Don't await - let them fire in background so main request completes immediately
      Promise.all(delayedSends).then(() => {
        console.log('AI SMS | 🎉 All testing mode messages completed')
      }).catch(err => {
        console.error('AI SMS | ❌ Testing mode Promise.all error:', err)
      })
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


