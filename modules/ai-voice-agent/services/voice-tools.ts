/**
 * Voice Agent Tools
 * 
 * Tools available to the AI voice agent for claim operations
 * Based on OpenAI Realtime Agents patterns
 */

export const voiceAgentTools = [
  {
    type: 'function',
    function: {
      name: 'check_claim_status',
      description: 'Check the current status of a claim',
      parameters: {
        type: 'object',
        properties: {
          claim_reference: {
            type: 'string',
            description: 'The claim reference number'
          }
        },
        required: ['claim_reference']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'schedule_callback',
      description: 'Schedule a callback for the customer',
      parameters: {
        type: 'object',
        properties: {
          preferred_time: {
            type: 'string',
            description: 'Preferred callback time (e.g., "tomorrow at 2pm")'
          },
          reason: {
            type: 'string',
            description: 'Reason for the callback'
          }
        },
        required: ['preferred_time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_information',
      description: 'Send information to the customer via SMS or email',
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['sms', 'email'],
            description: 'How to send the information'
          },
          content_type: {
            type: 'string',
            enum: ['portal_link', 'claim_update', 'documents_needed'],
            description: 'Type of information to send'
          }
        },
        required: ['method', 'content_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'transfer_to_human',
      description: 'Transfer the call to a human agent when needed',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for transfer'
          },
          urgency: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Urgency level'
          }
        },
        required: ['reason']
      }
    }
  }
]

/**
 * Tool execution logic
 * Maps tool calls to actual operations
 */
export async function executeVoiceTool(
  toolName: string, 
  args: any,
  context: { callSid: string; from: string; agentId?: string }
): Promise<any> {
  console.log(`🔧 [VOICE-TOOL] Executing ${toolName}`, { args, context })

  switch (toolName) {
    case 'check_claim_status':
      // In production, this would query the database
      return {
        success: true,
        status: 'under_review',
        last_updated: new Date().toISOString(),
        message: 'Your claim is currently under review. We expect to have an update within 2-3 business days.'
      }

    case 'schedule_callback':
      // In production, this would create a callback record
      return {
        success: true,
        scheduled_time: args.preferred_time,
        confirmation: `I've scheduled a callback for ${args.preferred_time}. You'll receive a confirmation SMS shortly.`
      }

    case 'send_information':
      // In production, this would trigger SMS/email service
      return {
        success: true,
        method: args.method,
        message: `I'll send that information to you via ${args.method} right away.`
      }

    case 'transfer_to_human':
      // In production, this would initiate transfer via Twilio
      return {
        success: true,
        transfer_initiated: true,
        message: 'I\'m transferring you to a specialist who can better assist you. Please hold.'
      }

    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`
      }
  }
}

/**
 * Generate instructions based on agent state
 * Inspired by OpenAI Agents SDK patterns
 */
export function generateDynamicInstructions(context: {
  isAuthenticated: boolean
  claimStatus?: string
  previousInteractions?: number
}): string {
  const base = `You are a helpful AI assistant for Resolve My Claim.`
  
  const authentication = context.isAuthenticated 
    ? `The customer is authenticated.`
    : `Please verify the customer's identity by asking for their claim reference number.`
  
  const history = context.previousInteractions && context.previousInteractions > 0
    ? `This customer has called ${context.previousInteractions} times before.`
    : `This is the customer's first call.`
  
  return `${base}
${authentication}
${history}

Guidelines:
- Be warm and empathetic
- Speak naturally and allow interruptions
- Keep initial responses brief
- Ask clarifying questions when needed
- Use available tools to help the customer
- Transfer to a human agent for complex issues`
}
