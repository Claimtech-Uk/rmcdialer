/**
 * Voice Action Registry
 * Handles all business actions for voice calls (OpenAI Realtime & Hume EVI)
 * Separated from main app actions for voice-specific implementations
 */

import { scheduleCallbackAction } from './actions/schedule-callback.js'
import { sendPortalLinkAction } from './actions/send-portal-link.js'
import { sendReviewLinkAction } from './actions/send-review-link.js'
import { checkUserDetailsAction } from './actions/check-user-details.js'
import { checkClaimDetailsAction } from './actions/check-claim-details.js'
import { checkRequirementsAction } from './actions/check-requirements.js'
import { sendDocumentLinkAction } from './actions/send-document-link.js'

export class VoiceActionRegistry {
  constructor() {
    this.actions = new Map()
    this.registerActions()
  }

  registerActions() {
    // Register all available voice actions
    this.register('schedule_callback', {
      name: 'Schedule Callback',
      description: 'Schedule a callback for the customer at their preferred time',
      handler: scheduleCallbackAction,
      parameters: {
        required: ['preferred_time'],
        optional: ['reason']
      }
    })

    this.register('send_portal_link', {
      name: 'Send Portal Link', 
      description: 'Send a secure portal access link via SMS or email',
      handler: sendPortalLinkAction,
      parameters: {
        required: ['method'],
        optional: ['link_type']
      }
    })

    this.register('send_review_link', {
      name: 'Send Review Link',
      description: 'Send a Trustpilot review link to satisfied customers',
      handler: sendReviewLinkAction,
      parameters: {
        required: ['method'],
        optional: []
      }
    })

    this.register('check_user_details', {
      name: 'Check User Details',
      description: 'Look up customer information and claims status',
      handler: checkUserDetailsAction,
      parameters: {
        required: ['phone_number'],
        optional: ['claim_reference']
      }
    })

    this.register('check_claim_details', {
      name: 'Check Claim Details', 
      description: 'Get detailed information about a specific claim',
      handler: checkClaimDetailsAction,
      parameters: {
        required: ['claim_reference'],
        optional: []
      }
    })

    this.register('check_requirements', {
      name: 'Check Requirements',
      description: 'Check what documents or information are still needed',
      handler: checkRequirementsAction,
      parameters: {
        required: ['claim_reference'],
        optional: []
      }
    })

    this.register('send_document_link', {
      name: 'Send Document Upload Link',
      description: 'Send a link for document upload',
      handler: sendDocumentLinkAction,
      parameters: {
        required: ['method'],
        optional: ['document_type']
      }
    })
  }

  register(actionName, actionConfig) {
    this.actions.set(actionName, actionConfig)
    console.log(`🔧 [VOICE-ACTIONS] Registered: ${actionName}`)
  }

  async execute(actionName, context, parameters) {
    const startTime = Date.now()
    
    try {
      const action = this.actions.get(actionName)
      
      if (!action) {
        return {
          success: false,
          error: `Unknown action: ${actionName}`,
          execution_time_ms: Date.now() - startTime
        }
      }

      console.log(`🎙️ [VOICE-ACTION] Executing ${actionName}`, {
        callSid: context.callSid,
        from: context.from,
        parameters: this.sanitizeParametersForLog(parameters)
      })

      // Execute the action handler
      const result = await action.handler(context, parameters)

      const executionTime = Date.now() - startTime
      
      console.log(`✅ [VOICE-ACTION] Completed ${actionName}`, {
        success: result.success,
        executionTime: `${executionTime}ms`,
        callSid: context.callSid
      })

      return {
        ...result,
        action: actionName,
        execution_time_ms: executionTime
      }

    } catch (error) {
      const executionTime = Date.now() - startTime
      
      console.error(`❌ [VOICE-ACTION] Failed ${actionName}:`, {
        error: error.message,
        stack: error.stack,
        callSid: context.callSid,
        executionTime: `${executionTime}ms`
      })

      return {
        success: false,
        error: error.message,
        action: actionName,
        execution_time_ms: executionTime
      }
    }
  }

  // Get all actions in OpenAI function format
  getOpenAIFunctions() {
    const functions = []
    
    for (const [actionName, config] of this.actions) {
      functions.push({
        type: 'function',
        function: {
          name: actionName,
          description: config.description,
          parameters: {
            type: 'object',
            properties: this.buildOpenAIParameters(actionName, config.parameters),
            required: config.parameters.required
          }
        }
      })
    }

    return functions
  }

  // Get all actions in Hume EVI format  
  getHumeFunctions() {
    const functions = []
    
    for (const [actionName, config] of this.actions) {
      functions.push({
        tool_type: 'function_call',
        name: actionName,
        description: config.description,
        parameters: {
          type: 'object',
          properties: this.buildHumeParameters(actionName, config.parameters),
          required: config.parameters.required
        }
      })
    }

    return functions
  }

  buildOpenAIParameters(actionName, paramConfig) {
    const properties = {}

    // Common parameters based on action type
    switch (actionName) {
      case 'schedule_callback':
        properties.preferred_time = {
          type: 'string',
          description: 'When the customer wants to be called back (e.g., "tomorrow at 2pm", "Monday morning")'
        }
        properties.reason = {
          type: 'string', 
          description: 'Why they need a callback'
        }
        break

      case 'send_portal_link':
      case 'send_review_link':
      case 'send_document_link':
        properties.method = {
          type: 'string',
          enum: ['sms', 'email'],
          description: 'How to send the link'
        }
        if (actionName === 'send_portal_link') {
          properties.link_type = {
            type: 'string',
            enum: ['claims', 'documents', 'status'],
            description: 'Type of portal access'
          }
        }
        break

      case 'check_user_details':
        properties.phone_number = {
          type: 'string',
          description: 'Customer phone number to lookup'
        }
        properties.claim_reference = {
          type: 'string',
          description: 'Optional claim reference for context'
        }
        break

      case 'check_claim_details':
      case 'check_requirements':
        properties.claim_reference = {
          type: 'string',
          description: 'The claim reference number'
        }
        break
    }

    return properties
  }

  buildHumeParameters(actionName, paramConfig) {
    // For Hume EVI, use the same parameter structure as OpenAI
    return this.buildOpenAIParameters(actionName, paramConfig)
  }

  sanitizeParametersForLog(parameters) {
    // Remove or mask sensitive data from logs
    const sanitized = { ...parameters }
    
    if (sanitized.phone_number) {
      sanitized.phone_number = sanitized.phone_number.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
    }
    
    return sanitized
  }

  listActions() {
    const actionList = []
    
    for (const [actionName, config] of this.actions) {
      actionList.push({
        name: actionName,
        description: config.description,
        required_params: config.parameters.required,
        optional_params: config.parameters.optional
      })
    }

    return actionList
  }
}

// Global registry instance for voice services
export const voiceActionRegistry = new VoiceActionRegistry()
