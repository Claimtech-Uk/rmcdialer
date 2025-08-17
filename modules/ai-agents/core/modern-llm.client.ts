import OpenAI from 'openai'
import type { ChatCompletionTool, ChatCompletionMessage } from 'openai/resources'
import { isFeatureEnabled, logFeatureFlags } from '../config/feature-flags'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set')
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

// Modern tool definitions for SMS agent actions
export const SMS_AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'send_portal_link',
      description: 'Send a secure portal link to the user for document signing or uploads',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'number',
            description: 'The user ID to send the portal link to'
          },
          linkType: {
            type: 'string',
            enum: ['claimPortal', 'documentUpload'],
            description: 'Type of portal link to send'
          },
          reason: {
            type: 'string',
            description: 'Brief reason why the link is being sent (for logging)'
          },
          urgency: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            default: 'medium',
            description: 'Urgency level of the portal link'
          }
        },
        required: ['userId', 'linkType', 'reason']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_followup_sms',
      description: 'Send a follow-up SMS message to the user',
      parameters: {
        type: 'object',
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'Phone number to send SMS to'
          },
          message: {
            type: 'string',
            description: 'SMS message content'
          },
          delaySeconds: {
            type: 'number',
            description: 'Delay in seconds before sending (optional)',
            minimum: 0,
            maximum: 86400
          }
        },
        required: ['phoneNumber', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_review_link',
      description: 'Send a review link (Trustpilot) to the user for feedback',
      parameters: {
        type: 'object',
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'Phone number to send review link to'
          },
          trigger: {
            type: 'string',
            description: 'What triggered the review request',
            enum: ['claim_completed', 'user_satisfied', 'explicit_request']
          }
        },
        required: ['phoneNumber', 'trigger']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'schedule_callback',
      description: 'Schedule a callback or follow-up action',
      parameters: {
        type: 'object',
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'Phone number for the callback'
          },
          callbackType: {
            type: 'string',
            enum: ['status_update', 'document_reminder', 'general_followup'],
            description: 'Type of callback to schedule'
          },
          delayHours: {
            type: 'number',
            description: 'Hours to wait before callback',
            minimum: 1,
            maximum: 168
          },
          message: {
            type: 'string',
            description: 'Message to send with the callback'
          }
        },
        required: ['phoneNumber', 'callbackType', 'delayHours', 'message']
      }
    }
  }
]

export type ModernChatOptions = {
  messages: ChatCompletionMessage[]
  tools?: ChatCompletionTool[]
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  model?: string
  maxTokens?: number
  temperature?: number
}

export type ToolCall = {
  id: string
  name: string
  arguments: Record<string, any>
}

export type ModernChatResponse = {
  content: string | null
  toolCalls: ToolCall[]
  finishReason: 'stop' | 'tool_calls' | 'length' | null
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Modern LLM client with tool calling support
 * Designed to work alongside existing JSON response system
 */
export async function modernChat(options: ModernChatOptions): Promise<ModernChatResponse> {
  const model = options.model || process.env.AI_SMS_MODEL || 'gpt-4o-mini'
  
  console.log('AI SMS | 🔧 Using modern tool calling', {
    model,
    toolCount: options.tools?.length || 0,
    messageCount: options.messages.length
  })
  
  try {
    const response = await getClient().chat.completions.create({
      model,
      messages: options.messages,
      tools: options.tools,
      tool_choice: options.toolChoice || 'auto',
      max_completion_tokens: options.maxTokens || 325,  // Optimal balance for SMS
      temperature: options.temperature || 0.1
    })

    const choice = response.choices[0]
    const message = choice.message
    
    // Extract tool calls if present
    const toolCalls: ToolCall[] = []
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          try {
            const args = JSON.parse(toolCall.function.arguments)
            toolCalls.push({
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: args
            })
          } catch (error) {
            console.warn('AI SMS | ⚠️ Failed to parse tool arguments:', error)
          }
        }
      }
    }

    return {
      content: message.content,
      toolCalls,
      finishReason: choice.finish_reason as any,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      }
    }
    
  } catch (error) {
    console.error('AI SMS | ❌ Modern chat failed:', error)
    throw error
  }
}

/**
 * Hybrid approach: Try tool calling first, fallback to JSON response
 * This allows gradual migration without breaking existing functionality
 */
export async function hybridChat(options: {
  systemPrompt: string
  userPrompt: string
  tools?: ChatCompletionTool[]
  enableToolCalling?: boolean
  model?: string
}): Promise<{
  type: 'tool_calling' | 'json_response'
  content: string | null
  toolCalls: ToolCall[]
  fallbackUsed: boolean
}> {
  const enableToolCalling = options.enableToolCalling ?? isFeatureEnabled('TOOL_CALLING_ENABLED')
  
  // Log feature status for debugging
  if (isFeatureEnabled('VERBOSE_LOGGING')) {
    logFeatureFlags()
  }

  // If tool calling is disabled or no tools provided, use legacy JSON approach
  if (!enableToolCalling || !options.tools || options.tools.length === 0) {
    console.log('AI SMS | 📜 Using legacy JSON response (tool calling disabled)')
    
    // Import the existing chat function
    const { chat } = await import('./llm.client')
    const response = await chat({
      system: options.systemPrompt,
      user: options.userPrompt,
      model: options.model,
      responseFormat: { type: 'json_object' }
    })
    
    return {
      type: 'json_response',
      content: response,
      toolCalls: [],
      fallbackUsed: false
    }
  }

  // Try modern tool calling approach
  const startTime = Date.now()
  
  try {
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userPrompt }
    ]

    const response = await modernChat({
      messages,
      tools: options.tools,
      toolChoice: 'auto',
      model: options.model
    })

    const duration = Date.now() - startTime
    
    console.log('AI SMS | 🔧 Tool calling successful', {
      toolCallsCount: response.toolCalls.length,
      hasContent: !!response.content,
      durationMs: duration,
      tokenUsage: response.usage
    })

    // Log detailed tool call information for monitoring
    if (isFeatureEnabled('VERBOSE_LOGGING') && response.toolCalls.length > 0) {
      console.log('AI SMS | 🔧 Tool calls details:', {
        toolCalls: response.toolCalls.map(tc => ({ name: tc.name, argsCount: Object.keys(tc.arguments).length }))
      })
    }

    return {
      type: 'tool_calling',
      content: response.content,
      toolCalls: response.toolCalls,
      fallbackUsed: false
    }

  } catch (error) {
    const duration = Date.now() - startTime
    
    console.warn('AI SMS | ⚠️ Tool calling failed, falling back to JSON response:', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration,
      model: options.model,
      toolCount: options.tools?.length || 0
    })
    
    // Fallback to legacy JSON approach
    try {
      const { chat } = await import('./llm.client')
      const response = await chat({
        system: options.systemPrompt,
        user: options.userPrompt,
        model: options.model,
        responseFormat: { type: 'json_object' }
      })
      
      console.log('AI SMS | 📜 JSON fallback successful', {
        durationMs: Date.now() - startTime,
        responseLength: response.length
      })
      
      return {
        type: 'json_response',
        content: response,
        toolCalls: [],
        fallbackUsed: true
      }
      
    } catch (fallbackError) {
      console.error('AI SMS | ❌ Both tool calling and JSON fallback failed:', {
        originalError: error instanceof Error ? error.message : String(error),
        fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        durationMs: Date.now() - startTime
      })
      
      // Return empty response to prevent complete failure
      return {
        type: 'json_response',
        content: JSON.stringify({ reply: "I'm having trouble processing your request right now. Please try again.", actions: [] }),
        toolCalls: [],
        fallbackUsed: true
      }
    }
  }
}

/**
 * Convert tool calls to legacy action format for backward compatibility
 */
export function convertToolCallsToActions(
  toolCalls: ToolCall[],
  defaultPhoneNumber: string,
  userId?: number
): Array<{
  type: 'send_magic_link' | 'send_sms' | 'send_review_link'
  phoneNumber: string
  text?: string
  userId?: number
  linkType?: string
}> {
  const actions: any[] = []

  for (const toolCall of toolCalls) {
    switch (toolCall.name) {
      case 'send_portal_link':
        if (userId && toolCall.arguments.userId) {
          actions.push({
            type: 'send_magic_link',
            phoneNumber: defaultPhoneNumber,
            userId: toolCall.arguments.userId,
            linkType: toolCall.arguments.linkType || 'claimPortal'
          })
          console.log('AI SMS | 🔧 Converted portal link tool call to magic link action')
        }
        break

      case 'send_followup_sms':
        actions.push({
          type: 'send_sms',
          phoneNumber: toolCall.arguments.phoneNumber || defaultPhoneNumber,
          text: toolCall.arguments.message
        })
        console.log('AI SMS | 🔧 Converted SMS tool call to SMS action')
        break

      case 'send_review_link':
        actions.push({
          type: 'send_review_link',
          phoneNumber: toolCall.arguments.phoneNumber || defaultPhoneNumber
        })
        console.log('AI SMS | 🔧 Converted review tool call to review action')
        break

      case 'schedule_callback':
        // Convert callback to scheduled SMS action
        actions.push({
          type: 'send_sms',
          phoneNumber: toolCall.arguments.phoneNumber || defaultPhoneNumber,
          text: toolCall.arguments.message,
          delaySeconds: (toolCall.arguments.delayHours || 1) * 3600
        })
        console.log('AI SMS | 🔧 Converted callback tool call to scheduled SMS')
        break

      default:
        console.warn('AI SMS | ⚠️ Unknown tool call:', toolCall.name)
    }
  }

  return actions
}

/**
 * Check if tool calling is enabled and available
 */
export function isToolCallingEnabled(): boolean {
  return isFeatureEnabled('TOOL_CALLING_ENABLED')
}

/**
 * Get the appropriate system prompt for tool calling vs JSON response
 */
export function getSystemPromptForMode(basePrompt: string, useToolCalling: boolean): string {
  if (useToolCalling) {
    return basePrompt + `

You are equipped with tools to help users. Use the available tools when appropriate:
- send_portal_link: When user needs to sign documents or upload requirements
- send_followup_sms: For follow-up messages or reminders
- send_review_link: When user expresses satisfaction or case is complete
- schedule_callback: For future follow-ups or status updates

Respond naturally in conversation. Use tools when actions are needed, but don't force tool usage.
Be helpful and professional. Focus on answering questions and guiding users through their claim process.`
  } else {
    return basePrompt + `

Output: Return ONLY a JSON object with keys: reply (string), actions (array), and optionally plan_version (string), idempotency_key (string) and messages (array).
- reply: string (focus on answering the question thoughtfully - call-to-action will be added automatically)
- actions: array of { type: 'none' } | { type: 'send_sms', phoneNumber, text } | { type: 'send_magic_link', phoneNumber } | { type: 'send_review_link', phoneNumber }
- messages: optional array of objects { text: string, send_after_seconds?: number }. First message mirrors 'reply'.
Provide comprehensive, value-focused answers. Don't end every response with "Would you like your portal link?" - varied follow-ups will be added based on context. No extra text.`
  }
}