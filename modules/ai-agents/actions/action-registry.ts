// AI Agent Action Registry
// Central registry for all AI agent actions with discovery and execution

import { SMSService } from '@/modules/communications/services/sms.service'
import { MagicLinkService } from '@/modules/communications/services/magic-link.service'
import { sendPortalLinkAction, type PortalLinkActionParams, type PortalLinkActionResult } from './send-portal-link.action'
import { sendSmsAction } from './send-sms.action'
import { sendReviewLinkAction } from './send-review-link.action'
import { sendCaseStatusLinkAction } from './send-case-status-link.action'
import { sendDocumentUploadLinkAction } from './send-document-upload-link.action'
import { sendSignupLinkAction } from './send-signup-link.action'
import { scheduleCallbackAction } from './schedule-callback.action'
import { logger } from '@/modules/core'

export type ActionType = 
  | 'send_portal_link'
  | 'send_magic_link'  // Include both for compatibility
  | 'send_sms' 
  | 'send_case_status_link'
  | 'send_document_upload_link'
  | 'send_review_link'
  | 'send_signup_link'
  | 'schedule_followup'
  | 'schedule_callback'
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
    // Portal Link Action (supports both send_portal_link and send_magic_link)
    this.register({
      type: 'send_portal_link',
      name: 'Send Portal Link',
      description: 'Send a secure portal link to user for claim access, document upload, or profile updates',
      requiredParams: ['userId', 'phoneNumber'],
      optionalParams: ['userName', 'linkType', 'customMessage', 'reasoning'],
      execute: async (context: ActionExecutionContext, params: PortalLinkActionParams): Promise<ActionResult> => {
        try {
          // For testing purposes, allow portal links even for unknown users
          const isTestUser = context.userContext?.phoneNumber?.includes('07700900001') || 
                           context.userContext?.phoneNumber?.includes('+447700900001') ||
                           context.userContext?.phoneNumber?.includes('+15005550006') ||
                           context.userContext?.phoneNumber?.includes('5005550006')
          
          if (!context.userContext?.userId && !isTestUser) {
            return {
              success: false,
              actionType: 'send_portal_link',
              error: 'User ID required for portal links',
              reasoning: 'Cannot send portal link without valid user'
            }
          }

          const actionParams: PortalLinkActionParams = {
            userId: context.userContext?.userId || (isTestUser ? 12345 : 0), // Use test ID for test users
            phoneNumber: params.phoneNumber || context.userContext?.phoneNumber || '',
            userName: params.userName || context.userContext?.userName || (isTestUser ? 'TestUser' : undefined),
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

    // Case Status Link Action - Clean delegation to action file
    this.register({
      type: 'send_case_status_link',
      name: 'Send Case Status Link',
      description: 'Send a secure link for users to review their case status, documents, and next steps',
      requiredParams: ['userId', 'phoneNumber'],
      optionalParams: ['userName', 'linkType', 'customMessage', 'reasoning'],
      execute: async (context: ActionExecutionContext, params: any): Promise<ActionResult> => {
        try {
          // For testing purposes, allow status links even for unknown users
          const isTestUser = context.userContext?.phoneNumber?.includes('07700900001') || 
                           context.userContext?.phoneNumber?.includes('+447700900001') ||
                           context.userContext?.phoneNumber?.includes('+15005550006') ||
                           context.userContext?.phoneNumber?.includes('5005550006') ||
                           context.userContext?.phoneNumber?.includes('447738585850') // James's number

          if (!context.userContext?.userId && !isTestUser) {
            return {
              success: false,
              actionType: 'send_case_status_link',
              error: 'User ID required for case status links',
              reasoning: 'Cannot send case status link without valid user'
            }
          }

          // Delegate to action file
          const result = await sendCaseStatusLinkAction(
            context.smsService,
            {
              userId: context.userContext?.userId || (isTestUser ? 2064 : 0), // Use James's ID for his number
              phoneNumber: params.phoneNumber || context.userContext?.phoneNumber || '',
              userName: params.userName || context.userContext?.userName || (isTestUser ? 'James' : undefined),
              linkType: params.linkType || 'statusUpdate',
              customMessage: params.customMessage,
              reasoning: context.conversationContext?.reasoning || params.reasoning || 'User requested case status review',
              fromE164: context.conversationContext?.fromE164
            },
            context.magicLinkService
          )

          return {
            success: result.success,
            actionType: 'send_case_status_link',
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
            actionType: 'send_case_status_link',
            error: error instanceof Error ? error.message : 'Case status link action failed',
            reasoning: 'Unexpected error in case status link execution'
          }
        }
      }
    })

    // Document Upload Link Action - Clean delegation to action file
    this.register({
      type: 'send_document_upload_link',
      name: 'Send Document Upload Link',
      description: 'Send a secure link for users to upload required documents (lower priority than signature)',
      requiredParams: ['userId', 'phoneNumber'],
      optionalParams: ['userName', 'linkType', 'customMessage', 'reasoning'],
      execute: async (context: ActionExecutionContext, params: any): Promise<ActionResult> => {
        try {
          // For testing purposes, allow document upload links even for unknown users
          const isTestUser = context.userContext?.phoneNumber?.includes('07700900001') || 
                           context.userContext?.phoneNumber?.includes('+447700900001') ||
                           context.userContext?.phoneNumber?.includes('+15005550006') ||
                           context.userContext?.phoneNumber?.includes('5005550006') ||
                           context.userContext?.phoneNumber?.includes('447738585850') // James's number

          if (!context.userContext?.userId && !isTestUser) {
            return {
              success: false,
              actionType: 'send_document_upload_link',
              error: 'User ID required for document upload links',
              reasoning: 'Cannot send document upload link without valid user'
            }
          }

          // Delegate to action file
          const result = await sendDocumentUploadLinkAction(
            context.smsService,
            {
              userId: context.userContext?.userId || (isTestUser ? 2064 : 0), // Use James's ID for his number
              phoneNumber: params.phoneNumber || context.userContext?.phoneNumber || '',
              userName: params.userName || context.userContext?.userName || (isTestUser ? 'James' : undefined),
              linkType: params.linkType || 'documentUpload',
              customMessage: params.customMessage,
              reasoning: context.conversationContext?.reasoning || params.reasoning || 'User requested document upload access',
              fromE164: context.conversationContext?.fromE164
            },
            context.magicLinkService
          )

          return {
            success: result.success,
            actionType: 'send_document_upload_link',
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
            actionType: 'send_document_upload_link',
            error: error instanceof Error ? error.message : 'Document upload link action failed',
            reasoning: 'Unexpected error in document upload link execution'
          }
        }
      }
    })

    // Review Link Action - Clean delegation to action file
    this.register({
      type: 'send_review_link',
      name: 'Send Trustpilot Review Link',
      description: 'Send a Trustpilot review link to satisfied users',
      requiredParams: ['phoneNumber'],
      optionalParams: ['userName'],
      execute: async (context: ActionExecutionContext, params: any): Promise<ActionResult> => {
        try {
          // Delegate to action file
          const result = await sendReviewLinkAction(context.smsService, {
            phoneNumber: params.phoneNumber || context.userContext?.phoneNumber,
            userName: params.userName || context.userContext?.userName,
            fromE164: context.conversationContext?.fromE164,
            userId: context.userContext?.userId
          })

          return {
            success: result.success,
            actionType: 'send_review_link',
            data: {
              messageId: result.messageId,
              reviewUrl: result.reviewUrl
            },
            error: result.error,
            reasoning: 'Trustpilot review link sent to satisfied user'
          }

        } catch (error) {
          return {
            success: false,
            actionType: 'send_review_link',
            error: error instanceof Error ? error.message : 'Review link send failed',
            reasoning: 'Failed to send Trustpilot review link'
          }
        }
      }
    })

    // Signup Link Action - For unknown users who need to register
    this.register({
      type: 'send_signup_link',
      name: 'Send Signup Link',
      description: 'Send signup link to users not found in system to direct them to registration',
      requiredParams: ['phoneNumber'],
      optionalParams: ['userName', 'customMessage', 'reasoning'],
      execute: async (context: ActionExecutionContext, params: any): Promise<ActionResult> => {
        try {
          // This action is specifically for unknown users, so we don't require userId
          // Delegate to action file
          const result = await sendSignupLinkAction(context.smsService, {
            phoneNumber: params.phoneNumber || context.userContext?.phoneNumber || '',
            userName: params.userName || context.userContext?.userName,
            customMessage: params.customMessage,
            reasoning: context.conversationContext?.reasoning || params.reasoning || 'User not found in system - sending signup link',
            fromE164: context.conversationContext?.fromE164
          })

          return {
            success: result.success,
            actionType: 'send_signup_link',
            data: {
              messageId: result.messageId
            },
            error: result.error,
            reasoning: result.reasoning || 'Signup link sent to unknown user for registration'
          }

        } catch (error) {
          return {
            success: false,
            actionType: 'send_signup_link',
            error: error instanceof Error ? error.message : 'Signup link send failed',
            reasoning: 'Failed to send signup link to unknown user'
          }
        }
      }
    })

    // Schedule Callback Action - Creates missed call entry for agent callback
    this.register({
      type: 'schedule_callback',
      name: 'Schedule Callback',
      description: 'Schedule a callback by creating a missed call entry with reason "a.i sms agent callback"',
      requiredParams: ['phoneNumber'],
      optionalParams: ['userId', 'userName', 'reason', 'requestedTime'],
      execute: async (context: ActionExecutionContext, params: any): Promise<ActionResult> => {
        try {
          // Delegate to action file
          const result = await scheduleCallbackAction(context.smsService, {
            userId: context.userContext?.userId || params.userId,
            phoneNumber: params.phoneNumber || context.userContext?.phoneNumber || '',
            userName: params.userName || context.userContext?.userName,
            reason: params.reason || 'User requested callback via AI SMS agent',
            requestedTime: params.requestedTime,
            fromE164: context.conversationContext?.fromE164
          })

          return {
            success: result.success,
            actionType: 'schedule_callback',
            data: {
              missedCallId: result.missedCallId
            },
            error: result.error,
            reasoning: result.reasoning
          }

        } catch (error) {
          return {
            success: false,
            actionType: 'schedule_callback',
            error: error instanceof Error ? error.message : 'Callback scheduling failed',
            reasoning: 'Unexpected error in callback scheduling execution'
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

    // Register send_magic_link as an alias for send_portal_link
    const portalLinkAction = this.actions.get('send_portal_link')!
    this.register({
      ...portalLinkAction,
      type: 'send_magic_link'
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
