// Channel-agnostic agent runtime (SMS-first). Responsible for building context,
// calling LLM, applying policies, and returning actions/messages.

import { AgentContextBuilder } from './context-builder'
import { getConversationSummary, setConversationSummary, getLastReply, setLastReply, getLastLinkSentAt, setLastLinkSentAt, getLastReviewAskAt, setLastReviewAskAt } from './memory.store'
import { chat } from './multi-provider-llm.client'
import { hybridChat, convertToolCallsToActions, SMS_AGENT_TOOLS, getSystemPromptForMode, isToolCallingEnabled } from './modern-llm.client'
import { buildSystemPrompt, buildUserPrompt, buildUserPromptIntelligent } from './prompt-builder'
import { analyzeAndStoreConversationInsights } from './intelligent-kb-selector'
import { smartPersonalize, getPersonalizationPromptContext, recordAILinkAction, createLegacyPersonalizeFunction } from './intelligent-personalization'
import { enhanceResponse, shouldEnhanceResponse } from './intelligent-response-enhancer'
import { conversationPlanner, type PlanningContext } from './conversation-planner'
import { isFeatureEnabled } from '../config/feature-flags'
import { buildConversationalResponse, type ResponseContext } from './conversational-response-builder'
import { buildSimplifiedResponse, type SimplifiedResponseContext, type AgentActionWithReasoning } from './simplified-response-builder'
import { checkLinkConsent } from './consent-manager'
import { SmsAgentRouter } from '../channels/sms/router/sms-agent-router'
import { CustomerServiceProfile } from '../channels/sms/agents/customer-service.profile'
import { UnsignedChaseProfile } from '../channels/sms/agents/unsigned-chase.profile'
import { RequirementsProfile } from '../channels/sms/agents/requirements.profile'
import { ReviewCollectionProfile } from '../channels/sms/agents/review-collection.profile'
import { redactPII } from './guardrails'
import { prisma } from '@/lib/db'
// REMOVED: import { scheduleFollowup, popDueFollowups } from './followup.store' - legacy follow-up service
import { generateAIMagicLink, formatMagicLinkForSMS } from './ai-magic-link-generator'
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
  // REMOVED: followups field - no longer used in immediate response system
}

export class AgentRuntimeService {
  private readonly contextBuilder = new AgentContextBuilder()
  private readonly router = new SmsAgentRouter()
  private readonly smsService = new SMSService({ 
    authService: undefined as any, 
    userService: undefined as any 
  }) // For action execution - minimal dependencies

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
    // Determine if we should use modern tool calling or legacy JSON response
    const useToolCalling = isToolCallingEnabled()
    const baseSystemPrompt = buildSystemPrompt(addendum)
    const system = getSystemPromptForMode(baseSystemPrompt, useToolCalling)
    
    // Fetch balanced conversation context: up to 5 each direction (10 total)
    let recentTranscript: string | undefined = undefined
    let recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}> = []
    
    try {
      const phone = input.fromPhone.replace(/^\+/, '')
      const conversation = await prisma.smsConversation.findFirst({
        where: { OR: [{ phoneNumber: phone }, { phoneNumber: `+${phone}` }] },
        select: { id: true }
      })
      if (conversation?.id) {
        // Get last 15 messages to ensure we have enough context
        const allRecent = await prisma.smsMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: { direction: true, body: true, createdAt: true }
        })
        
        if (allRecent && allRecent.length) {
          // Balance the messages: aim for 5 inbound + 5 outbound (10 total max)
          const reversed = allRecent.reverse() // Chronological order
          const inboundMessages = reversed.filter(m => m.direction === 'inbound').slice(-5)
          const outboundMessages = reversed.filter(m => m.direction === 'outbound').slice(-5)
          
          // Combine and sort by creation time to maintain conversation flow
          const balancedMessages = [...inboundMessages, ...outboundMessages]
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .slice(-10) // Final limit of 10 messages
          
          // Store raw messages for intelligent analysis
          recentMessages = balancedMessages.map((m: any) => ({
            direction: m.direction as 'inbound' | 'outbound',
            body: m.body
          }))
          
          // Keep legacy transcript format for backward compatibility
          const lines = recentMessages
            .map((m: any) => `${m.direction === 'inbound' ? 'User' : 'Sophie'}: ${redactPII(m.body).trim()}`)
          recentTranscript = lines.join('\n')
          
          console.log('AI SMS | 📚 Conversation context loaded', {
            totalMessages: recentMessages.length,
            inbound: recentMessages.filter(m => m.direction === 'inbound').length,
            outbound: recentMessages.filter(m => m.direction === 'outbound').length
          })
        }
      }
    } catch {}
    
    // Use intelligent prompt building with conversation context
    console.log('AI SMS | 🧠 Using intelligent prompt building with conversation context')
    
    // Get personalization context for smarter AI responses
    const personalizationContext = await getPersonalizationPromptContext(input.fromPhone)
    
    const userPrompt = await buildUserPromptIntelligent({
      message: redactPII(input.message),
      userName: userCtx.firstName,
      statusHint: intentHint,
      conversationSummary: priorSummary || undefined,
      recentTranscript,
      recentMessages,
      personalizationContext
    })

    // Initialize response variables
    let actions: AgentAction[] = []
    let idempotencyKey: string | undefined
    let planVersion: string | undefined
    let replyText: string | undefined
    let personalized: string | undefined
    // REMOVED: followups array - no longer used in immediate response system
    
    // Check if we should use the new simplified AI-controlled mode
    const useSimplifiedMode = process.env.AI_SMS_SIMPLIFIED_MODE === 'true' || 
      isFeatureEnabled('SIMPLIFIED_AI_MODE_ENABLED' as any)
    
    // Fallback to conversational mode if simplified is not enabled
    const useConversationalMode = !useSimplifiedMode && (
      isFeatureEnabled('CONVERSATIONAL_MODE_ENABLED' as any) ||
      (process.env.AI_SMS_CONVERSATIONAL_MODE !== 'false')
    )
    
    if (useSimplifiedMode) {
      console.log('AI SMS | 🧠 Using new simplified AI-controlled mode')
      
      // Build context for intelligent AI decision making
      const simplifiedContext: SimplifiedResponseContext = {
        userMessage: input.message,
        userName: userCtx.firstName,
        recentMessages,
        conversationInsights: await analyzeAndStoreConversationInsights(
          input.fromPhone, 
          input.message, 
          recentMessages
        ),
        knowledgeContext: userPrompt.includes('Relevant KB') ? 
          userPrompt.split('Relevant KB (AI-selected): [')[1]?.split(']')[0] : undefined,
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
      
      // Extract single message (enforced in simplified response builder)
      const messages = intelligentResponse.messages || []
      if (messages.length > 0) {
        replyText = messages[0] // Single unified message
        
        console.log('AI SMS | 🧠 AI-controlled single message generated', {
          messageLength: messages[0]?.length || 0,
          actionCount: intelligentResponse.actions.length,
          tone: intelligentResponse.conversationTone,
          reasoning: intelligentResponse.reasoning?.substring(0, 100) + '...'
        })
      }
      
      // Execute AI-decided actions immediately (no delays needed)
      await this.executeAIActions(
        intelligentResponse.actions.map(action => ({
          type: action.type as any,
          reasoning: action.reasoning,
          confidence: 0.8 // Default confidence for AI decisions
        })),
        input.fromPhone,
        userCtx,
        actions,
        [] // No follow-ups in immediate system
      )
      
      // Apply intelligent personalization
      if (replyText) {
        const smartPersonalizationResult = await smartPersonalize({
          phone: input.fromPhone,
          firstName: userCtx.firstName,
          userFound: userCtx.found,
          replyText
        })
        
        personalized = smartPersonalizationResult.personalizedText
        await recordAILinkAction(input.fromPhone, personalized)
      }
      
    } else if (useConversationalMode) {
      console.log('AI SMS | 💬 Using new conversational response system')
      
      // Use new conversational response builder
      const responseContext: ResponseContext = {
        userMessage: input.message,
        userName: userCtx.firstName,
        recentMessages,
        conversationInsights: await analyzeAndStoreConversationInsights(
          input.fromPhone, 
          input.message, 
          recentMessages
        ),
        knowledgeContext: userPrompt.includes('Relevant KB') ? 
          userPrompt.split('Relevant KB (AI-selected): [')[1]?.split(']')[0] : undefined,
        userStatus: userCtx.queueType || undefined
      }
      
      const conversationalResponse = await buildConversationalResponse(input.fromPhone, responseContext)
      
      // Handle AI's single message response (enforced in response builder)
      const messages = conversationalResponse.messages || []
      
      if (messages.length > 0) {
        // Single unified message
        replyText = messages[0]
        console.log('AI SMS | 💬 Single unified message response', {
          messageLength: messages[0]?.length || 0,
          tone: conversationalResponse.conversationTone
        })
      } else {
        // Fallback if no messages (shouldn't happen)
        replyText = "I understand your question. How can I help you further?"
        console.log('AI SMS | ⚠️ No messages from AI, using fallback')
      }
      
      // Handle smart link referencing
      if (conversationalResponse.linkReference) {
        // Replace any generic portal link mentions with smart reference
        replyText = replyText.replace(/portal link/gi, conversationalResponse.linkReference)
        console.log('AI SMS | 🔗 Applied smart link reference', {
          reference: conversationalResponse.linkReference
        })
      }
      
      // Check for explicit link consent and handle {LINK_PLACEHOLDER} replacement
      const consentStatus = await checkLinkConsent(input.fromPhone, input.message, {
        messageCount: responseContext.conversationInsights?.messageCount || 0,
        recentMessages: responseContext.recentMessages
      })
      
      // Check if any message contains the link placeholder
      const hasLinkPlaceholder = messages.some(msg => msg.includes('[link placeholder]'))
      
      if (hasLinkPlaceholder && userCtx.found && userCtx.userId) {
        console.log('AI SMS | 🔗 Link placeholder detected in explicit request')
        
        if (consentStatus.hasConsent) {
          if (consentStatus.reason === 'cooldown') {
            // User wants link but it's in cooldown - replace with cooldown message
            replyText = 'I sent your portal link recently. Would you like me to resend it, or answer anything else first?'
            
            // Single message mode - no followups to process
            
          } else {
            // User has given consent, generate actual magic link and replace placeholder
            const aiMagicLink = generateAIMagicLink(userCtx.userId)
            const formattedUrl = formatMagicLinkForSMS(aiMagicLink.url)
            
            actions.push({ 
              type: 'send_magic_link', 
              userId: userCtx.userId, 
              phoneNumber: input.fromPhone, 
              linkType: 'claimPortal' 
            })
            
            // Replace [link placeholder] with the actual generated magic link
            replyText = replyText.replace(/\[link placeholder\]/g, formattedUrl)
            
            // Single message mode - link is integrated into the single message
            
            // Also replace in any SMS actions that might contain the placeholder
            actions = actions.map(action => {
              if (action.type === 'send_sms' && action.text.includes('[link placeholder]')) {
                return {
                  ...action,
                  text: action.text.replace(/\[link placeholder\]/g, formattedUrl)
                }
              }
              return action
            })
            
            console.log('AI SMS | ✅ Link placeholder replaced with actual magic link', {
              userId: userCtx.userId,
              trackingId: aiMagicLink.trackingId,
              urlPreview: formattedUrl.substring(0, 40) + '...'
            })
          }
        } else {
          // No consent - replace placeholder with offer message
          replyText = replyText.replace(/\[link placeholder\]/g, '')
          replyText += ` ${conversationalResponse.linkOffer || 'Would you like me to send your secure portal link?'}`
          
          // Single message mode - all content is in one unified message
        }
        
      } else if (consentStatus.hasConsent && userCtx.found && userCtx.userId && !hasLinkPlaceholder) {
        // Handle regular consent without placeholder (existing logic)
        if (consentStatus.reason === 'cooldown') {
          // User wants link but it's in cooldown
          replyText = 'I sent your portal link recently. Would you like me to resend it, or answer anything else first?'
        } else {
          // User has given consent, send the link
          actions.push({ 
            type: 'send_magic_link', 
            userId: userCtx.userId, 
            phoneNumber: input.fromPhone, 
            linkType: 'claimPortal' 
          })
          // Do not mutate the immediate message to repeat the offer; keep it clean
        }
      }

      // If we still have no consent and there was no placeholder, append a single, clean offer (once)
      if (!consentStatus.hasConsent && !hasLinkPlaceholder && conversationalResponse.shouldOfferLink && conversationalResponse.linkOffer) {
        replyText += ` ${conversationalResponse.linkOffer}`
      }
      
      // Process AI-decided actions using the action registry (immediate execution)
      if (conversationalResponse.actions) {
        await this.executeAIActions(
          conversationalResponse.actions,
          input.fromPhone,
          userCtx,
          actions,
          [] // No follow-ups in immediate system
        )
      }

      console.log('AI SMS | ✅ Conversational response built', {
        messageCount: conversationalResponse.messages.length,
        shouldOfferLink: conversationalResponse.shouldOfferLink,
        hasConsent: consentStatus.hasConsent,
        consentReason: consentStatus.reason,
        hasLinkPlaceholder,
        actionsCount: actions.length,
        aiDecisions: conversationalResponse.actions?.map(a => ({ type: a.type, confidence: a.confidence })) || []
      })
      
      // Apply intelligent personalization for conversational mode
      if (replyText) {
        const smartPersonalizationResult = await smartPersonalize({
          phone: input.fromPhone,
          firstName: userCtx.firstName,
          userFound: userCtx.found,
          replyText
        })
        
        personalized = smartPersonalizationResult.personalizedText
        
        // Record AI link actions for future intelligence
        await recordAILinkAction(input.fromPhone, personalized)
      }
      
    } else {
      // Use existing LLM approach
      console.log('AI SMS | 🤖 Using legacy LLM approach', { 
        useToolCalling, 
        model: process.env.AI_SMS_MODEL || 'gpt-4o-mini' 
      })
    
    const llmResponse = await hybridChat({
      systemPrompt: system,
      userPrompt,
      tools: useToolCalling ? SMS_AGENT_TOOLS : undefined,
      enableToolCalling: useToolCalling,
      model: process.env.AI_SMS_MODEL || 'gpt-4o-mini'
    })
    
    console.log('AI SMS | 🤖 LLM response received', {
      type: llmResponse.type,
      hasContent: !!llmResponse.content,
      toolCallsCount: llmResponse.toolCalls.length,
      fallbackUsed: llmResponse.fallbackUsed
    })

    // Handle response based on type (tool calling vs JSON)
    if (llmResponse.type === 'tool_calling') {
      // Modern tool calling response
      console.log('AI SMS | 🔧 Processing tool calling response')
      
      // Extract reply from content
      if (llmResponse.content) {
        replyText = llmResponse.content.trim()
      }
      
      // Convert tool calls to actions for backward compatibility
      const toolActions = convertToolCallsToActions(
        llmResponse.toolCalls, 
        input.fromPhone, 
        userCtx.found ? userCtx.userId : undefined
      )
      
      // Add converted actions with proper type validation
      for (const action of toolActions) {
        if (action.type === 'send_magic_link' && typeof action.userId === 'number') {
          actions.push({
            type: 'send_magic_link',
            userId: action.userId,
            phoneNumber: action.phoneNumber,
            linkType: (action.linkType as 'claimPortal' | 'documentUpload') || 'claimPortal'
          })
        } else if (action.type === 'send_sms' && action.text) {
          actions.push({
            type: 'send_sms',
            phoneNumber: action.phoneNumber,
            text: action.text
          })
        } else if (action.type === 'send_review_link') {
          actions.push({
            type: 'send_review_link',
            phoneNumber: action.phoneNumber
          })
        }
      }
      
      // Generate idempotency key from tool calls for consistency
      if (llmResponse.toolCalls.length > 0) {
        const toolCallSummary = llmResponse.toolCalls.map(tc => `${tc.name}:${JSON.stringify(tc.arguments)}`).join('|')
        idempotencyKey = crypto.createHash('sha256')
          .update(`${input.fromPhone}:${replyText}:${toolCallSummary}`)
          .digest('hex').slice(0, 32)
      }
      
    } else {
      // Legacy JSON response handling (existing logic)
      console.log('AI SMS | 📜 Processing JSON response')
      
      try {
        const parsed = JSON.parse(llmResponse.content || '{}')
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
        
      // Single message mode - no multi-message followups needed
      // All actions execute immediately
        
      } catch (error) {
        // If JSON parsing fails, degrade gracefully
        console.warn('AI SMS | ⚠️ JSON parsing failed:', error)
        replyText = String(llmResponse.content || '').replace(/^"|"$/g, '')
      }
    }
    
    // Apply intelligent response enhancement (works for both tool calling and JSON responses)
    if (replyText && shouldEnhanceResponse(replyText, input.message)) {
      try {
        const enhanced = await enhanceResponse(replyText, input.message, input.fromPhone)
        
        // Build enhanced response with value additions
        const enhancedParts = [enhanced.coreAnswer]
        if (enhanced.additionalValue.length > 0) {
          enhancedParts.push(...enhanced.additionalValue)
        }
        enhancedParts.push(enhanced.callToAction)
        
        replyText = enhancedParts.join(' ')
        
        console.log('AI SMS | 💎 Enhanced response with value additions', {
          phone: input.fromPhone.substring(0, 8) + '***',
          questionType: enhanced.questionType,
          ctaVariant: enhanced.ctaVariant,
          responseType: llmResponse.type,
          enhancedLength: replyText.length
        })
        
      } catch (error) {
        console.warn('AI SMS | ⚠️ Response enhancement failed, using original:', error)
        // Keep original response if enhancement fails
      }
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

    // Intelligent personalization that considers conversation context
    const smartPersonalizationResult = await smartPersonalize({
      phone: input.fromPhone,
      firstName: userCtx.firstName,
      userFound: userCtx.found,
      replyText
    })
    
    const personalized = smartPersonalizationResult.personalizedText
    
    // Record AI link actions for future intelligence
    await recordAILinkAction(input.fromPhone, personalized)

    // Intelligent multi-turn conversation planning (disabled - immediate responses only)
    console.log('AI SMS | ℹ️ Conversation planning disabled - using immediate response system')
    
    // REMOVED: Legacy follow-up scheduling code - all messages sent immediately
    console.log('AI SMS | ✅ All actions execute immediately (follow-up service removed)')

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

    // Store enhanced conversation insights for future intelligence
    try {
      await analyzeAndStoreConversationInsights(
        input.fromPhone,
        input.message,
        recentMessages
      )
    } catch (error) {
      console.warn('AI SMS | ⚠️ Failed to store conversation insights:', error)
    }
    
    } // Close the else block
    
    // Ensure personalized is defined before return
    if (!personalized) {
      personalized = replyText || 'I\'m here to help with your claim. What can I assist you with?'
    }
    
    // REMOVED: followups field from return - immediate response system only
    return { reply: { text: personalized }, actions, idempotencyKey }
  }

  async getUserSignalsForRouting(fromPhone: string) {
    const ctx = await this.contextBuilder.buildFromPhone(fromPhone)
    const hasSignature = ctx.queueType === 'unsigned_users' ? false : ctx.queueType ? true : null
    return {
      found: ctx.found,
      hasSignature,
      pendingRequirements: ctx.pendingRequirementTypes?.length || 0
    }
  }

  /**
   * Execute AI-decided actions immediately (no scheduling)
   */
  private async executeAIActions(
    aiActions: Array<{
      type: 'send_magic_link' | 'send_portal_link' | 'send_review_link' | 'schedule_followup' | 'schedule_callback' | 'none'
      reasoning: string
      confidence: number
    }>,
    phoneNumber: string,
    userCtx: any,
    actions: AgentAction[],
    followups: Array<{ text: string; delaySec?: number }> // Kept for compatibility but unused
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
      try {
        console.log(`AI SMS | 🎯 Executing AI action immediately: ${actionDecision.type}`, {
          reasoning: actionDecision.reasoning,
          confidence: actionDecision.confidence
        })

        // Execute action through registry (immediate execution)
        const result = await actionRegistry.execute(
          actionDecision.type,
          executionContext,
          {
            reasoning: actionDecision.reasoning,
            confidence: actionDecision.confidence
          }
        )

        if (result.success) {
          // All actions execute immediately - no follow-up scheduling needed
          console.log(`AI SMS | ✅ Action executed immediately: ${actionDecision.type}`, {
            trackingId: result.trackingId,
            reasoning: result.reasoning
          })

        } else {
          console.error(`AI SMS | ❌ Action failed: ${actionDecision.type}`, {
            error: result.error,
            reasoning: result.reasoning
          })
        }

      } catch (error) {
        console.error(`AI SMS | ❌ Action execution error: ${actionDecision.type}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          reasoning: actionDecision.reasoning
        })
      }
    }
  }
}