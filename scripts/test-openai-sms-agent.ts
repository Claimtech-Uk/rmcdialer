/*
  Quick OpenAI structured-output test for the SMS agent prompt.
  Usage:
    OPENAI_API_KEY=sk-... AI_SMS_MODEL=gpt-5 npm run openai:test
*/

import { chat } from '../modules/ai-agents/core/llm.client'
import { buildSystemPrompt, buildUserPrompt } from '../modules/ai-agents/core/prompt-builder'

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set')
    process.exit(1)
  }

  const system = buildSystemPrompt()
  const user = buildUserPrompt({
    message: 'Hi, can you resend my portal link?',
    userName: 'James',
    statusHint: 'User likely not signed yet; guide to magic link after answering.'
  })

  console.log('\n→ Calling OpenAI with model:', process.env.AI_SMS_MODEL || 'gpt-5')
  const raw = await chat({ system, user, model: process.env.AI_SMS_MODEL })
  console.log('\nRaw output_text:\n', raw)

  try {
    const parsed = JSON.parse(raw)
    console.log('\nParsed JSON:')
    console.log(JSON.stringify(parsed, null, 2))
  } catch (e) {
    console.log('\nCould not parse JSON, returning raw text.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


