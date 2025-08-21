import { SMSService, MagicLinkService } from '@/modules/communications'
import { AgentRuntimeService, type AgentTurnInput, type AgentTurnOutput } from '../../core/agent-runtime.service'
// REMOVED: import { popDueFollowups } from '../../core/followup.store' - legacy follow-up service
import { containsAbuseIntent, containsComplaintIntent } from '../../core/guardrails'
import { isAutomationHalted, setAutomationHalt, isIdempotencyKeyUsed, markIdempotencyKeyUsed, getLastReviewAskAt, setLastReviewAskAt, recordLinkSent } from '../../core/memory.store'
import { databaseSmsHandler, type InboundMessage } from './database-sms-handler'

export class SmsAgentService {
  constructor(
    private readonly smsService: SMSService,
    private readonly magicLinkService: MagicLinkService,
    private readonly runtime = new AgentRuntimeService()
  ) {}


  async handleInbound(input: Omit<AgentTurnInput, 'channel'> & { channel?: 'sms'; replyFromE164?: string; messageSid?: string }): Promise<AgentTurnOutput> {
    
    // Basic automation halt guard
    if (await isAutomationHalted(input.fromPhone)) {
      console.log('AI SMS | 🚫 Automation halted for phone', { from: input.fromPhone })
      return { actions: [], reply: { text: 'Automation is paused for this number. Text RESUME to continue.' } }
    }

    // Basic guardrails
    if (containsAbuseIntent(input.message) || containsComplaintIntent(input.message)) {
      console.log('AI SMS | 🛡️ Guardrails triggered, halting automation', { from: input.fromPhone })
      await setAutomationHalt(input.fromPhone, 7200) // 2 hours halt
      const msg = 'I understand your frustration. A human agent will reach out to you shortly.'
      
      return { actions: [], reply: { text: msg } }
    }

    // Use database-first SMS handler - NO REDIS, atomic database operations only
    // Goal: Use database as single source of truth, eliminate Redis dependencies
    const inboundMessage: InboundMessage = {
      messageSid: input.messageSid || `generated-${Date.now()}`,
      phoneNumber: input.fromPhone,
      text: input.message,
      timestamp: Date.now(),
      userId: input.userId
    }
    
    // Process with database-first atomic handler
    const result = await databaseSmsHandler.handleMessage(
      inboundMessage,
      async (messages, attempt) => {
        console.log('AI SMS | 📝 Database processing batch', {
          messageCount: messages.length,
          attempt,
          preview: messages.map(m => m.text.substring(0, 30)),
          processingMode: 'database_atomic',
          goal: 'eliminate_redis_dependencies'
        })
        
        // Combine messages for context
        const combinedInput = {
          ...input,
          message: messages.map(m => m.text).join(' '),
          channel: 'sms' as const
        }
        
        // Process with runtime
        const turn = await this.runtime.handleTurn(combinedInput)
        console.log('AI SMS | 🤖 Runtime output', { 
          reply: turn.reply?.text?.substring(0, 50), 
          actions: turn.actions?.map(a => a.type),
          attempt,
          processingMode: 'database_first'
        })
        
        // 🎯 FIXED: Don't send SMS in callback - only generate response text
        // This prevents multiple SMS sends during retries
        // SMS will be sent once after successful database completion
        
        return JSON.stringify({
          reply: turn.reply?.text || 'Message received',
          actions: turn.actions || [],
          idempotencyKey: turn.idempotencyKey
        })
      }
    )
    
    if (!result.processed) {
      console.log('AI SMS | ⏳ Database processing deferred or failed', {
        reason: result.reason,
        phoneNumber: input.fromPhone,
        error: result.error,
        messageId: result.messageId,
        retryAfterSeconds: result.retryAfterSeconds,
        processingMode: 'database_first'
      })
      
      // If processing failed with error, send fallback response  
      if (result.reason === 'processing_error') {
        console.log('AI SMS | 🚨 Database processing failed, sending fallback response')
        return { 
          actions: [], 
          reply: { 
            text: 'Thanks for your message. We\'re experiencing a temporary issue. A team member will get back to you shortly.' 
          } 
        }
      }
      
      // Message was deferred (another process handling) - no response needed
      return { actions: [], reply: undefined as any }
    }
    
    // Success - message was processed using database-first approach
    console.log('AI SMS | ✅ Database processing completed successfully', {
      reason: result.reason,
      responseLength: result.response?.length,
      phoneNumber: input.fromPhone,
      messageId: result.messageId,
      processingMode: 'database_atomic',
      goal: 'reliable_sms_processing'
    })
    
    // 🎯 FIXED: Parse the turn data and send SMS only ONCE after successful batch processing
    try {
      const turnData = JSON.parse(result.response || '{}')
      const turn = {
        reply: { text: turnData.reply },
        actions: turnData.actions || [],
        idempotencyKey: turnData.idempotencyKey
      }
      
      console.log('AI SMS | 📤 Sending final batch response (no retry duplicates)', {
        hasReply: !!turn.reply?.text,
        actionCount: turn.actions?.length || 0,
        idempotencyKey: turn.idempotencyKey
      })
      
      await this.processTurnOutput(turn, input)
      
    } catch (parseError) {
      console.error('AI SMS | ⚠️ Failed to parse turn data, sending basic reply', {
        error: parseError,
        response: result.response?.substring(0, 100)
      })
      
      // Fallback: send the basic response
      if (result.response) {
        await this.smsService.sendSMS({
          phoneNumber: input.fromPhone,
          message: result.response,
          messageType: 'auto_response',
          userId: input.userId
        })
      }
    }
    
    // Return empty reply since SMS was already sent
    return { actions: [], reply: undefined as any }
  }
  
  /**
   * Process the turn output - extracted for use by check-before-send handler
   */
  private async processTurnOutput(
    turn: AgentTurnOutput, 
    input: Omit<AgentTurnInput, 'channel'> & { channel?: 'sms'; replyFromE164?: string }
  ): Promise<void> {
    // Idempotency guard: if this plan was already executed, skip sending duplicates
    if (turn.idempotencyKey) {
      const used = await isIdempotencyKeyUsed(turn.idempotencyKey)
      if (used) {
        console.log('AI SMS | 🧿 Idempotency: duplicate plan detected, skipping sends', { key: turn.idempotencyKey })
        return
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

    // Send main reply immediately (no more business hours scheduling)
    if (turn.reply && typeof turn.reply.text === 'string' && turn.reply.text.length > 0) {
      // Ensure SMS length stays reasonable (160-ish characters)
      const { formatSms } = await import('./formatter')
      const replyText = turn.reply.text
      const replyKey = turn.idempotencyKey ? `${turn.idempotencyKey}:reply` : `reply:${toNumber}:${replyText}`
      console.log('AI SMS | 📤 Sending reply immediately', { to: toNumber, fromOverride: input.replyFromE164 })
      await sendOnce(replyKey, async () => {
        const msg = formatSms(replyText)
        await sendSmsWithRetry({
          phoneNumber: toNumber,
          message: msg,
          messageType: 'auto_response',
          userId: input.userId
          // Note: SMS service automatically uses test number for auto_response messages
        })
      })
      console.log('AI SMS | ✅ Reply sent immediately')
    }

    // Execute actions immediately (no more follow-up scheduling)
    const smsActions = turn.actions.filter(a => a.type === 'send_sms')
    const nonSmsActions = turn.actions.filter(a => a.type !== 'send_sms')
    
    // Process non-SMS actions first (no ordering issues)
    for (let i = 0; i < nonSmsActions.length; i++) {
      const action = nonSmsActions[i]
      const actionKeyBase = turn.idempotencyKey ? `${turn.idempotencyKey}:action:${i}` : `action:${toNumber}:${JSON.stringify(action)}`
      
      if (action.type === 'send_magic_link') {
        await sendOnce(actionKeyBase, async () => {
          console.log('AI SMS | 🔗 Sending magic link', { to: action.phoneNumber })
          // Only send if we have a valid userId
          if (input.userId) {
            await this.magicLinkService.sendMagicLink({
              phoneNumber: action.phoneNumber,
              linkType: 'claimPortal',
              userId: input.userId,
              deliveryMethod: 'sms'
              // Note: Magic link service now uses proper number routing (manual vs AI)
            })
          } else {
            console.warn('AI SMS | ⚠️ No userId provided for magic link action')
          }
        })
      }
      
      if (action.type === 'send_review_link') {
        await sendOnce(actionKeyBase, async () => {
          const reviewUrl = process.env.TRUSTPILOT_REVIEW_URL
          if (!reviewUrl) {
            console.error('AI SMS | ❌ TRUSTPILOT_REVIEW_URL not set')
            return
          }
          const { formatSms } = await import('./formatter')
          console.log('AI SMS | ⭐ Sending review link', { to: action.phoneNumber })
          const msg = formatSms(`Our trustpilot: ${reviewUrl}`)
          await sendSmsWithRetry({
            phoneNumber: toNumber,
            message: msg,
            messageType: 'auto_response',
            userId: input.userId
            // Note: SMS service automatically uses test number for auto_response messages
          })

          // Simplified - no session management needed
          console.log('AI SMS | ⭐ Review link sent (simplified mode)')
        })
      }
    }

    // Send SMS actions immediately with small delays (no Redis follow-ups)
    if (smsActions.length > 0) {
      await sendOnce(turn.idempotencyKey ? `${turn.idempotencyKey}:sms_sequence` : `sms_sequence:${toNumber}:${smsActions.length}`, async () => {
        for (let i = 0; i < smsActions.length; i++) {
          const action = smsActions[i]
          if (i > 0) {
            // Small delay between messages to avoid spam detection
            await sleep(2000)
          }
          
          const { formatSms } = await import('./formatter')
          const msg = formatSms(action.text)
          await sendSmsWithRetry({
            phoneNumber: toNumber,
            message: msg,
            messageType: 'auto_response',
            userId: input.userId
          })
        }
        console.log('AI SMS | ✅ Multi-SMS sequence sent immediately', { count: smsActions.length })
      })
    }

    // REMOVED: Testing mode code that was dependent on follow-ups

    // Mark the plan as completed
    if (turn.idempotencyKey) {
      await markIdempotencyKeyUsed(turn.idempotencyKey)
    }
  }
}