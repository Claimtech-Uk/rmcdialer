// Simplified agent runtime (SMS-first) - Only uses simplified-response-builder.ts
// Streamlined for single response mode with AI-controlled decisions

import { getConversationSummary, setConversationSummary, getLastReply, setLastReply, getConversationInsights } from './memory.store'
import { buildSimplifiedResponse, type SimplifiedResponseContext, type AgentActionWithReasoning } from './simplified-response-builder'
import { redactPII } from './guardrails'
import { prisma } from '@/lib/db'
import { actionRegistry, type ActionExecutionContext } from '../actions'
import { SMSService } from '@/modules/communications/services/sms.service'
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

// Simplified context builder function
async function buildUserContext(fromPhone: string) {
  try {
    const phone = fromPhone.replace(/^\+/, '')
    
    // Get queue info from PostgreSQL 
    const callScore = await prisma.userCallScore.findFirst({
      where: { 
        OR: [
          { userId: BigInt(phone) },
          { userId: BigInt(phone.replace(/^44/, '')) },
          { userId: BigInt(`44${phone}`) }
        ]
      },
      select: { 
        userId: true,
        currentQueueType: true 
      }
    }).catch(() => null)

    if (callScore) {
      return {
        found: true,
        userId: Number(callScore.userId),
        firstName: undefined, // Simplified - no name lookup for now
        queueType: callScore.currentQueueType || undefined,
        pendingRequirementTypes: [],
        primaryClaimStatus: undefined,
        claimLenders: []
      }
    }
    
    return { found: false }
  } catch (error) {
    console.error('Failed to build user context:', error)
    return { found: false }
  }
}

export class AgentRuntimeService {
  private readonly smsService = new SMSService({ 
    authService: undefined as any, 
    userService: undefined as any 
  })

  async handleTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    console.log('AI SMS | 🧠 Using simplified AI-controlled mode only')
    
    // Build user context
    const userCtx = await buildUserContext(input.fromPhone)
    
    // Get recent messages for conversation context
    let recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}> = []
    
    try {
      const phone = input.fromPhone.replace(/^\+/, '')
      const conversation = await prisma.smsConversation.findFirst({
        where: { OR: [{ phoneNumber: phone }, { phoneNumber: `+${phone}` }] },
        select: { id: true }
      })
      
      if (conversation?.id) {
        const allRecent = await prisma.smsMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { direction: true, body: true, createdAt: true }
        })
        
        if (allRecent && allRecent.length) {
          recentMessages = allRecent.reverse().map((m: any) => ({
            direction: m.direction as 'inbound' | 'outbound',
            body: m.body
          }))
        }
      }
    } catch (error) {
      console.warn('Failed to load conversation context:', error)
    }

    // Get conversation insights
    const conversationInsights = await getConversationInsights(input.fromPhone).catch(() => undefined)

    // Build context for simplified AI decision making
    const simplifiedContext: SimplifiedResponseContext = {
      userMessage: input.message,
      userName: userCtx.firstName,
      recentMessages,
      conversationInsights,
      userStatus: userCtx.queueType || undefined,
      userContext: {
        found: userCtx.found,
        userId: userCtx.userId,
        queueType: userCtx.queueType || undefined,
        hasSignature: userCtx.queueType === 'unsigned_users' ? false : userCtx.queueType ? true : null,
        pendingRequirementTypes: userCtx.pendingRequirementTypes || [],
        primaryClaimStatus: userCtx.primaryClaimStatus,
        claimLenders: userCtx.claimLenders || []
      }
    }
    
    // Get AI's intelligent response with actions
    const intelligentResponse = await buildSimplifiedResponse(input.fromPhone, simplifiedContext)
    
    // Extract single message
    const replyText = intelligentResponse.messages?.[0] || "How can I help with your motor finance claim?"
    
    console.log('AI SMS | 🧠 AI-controlled message generated', {
      messageLength: replyText.length,
      actionCount: intelligentResponse.actions.length,
      tone: intelligentResponse.conversationTone
    })

    // Initialize actions array
    let actions: AgentAction[] = []
    
    // Execute AI-decided actions immediately
    await this.executeAIActions(
      intelligentResponse.actions.map(action => ({
        type: action.type as any,
        reasoning: action.reasoning,
        confidence: 0.8
      })),
      input.fromPhone,
      userCtx,
      actions
    )

    // Update conversation summary
    try {
      const trimmedUser = String(input.message).slice(0, 160)
      const trimmedAgent = String(replyText).slice(0, 160)
      const conversationSummary = await getConversationSummary(input.fromPhone).catch(() => null)
      const newSummary = conversationSummary
        ? `${conversationSummary} | User: ${trimmedUser} → Sophie: ${trimmedAgent}`
        : `User: ${trimmedUser} → Sophie: ${trimmedAgent}`
      await setConversationSummary(input.fromPhone, newSummary)
      await setLastReply(input.fromPhone, replyText)
    } catch (error) {
      console.warn('Failed to update conversation summary:', error)
    }

    // Generate idempotency key
    const idempotencyKey = crypto.createHash('sha256')
      .update(`${input.fromPhone}:${replyText}:${JSON.stringify(actions)}`)
      .digest('hex').slice(0, 32)

    return { reply: { text: replyText }, actions, idempotencyKey }
  }

  /**
   * Execute AI-decided actions immediately (simplified)
   */
  private async executeAIActions(
    aiActions: Array<{
      type: 'schedule_callback' | 'none'
      reasoning: string
      confidence: number
    }>,
    phoneNumber: string,
    userCtx: any,
    actions: AgentAction[]
  ): Promise<void> {
    
    const executionContext: ActionExecutionContext = {
      smsService: this.smsService,
      userContext: {
        userId: userCtx.userId,
        phoneNumber: phoneNumber,
        userName: userCtx.firstName,
        found: userCtx.found
      },
      conversationContext: {
        reasoning: 'AI immediate decision',
        confidence: 0.8
      }
    }

    for (const actionDecision of aiActions) {
      if (actionDecision.type === 'none') continue
      
      try {
        console.log(`AI SMS | 🎯 Executing AI action: ${actionDecision.type}`)

        const result = await actionRegistry.execute(
          actionDecision.type,
          executionContext,
          {
            reasoning: actionDecision.reasoning,
            confidence: actionDecision.confidence
          }
        )

        if (result.success) {
          console.log(`AI SMS | ✅ Action executed: ${actionDecision.type}`)
        } else {
          console.error(`AI SMS | ❌ Action failed: ${actionDecision.type}`, result.error)
        }

      } catch (error) {
        console.error(`AI SMS | ❌ Action execution error: ${actionDecision.type}`, error)
      }
    }
  }
}