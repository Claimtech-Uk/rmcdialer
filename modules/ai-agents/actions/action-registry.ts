// AI Agent Action Registry
// Central registry for all AI agent actions with discovery and execution

import { SMSService } from '@/modules/communications/services/sms.service'
import { MagicLinkService } from '@/modules/communications/services/magic-link.service'
import { sendPortalLinkAction, type PortalLinkActionParams, type PortalLinkActionResult } from './send-portal-link.action'
import { sendSmsAction } from './send-sms.action'
import { logger } from '@/modules/core'

export type ActionType = 
  | 'send_portal_link'
  | 'send_magic_link'  // Include both for compatibility
  | 'send_sms' 
  | 'send_review_link'
  | 'schedule_followup'
  | 'none'

export type ActionExecutionContext = {
  smsService: SMSService
  magicLinkService?: MagicLinkService
  userContext?: {
    userId?: number
    phoneNumber: string
    userName?: string
    found: boolean
  }
  conversationContext?: {
    reasoning?: string
    confidence?: number
    fromE164?: string
  }
}

export type ActionResult = {
  success: boolean
  actionType: ActionType
  data?: any
  error?: string
  reasoning?: string
  trackingId?: string
}

export type ActionDefinition = {
  type: ActionType
  name: string
  description: string
  requiredParams: string[]
  optionalParams: string[]
  execute: (context: ActionExecutionContext, params: any) => Promise<ActionResult>
}

/**
 * Central registry of all AI agent actions
 */
export class ActionRegistry {
  private actions: Map<ActionType, ActionDefinition> = new Map()

  constructor() {
    this.registerDefaultActions()
  }

  /**
   * Register default actions
   */
  private registerDefaultActions() {
    // Portal Link Action
    this.register({
      type: 'send_portal_link',
      name: 'Send Portal Link',
      description: 'Send a secure portal link to user for claim access, document upload, or profile updates',
      requiredParams: ['userId', 'phoneNumber'],
      optionalParams: ['userName', 'linkType', 'customMessage', 'reasoning'],
      execute: async (context: ActionExecutionContext, params: PortalLinkActionParams): Promise<ActionResult> => {
        try {
          if (!context.userContext?.userId) {
            return {
              success: false,
              actionType: 'send_portal_link',
              error: 'User ID required for portal links',
              reasoning: 'Cannot send portal link without valid user'
            }
          }

          const actionParams: PortalLinkActionParams = {
            userId: context.userContext.userId,
            phoneNumber: params.phoneNumber || context.userContext.phoneNumber,
            userName: params.userName || context.userContext.userName,
            linkType: params.linkType || 'claimPortal',
            customMessage: params.customMessage,
            reasoning: context.conversationContext?.reasoning || params.reasoning,
            aiDecisionConfidence: context.conversationContext?.confidence,
            fromE164: context.conversationContext?.fromE164
          }

          const result = await sendPortalLinkAction(
            context.smsService,
            actionParams,
            context.magicLinkService
          )

          return {
            success: result.success,
            actionType: 'send_portal_link',
            data: {
              linkUrl: result.linkUrl,
              messageId: result.messageId,
              trackingId: result.trackingId
            },
            error: result.error,
            reasoning: result.reasoning,
            trackingId: result.trackingId
          }

        } catch (error) {
          return {
            success: false,
            actionType: 'send_portal_link',
            error: error instanceof Error ? error.message : 'Portal link action failed',
            reasoning: 'Unexpected error in portal link execution'
          }
        }
      }
    })

    // SMS Action  
    this.register({
      type: 'send_sms',
      name: 'Send SMS',
      description: 'Send a follow-up SMS message to the user',
      requiredParams: ['phoneNumber', 'text'],
      optionalParams: ['userId', 'fromE164'],
      execute: async (context: ActionExecutionContext, params: any): Promise<ActionResult> => {
        try {
          const result = await sendSmsAction(context.smsService, {
            phoneNumber: params.phoneNumber || context.userContext?.phoneNumber,
            text: params.text,
            fromE164: params.fromE164 || context.conversationContext?.fromE164,
            userId: params.userId || context.userContext?.userId
          })

          return {
            success: true,
            actionType: 'send_sms',
            data: {
              messageId: result.messageId,
              twilioSid: result.twilioSid
            },
            reasoning: `SMS sent: ${params.text?.substring(0, 50)}...`
          }

        } catch (error) {
          return {
            success: false,
            actionType: 'send_sms',
            error: error instanceof Error ? error.message : 'SMS send failed',
            reasoning: 'Failed to send follow-up SMS'
          }
        }
      }
    })

    // Review Link Action (placeholder)
    this.register({
      type: 'send_review_link',
      name: 'Send Review Link',
      description: 'Send a Trustpilot review link to satisfied users',
      requiredParams: ['phoneNumber'],
      optionalParams: ['userName'],
      execute: async (context: ActionExecutionContext, params: any): Promise<ActionResult> => {
        try {
          const userName = params.userName || context.userContext?.userName || 'there'
          const reviewMessage = `Hi ${userName}, we'd love your feedback! Please leave a review: https://uk.trustpilot.com/review/resolvemyclaim.co.uk`

          const result = await sendSmsAction(context.smsService, {
            phoneNumber: params.phoneNumber || context.userContext?.phoneNumber,
            text: reviewMessage,
            fromE164: context.conversationContext?.fromE164,
            userId: context.userContext?.userId
          })

          return {
            success: true,
            actionType: 'send_review_link',
            data: {
              messageId: result.messageId,
              reviewUrl: 'https://uk.trustpilot.com/review/resolvemyclaim.co.uk'
            },
            reasoning: 'Review link sent to satisfied user'
          }

        } catch (error) {
          return {
            success: false,
            actionType: 'send_review_link',
            error: error instanceof Error ? error.message : 'Review link send failed',
            reasoning: 'Failed to send review link'
          }
        }
      }
    })

    // No Action
    this.register({
      type: 'none',
      name: 'No Action',
      description: 'Continue conversation without taking any specific action',
      requiredParams: [],
      optionalParams: ['reasoning'],
      execute: async (context: ActionExecutionContext, params: any): Promise<ActionResult> => {
        return {
          success: true,
          actionType: 'none',
          reasoning: params.reasoning || 'Continuing conversation without action'
        }
      }
    })
  }

  /**
   * Register a new action
   */
  register(action: ActionDefinition) {
    this.actions.set(action.type, action)
    logger.info('Action registered', {
      type: action.type,
      name: action.name,
      requiredParams: action.requiredParams
    })
  }

  /**
   * Get action by type
   */
  get(type: ActionType): ActionDefinition | undefined {
    return this.actions.get(type)
  }

  /**
   * List all available actions
   */
  list(): ActionDefinition[] {
    return Array.from(this.actions.values())
  }

  /**
   * Execute an action
   */
  async execute(
    type: ActionType,
    context: ActionExecutionContext,
    params: any = {}
  ): Promise<ActionResult> {
    const action = this.get(type)
    
    if (!action) {
      return {
        success: false,
        actionType: type,
        error: `Unknown action type: ${type}`,
        reasoning: 'Action not found in registry'
      }
    }

    try {
      logger.info('Executing action', {
        type,
        name: action.name,
        hasParams: Object.keys(params).length > 0,
        reasoning: context.conversationContext?.reasoning
      })

      const result = await action.execute(context, params)
      
      logger.info('Action executed', {
        type,
        success: result.success,
        error: result.error,
        reasoning: result.reasoning
      })

      return result

    } catch (error) {
      logger.error('Action execution failed', {
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        success: false,
        actionType: type,
        error: error instanceof Error ? error.message : 'Action execution failed',
        reasoning: 'Unexpected error during action execution'
      }
    }
  }

  /**
   * Get action capabilities for AI
   */
  getCapabilities(): Array<{
    type: ActionType
    name: string
    description: string
    params: { required: string[]; optional: string[] }
  }> {
    return this.list().map(action => ({
      type: action.type,
      name: action.name,
      description: action.description,
      params: {
        required: action.requiredParams,
        optional: action.optionalParams
      }
    }))
  }
}

// Global registry instance
export const actionRegistry = new ActionRegistry()
