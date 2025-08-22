/**
 * Voice Agent Tools
 * 
 * Tools available to the AI voice agent for claim operations
 * Simplified set with placeholders for testing
 */

export const voiceAgentTools = [
  {
    type: 'function',
    function: {
      name: 'schedule_callback',
      description: 'Schedule a callback for the customer at their preferred time',
      parameters: {
        type: 'object',
        properties: {
          preferred_time: {
            type: 'string',
            description: 'When the customer wants to be called back (e.g., "tomorrow at 2pm", "Monday morning")'
          },
          reason: {
            type: 'string',
            description: 'Why they need a callback'
          }
        },
        required: ['preferred_time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_review_link',
      description: 'Send a link for the customer to leave a review about their experience',
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['sms', 'email'],
            description: 'How to send the review link'
          }
        },
        required: ['method']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_portal_link',
      description: 'Send a magic link to access the customer portal',
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['sms', 'email'],
            description: 'How to send the portal link'
          }
        },
        required: ['method']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_user_details',
      description: 'Look up and verify customer information',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'Customer phone number'
          },
          claim_reference: {
            type: 'string',
            description: 'Claim reference if provided'
          }
        },
        required: ['phone_number']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_claim_details',
      description: 'Get detailed information about a specific claim',
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
      name: 'check_requirements',
      description: 'Check what documents or information are still needed for the claim',
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
  }
]

/**
 * Tool execution logic - PLACEHOLDER IMPLEMENTATIONS
 * These will be connected to real services in production
 */
export async function executeVoiceTool(
  toolName: string, 
  args: any,
  context: { callSid: string; from: string; agentId?: string }
): Promise<any> {
  console.log(`🔧 [VOICE-TOOL] Executing ${toolName}`, { args, context })

  switch (toolName) {
    case 'schedule_callback':
      // PLACEHOLDER: In production, creates callback in database
      return {
        success: true,
        scheduled_time: args.preferred_time,
        confirmation: `I've scheduled a callback for ${args.preferred_time}. You'll receive a confirmation SMS shortly.`
      }

    case 'send_review_link':
      // PLACEHOLDER: In production, sends actual review link via SMS/email
      return {
        success: true,
        method: args.method,
        message: `I've sent the review link to you via ${args.method}. Thank you for your feedback!`
      }

    case 'send_portal_link':
      // PLACEHOLDER: In production, generates magic link and sends it
      return {
        success: true,
        method: args.method,
        portal_url: 'https://dev.solvosolutions.co.uk/claims',
        message: `I've sent you a secure link to access your claim portal via ${args.method}.`
      }

    case 'check_user_details':
      // PLACEHOLDER: In production, queries user database
      return {
        success: true,
        user_found: true,
        name: 'John Smith',
        phone: context.from,
        claims_count: 1,
        message: 'I found your account with one active claim.'
      }

    case 'check_claim_details':
      // PLACEHOLDER: In production, queries claim database
      return {
        success: true,
        claim_reference: args.claim_reference,
        status: 'under_review',
        lender: 'Example Lender',
        amount: '£2,500',
        submitted_date: '2024-01-15',
        last_update: '2024-01-20',
        message: 'Your claim is currently under review with Example Lender.'
      }

    case 'check_requirements':
      // PLACEHOLDER: In production, checks missing documents
      return {
        success: true,
        claim_reference: args.claim_reference,
        requirements_complete: false,
        missing_items: [
          'Bank statement from last 3 months',
          'Proof of PPI payment'
        ],
        message: 'You still need to provide 2 documents to complete your claim.'
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
