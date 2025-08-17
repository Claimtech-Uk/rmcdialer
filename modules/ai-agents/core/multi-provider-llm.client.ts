import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

// Provider clients (lazy initialization)
let openaiClient: OpenAI | null = null
let anthropicClient: Anthropic | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set')
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set for Claude models')
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

// Model configuration with provider info
interface ModelConfig {
  provider: 'openai' | 'anthropic'
  model: string
  maxTokens: number
  costPer1kTokens: number
}

const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // Claude models (preferred)
  'claude-sonnet-4-20250514': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 325,
    costPer1kTokens: 0.015
  },
  'claude-3-5-sonnet-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 325,
    costPer1kTokens: 0.015
  },
  'claude-3-sonnet-20240229': {
    provider: 'anthropic', 
    model: 'claude-3-sonnet-20240229',
    maxTokens: 325,
    costPer1kTokens: 0.015
  },
  
  // OpenAI models (fallback)
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 325,
    costPer1kTokens: 0.030
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini', 
    maxTokens: 325,
    costPer1kTokens: 0.0015
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    maxTokens: 325,
    costPer1kTokens: 0.001
  }
}

// Unified options interface
export type MultiProviderChatOptions = {
  system: string
  user: string
  model?: string
  responseFormat?: { type: 'json_object' }
  maxRetries?: number
}

export type MultiProviderChatResult = {
  content: string
  modelUsed: string
  provider: string
  fallbacksUsed: number
  success: boolean
  totalTime: number
}

/**
 * Universal chat function that works with both OpenAI and Anthropic models
 * Automatically handles provider selection and fallback
 */
export async function universalChat(options: MultiProviderChatOptions): Promise<MultiProviderChatResult> {
  const startTime = Date.now()
  const maxRetries = options.maxRetries || 3
  
  // Resolve model preference
  const requestedModel = options.model || process.env.AI_SMS_MODEL || 'claude-sonnet-4-20250514'
  
  // Build fallback chain starting with requested model
  const fallbackChain = buildFallbackChain(requestedModel)
  
  let fallbacksUsed = 0
  let lastError: any = null
  
  for (const modelName of fallbackChain.slice(0, maxRetries)) {
    const config = MODEL_REGISTRY[modelName]
    if (!config) {
      console.log(`AI SMS | ⚠️ Unknown model ${modelName}, skipping`)
      fallbacksUsed++
      continue
    }
    
    try {
      console.log(`AI SMS | 🤖 Trying ${config.provider}/${config.model}`)
      
      let content: string
      
      if (config.provider === 'anthropic') {
        content = await callAnthropic(options, config)
      } else {
        content = await callOpenAI(options, config)
      }
      
      // Validate response
      if (!content || content.trim().length === 0) {
        throw new Error(`Empty response from ${modelName}`)
      }
      
      // Validate JSON if requested
      if (options.responseFormat?.type === 'json_object') {
        try {
          JSON.parse(content)
        } catch {
          throw new Error(`Invalid JSON from ${modelName}`)
        }
      }
      
      console.log(`AI SMS | ✅ Success with ${config.provider}/${config.model}`, {
        responseLength: content.length,
        fallbacksUsed,
        totalTime: Date.now() - startTime
      })
      
      return {
        content,
        modelUsed: config.model,
        provider: config.provider,
        fallbacksUsed,
        success: true,
        totalTime: Date.now() - startTime
      }
      
    } catch (error: any) {
      console.log(`AI SMS | ❌ ${config.provider}/${config.model} failed:`, error.message)
      lastError = error
      fallbacksUsed++
      
      // Small delay between retries
      if (fallbacksUsed < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }
  
  // All models failed
  console.error('AI SMS | 🚨 ALL MODELS FAILED', { 
    fallbacksUsed, 
    lastError: lastError?.message,
    modelsAttempted: fallbackChain.slice(0, maxRetries)
  })
  
  return {
    content: "I understand your question. How can I help you with your motor finance claim?",
    modelUsed: 'fallback',
    provider: 'fallback',
    fallbacksUsed,
    success: false,
    totalTime: Date.now() - startTime
  }
}

/**
 * Build intelligent fallback chain based on requested model
 */
function buildFallbackChain(requestedModel: string): string[] {
  // Start with requested model
  const chain = [requestedModel]
  
  // Add intelligent fallbacks based on requested model
  if (requestedModel.includes('claude')) {
    // Claude fallback chain
    if (!chain.includes('claude-sonnet-4-20250514')) chain.push('claude-sonnet-4-20250514')
    if (!chain.includes('claude-3-5-sonnet-20241022')) chain.push('claude-3-5-sonnet-20241022')
    if (!chain.includes('gpt-4o')) chain.push('gpt-4o')
    if (!chain.includes('gpt-4o-mini')) chain.push('gpt-4o-mini')
  } else if (requestedModel.includes('gpt')) {
    // OpenAI fallback chain  
    if (!chain.includes('gpt-4o')) chain.push('gpt-4o')
    if (!chain.includes('claude-sonnet-4-20250514')) chain.push('claude-sonnet-4-20250514')
    if (!chain.includes('gpt-4o-mini')) chain.push('gpt-4o-mini')
  } else {
    // Default fallback chain (prefer Claude Sonnet 4)
    chain.push('claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'gpt-4o', 'gpt-4o-mini')
  }
  
  // Remove duplicates while preserving order
  return [...new Set(chain)]
}

/**
 * Call Anthropic API
 */
async function callAnthropic(options: MultiProviderChatOptions, config: ModelConfig): Promise<string> {
  const client = getAnthropicClient()
  
  // Handle JSON format for Claude
  let systemPrompt = options.system
  if (options.responseFormat?.type === 'json_object') {
    systemPrompt += '\n\nIMPORTANT: You must respond with valid JSON only. No other text or explanations.'
  }
  
  const response = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: 0.1,
    system: systemPrompt,
    messages: [
      { role: 'user', content: options.user }
    ]
  })
  
  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }
  
  return content.text
}

/**
 * Call OpenAI API
 */
async function callOpenAI(options: MultiProviderChatOptions, config: ModelConfig): Promise<string> {
  const client = getOpenAIClient()
  
  const requestOptions: any = {
    model: config.model,
    messages: [
      { role: 'system', content: options.system },
      { role: 'user', content: options.user }
    ],
    max_completion_tokens: config.maxTokens,
    temperature: 0.1
  }
  
  if (options.responseFormat) {
    requestOptions.response_format = options.responseFormat
  }
  
  const response = await client.chat.completions.create(requestOptions)
  const content = response.choices?.[0]?.message?.content
  
  if (!content) {
    throw new Error('Empty response from OpenAI')
  }
  
  return content
}

// Drop-in replacement for existing chat function
export async function chat(options: MultiProviderChatOptions): Promise<string> {
  const result = await universalChat(options)
  return result.content
}
