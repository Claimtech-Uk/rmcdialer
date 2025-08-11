import { SYSTEM_PROMPT_BASE } from '../prompts/system.base'
import { SMS_POLICY_PROMPT } from '../prompts/sms.policy'
import { EXAMPLES } from '../prompts/examples'
import { KNOWLEDGE_DIGESTS, KNOWLEDGE_KB } from '../knowledge/knowledge-index'

// Naive intent → KB selection (Phase 1: rule-based). Future: LLM-assisted selection.
export function selectKbIdsForMessage(userMessage: string): string[] {
  const t = userMessage.toLowerCase()
  const picks = new Set<string>()
  if (/fee|fees|cost|percent|vat/.test(t)) picks.add('KB-024')
  if (/paid|payout|money|when|how long|timeline/.test(t)) { picks.add('KB-003'); picks.add('KB-014'); picks.add('KB-015') }
  if (/supreme|court|hidden|half[- ]?secret/.test(t)) { picks.add('KB-004'); picks.add('KB-004a'); picks.add('KB-018') }
  if (/dca|commission|broker|dealer|interest/.test(t)) { picks.add('KB-001'); picks.add('KB-002') }
  if (/credit|score|report/.test(t)) picks.add('KB-011')
  if (/id|passport|driv(ing|er)|proof/.test(t)) picks.add('KB-007')
  if (/sign|signature|loa/.test(t)) picks.add('KB-008')
  if (/cancel|cooling[- ]?off/.test(t)) picks.add('KB-016')
  if (/multiple|another|more than one/.test(t)) picks.add('KB-021')
  if (/diy|myself|martin lewis/.test(t)) { picks.add('KB-005'); picks.add('KB-020') }
  if (picks.size === 0) { picks.add('KB-001'); picks.add('KB-011') }
  return Array.from(picks).slice(0, 5)
}

export function buildSystemPrompt(addendum?: string): string {
  return [
    addendum ? addendum.trim() : undefined,
    SYSTEM_PROMPT_BASE,
    SMS_POLICY_PROMPT,
    `Knowledge:`,
    `- PCP: ${KNOWLEDGE_DIGESTS.pcpClaim}`,
    `- System: ${KNOWLEDGE_DIGESTS.rmcSystem}`,
    `- FAQs: ${KNOWLEDGE_DIGESTS.faqs}`,
    `- Compliance: ${KNOWLEDGE_DIGESTS.compliance}`,
    `- KB (selected): [${['KB-001','KB-002','KB-011','KB-014','KB-024']
      .map(id => `${id}: ${KNOWLEDGE_KB[id].sms}`)
      .join(' | ')}]`,
    `\nExamples:\n${EXAMPLES}`,
    `\nOutput: Return ONLY a JSON object with keys: reply (string), actions (array), and optionally plan_version (string), idempotency_key (string) and messages (array).\n- reply: string (<=320 chars)\n- actions: array of { type: 'none' } | { type: 'send_sms', phoneNumber, text } | { type: 'send_magic_link', phoneNumber } | { type: 'send_review_link', phoneNumber }\n- messages: optional array of objects { text: string, send_after_seconds?: number }. First message mirrors 'reply'.\nUse the term "portal link" in replies to users. Ask permission before sending links and prefer offering choices. No extra text.`
  ].filter(Boolean).join('\n\n')
}

export function buildUserPrompt(input: { message: string; userName?: string; statusHint?: string; conversationSummary?: string; recentTranscript?: string }): string {
  const lines: string[] = []
  // Avoid surfacing placeholders like 'Unknown' in the prompt context
  if (input.userName && !/^unknown$/i.test(input.userName.trim())) {
    lines.push(`Customer: ${input.userName}`)
  }
  if (input.statusHint) lines.push(`Status hint: ${input.statusHint}`)
  if (input.conversationSummary) lines.push(`Conversation so far (brief): ${input.conversationSummary}`)
  if (input.recentTranscript) lines.push(`Recent messages (latest 5):\n${input.recentTranscript}`)
  // Add compact KB snippets relevant to the user’s latest message
  const kbIds = selectKbIdsForMessage(input.message)
  const kbSnippets = kbIds.map(id => `${id}: ${KNOWLEDGE_KB[id]?.sms}`).filter(Boolean)
  if (kbSnippets.length) lines.push(`Relevant KB: [${kbSnippets.join(' | ')}]`)
  lines.push(`User: ${input.message}`)
  // No inline tool schema; strict JSON schema is enforced via response_format.
  return lines.join('\n')
}


