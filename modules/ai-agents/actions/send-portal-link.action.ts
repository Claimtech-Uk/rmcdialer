// Comprehensive Portal Link Action for AI Agent
// Handles generation, sending, tracking, and error handling

import { SMSService } from '@/modules/communications/services/sms.service'
import { MagicLinkService } from '@/modules/communications/services/magic-link.service'
import { generateAIMagicLink, formatMagicLinkForSMS } from '../core/ai-magic-link-generator'
import { logger } from '@/modules/core'
import { recordAILinkAction } from '../core/intelligent-personalization'

export type PortalLinkActionResult = {
  success: boolean
  linkUrl?: string
  messageId?: string
  trackingId?: string
  error?: string
  reasoning?: string
}

export type PortalLinkActionParams = {
  userId: number
  phoneNumber: string
  userName?: string
  linkType?: 'claimPortal' | 'documentUpload' | 'profileUpdate'
  customMessage?: string
  reasoning?: string
  aiDecisionConfidence?: number
  fromE164?: string
}

/**
 * AI Portal Link Action - Intelligent link generation and sending
 * Integrates all magic link functionality into one AI-friendly action
 */
export class PortalLinkAction {
  constructor(
    private smsService: SMSService,
    private magicLinkService?: MagicLinkService
  ) {}

  /**
   * Execute the portal link action with full intelligence
   */
  async execute(params: PortalLinkActionParams): Promise<PortalLinkActionResult> {
    const startTime = Date.now()
    
    try {
      logger.info('AI Portal Link Action starting', {
        userId: params.userId,
        phoneNumber: params.phoneNumber.substring(0, 8) + '***',
        linkType: params.linkType || 'claimPortal',
        reasoning: params.reasoning,
        confidence: params.aiDecisionConfidence
      })

      // Step 1: Generate the magic link
      const linkResult = await this.generatePortalLink(params)
      if (!linkResult.success) {
        return linkResult
      }

      // Step 2: Send via SMS with intelligent message crafting
      const smsResult = await this.sendPortalLinkSMS(params, linkResult.linkUrl!)
      if (!smsResult.success) {
        return smsResult
      }

      // Step 3: Record AI action for learning
      await this.recordAIAction(params, linkResult.linkUrl!, smsResult.messageId!)

      const duration = Date.now() - startTime
      logger.info('AI Portal Link Action completed successfully', {
        userId: params.userId,
        trackingId: linkResult.trackingId,
        messageId: smsResult.messageId,
        durationMs: duration,
        reasoning: params.reasoning
      })

      return {
        success: true,
        linkUrl: linkResult.linkUrl,
        messageId: smsResult.messageId,
        trackingId: linkResult.trackingId,
        reasoning: `Portal link sent successfully - ${params.reasoning || 'AI decision'}`
      }

    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('AI Portal Link Action failed', {
        userId: params.userId,
        phoneNumber: params.phoneNumber.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
        reasoning: params.reasoning
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send portal link',
        reasoning: `Portal link failed - ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Generate the portal link using the most appropriate method
   */
  private async generatePortalLink(params: PortalLinkActionParams): Promise<PortalLinkActionResult> {
    try {
      // Use the comprehensive MagicLinkService if available
      if (this.magicLinkService) {
        const result = await this.magicLinkService.generateMagicLink({
          userId: params.userId,
          linkType: params.linkType || 'claimPortal',
          deliveryMethod: 'sms', // Required by interface
          expiresInHours: 48
        })

        return {
          success: true,
          linkUrl: result.url,
          trackingId: result.trackingId
        }
      }

      // Fallback to AI-specific generator
      const aiLink = generateAIMagicLink(params.userId)
      return {
        success: true,
        linkUrl: aiLink.url,
        trackingId: aiLink.trackingId
      }

    } catch (error) {
      logger.error('Portal link generation failed', {
        userId: params.userId,
        linkType: params.linkType,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate portal link'
      }
    }
  }

  /**
   * Send the portal link via SMS with intelligent message crafting
   */
  private async sendPortalLinkSMS(params: PortalLinkActionParams, linkUrl: string): Promise<PortalLinkActionResult> {
    try {
      // Craft intelligent message based on context
      const message = this.craftIntelligentMessage(params, linkUrl)
      
      // Send via SMS service
      const result = await this.smsService.sendSMS({
        phoneNumber: params.phoneNumber,
        message,
        messageType: 'magic_link',
        userId: params.userId,
        fromNumberOverride: params.fromE164
      })

      return {
        success: true,
        messageId: result.messageId
      }

    } catch (error) {
      logger.error('Portal link SMS sending failed', {
        userId: params.userId,
        phoneNumber: params.phoneNumber.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS'
      }
    }
  }

  /**
   * Craft intelligent SMS message based on context and user
   */
  private craftIntelligentMessage(params: PortalLinkActionParams, linkUrl: string): string {
    const formattedUrl = formatMagicLinkForSMS(linkUrl)
    const userName = params.userName || 'there'

    // Custom message override
    if (params.customMessage) {
      return params.customMessage.includes('{LINK}') 
        ? params.customMessage.replace('{LINK}', formattedUrl)
        : `${params.customMessage}\n\n${formattedUrl}`
    }

    // Intelligent message based on link type
    switch (params.linkType) {
      case 'documentUpload':
        return `Hi ${userName}, here's your secure portal to upload required documents:\n\n${formattedUrl}\n\nClick to upload your ID, proof of address, or other required items. Questions? Just reply!`

      case 'profileUpdate':
        return `Hi ${userName}, update your profile securely here:\n\n${formattedUrl}\n\nKeep your details current for faster processing. Any questions, just ask!`

      case 'claimPortal':
      default:
        return `Hi ${userName}, here's your secure portal link:\n\n${formattedUrl}\n\nClick to provide your signature, ID, and required information. Questions? Just reply!`
    }
  }

  /**
   * Record AI action for future learning and analytics
   */
  private async recordAIAction(params: PortalLinkActionParams, linkUrl: string, messageId: string): Promise<void> {
    try {
      // Use existing AI action recording
      await recordAILinkAction(
        params.phoneNumber,
        `Portal link sent to ${params.userName || 'user'} - ${params.reasoning || 'AI decision'}`
      )

      // Additional logging for AI learning
      logger.info('AI action recorded for learning', {
        action: 'send_portal_link',
        userId: params.userId,
        confidence: params.aiDecisionConfidence,
        reasoning: params.reasoning,
        messageId,
        linkType: params.linkType || 'claimPortal'
      })

    } catch (error) {
      // Non-critical - don't fail the main action
      logger.warn('Failed to record AI action (non-critical)', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Convenience function for AI agents to send portal links
 */
export async function sendPortalLinkAction(
  smsService: SMSService,
  params: PortalLinkActionParams,
  magicLinkService?: MagicLinkService
): Promise<PortalLinkActionResult> {
  const action = new PortalLinkAction(smsService, magicLinkService)
  return action.execute(params)
}

/**
 * Quick portal link sender for simple use cases
 */
export async function quickPortalLink(
  smsService: SMSService,
  userId: number,
  phoneNumber: string,
  userName?: string,
  reasoning?: string
): Promise<PortalLinkActionResult> {
  return sendPortalLinkAction(smsService, {
    userId,
    phoneNumber,
    userName,
    reasoning,
    linkType: 'claimPortal'
  })
}
