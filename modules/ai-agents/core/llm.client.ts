import OpenAI from 'openai'

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

export type LlmCallOptions = {
  system: string
  user: string
  model?: string // e.g., 'gpt-4o-mini', 'gpt-4o', etc.
  responseFormat?: { type: 'json_object' } | undefined
}

export async function chat(options: LlmCallOptions): Promise<string> {
  const model = options.model || process.env.AI_SMS_MODEL || 'gpt-4o-mini'
  
  const requestOptions: any = {
    model,
    messages: [
      { role: 'system', content: options.system },
      { role: 'user', content: options.user }
    ],
    max_completion_tokens: 325  // Optimal balance: quality + SMS compliance
  }
  
  // Only add response_format if specified
  if (options.responseFormat) {
    requestOptions.response_format = options.responseFormat
  }
  
  const response = await getClient().chat.completions.create(requestOptions)

  const content = response.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : ''
}
