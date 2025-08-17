import { SYSTEM_PROMPT_BASE } from '../prompts/system.base'
import { SMS_POLICY_PROMPT } from '../prompts/sms.policy'
import { EXAMPLES } from '../prompts/examples'
import { KNOWLEDGE_DIGESTS, KNOWLEDGE_KB } from '../knowledge/knowledge-index'
import { selectKnowledgeIntelligently, analyzeConversationContext, type ConversationContext } from './intelligent-kb-selector'

// Legacy function for backward compatibility - now uses intelligent selection
export function selectKbIdsForMessage(userMessage: string): string[] {
  // This is now a simplified wrapper - we'll upgrade the callers to use the full intelligent version
  return ['KB-001', 'KB-024', 'KB-014'] // Safe defaults
}

// New intelligent knowledge selection with conversation context
export async function selectKnowledgeIntelligently_V2(
  userMessage: string, 
  conversationContext?: ConversationContext
): Promise<string[]> {
  const selection = await selectKnowledgeIntelligently(userMessage, conversationContext)
  return selection.selectedIds
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
    `- User Stages: ${KNOWLEDGE_DIGESTS.userStages}`,
    `- Compliance: ${KNOWLEDGE_DIGESTS.compliance}`,
    `- KB (selected): [${['KB-001','KB-002','KB-011','KB-014','KB-024']
      .map(id => `${id}: ${KNOWLEDGE_KB[id].sms}`)
      .join(' | ')}]`,
    `\nExamples:\n${EXAMPLES}`,
    `\nOutput: Return ONLY a JSON object with keys: reply (string), actions (array), and optionally plan_version (string), idempotency_key (string) and messages (array).\n- reply: string (focus on answering the question thoughtfully - call-to-action will be added automatically)\n- actions: array of { type: 'none' } | { type: 'send_sms', phoneNumber, text } | { type: 'send_magic_link', phoneNumber } | { type: 'send_review_link', phoneNumber }\n- messages: optional array of objects { text: string, send_after_seconds?: number }. First message mirrors 'reply'.\nProvide comprehensive, value-focused answers. Don't end every response with "Would you like your portal link?" - varied follow-ups will be added based on context. No extra text.`
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
  // Add compact KB snippets relevant to the user's latest message (legacy version for compatibility)
  const kbIds = selectKbIdsForMessage(input.message)
  const kbSnippets = kbIds.map(id => `${id}: ${KNOWLEDGE_KB[id]?.sms}`).filter(Boolean)
  if (kbSnippets.length) lines.push(`Relevant KB: [${kbSnippets.join(' | ')}]`)
  lines.push(`User: ${input.message}`)
  // No inline tool schema; strict JSON schema is enforced via response_format.
  return lines.join('\n')
}

// New intelligent version that supports conversation context
export async function buildUserPromptIntelligent(input: { 
  message: string; 
  userName?: string; 
  statusHint?: string; 
  conversationSummary?: string; 
  recentTranscript?: string;
  recentMessages?: Array<{direction: 'inbound' | 'outbound', body: string}>;
  personalizationContext?: string;
}): Promise<string> {
  const lines: string[] = []
  
  // Avoid surfacing placeholders like 'Unknown' in the prompt context
  if (input.userName && !/^unknown$/i.test(input.userName.trim())) {
    lines.push(`Customer: ${input.userName}`)
  }
  if (input.statusHint) lines.push(`Status hint: ${input.statusHint}`)
  if (input.conversationSummary) lines.push(`Conversation so far (brief): ${input.conversationSummary}`)
  if (input.recentTranscript) lines.push(`Recent messages (latest 5):\n${input.recentTranscript}`)
  
  // Intelligent knowledge selection with conversation context
  const conversationContext = input.recentMessages ? await analyzeConversationContext(input.recentMessages) : undefined
  const kbIds = await selectKnowledgeIntelligently_V2(input.message, conversationContext)
  const kbSnippets = kbIds.map(id => `${id}: ${KNOWLEDGE_KB[id]?.sms}`).filter(Boolean)
  
  if (kbSnippets.length) {
    lines.push(`Relevant KB (AI-selected): [${kbSnippets.join(' | ')}]`)
  }
  
  // Add conversation insights for better AI response
  if (conversationContext?.userSentiment && conversationContext.userSentiment !== 'neutral') {
    lines.push(`User sentiment: ${conversationContext.userSentiment}`)
  }
  // Remove phase pre-determination - let AI assess journey stage naturally from conversation context
  
  // Add personalization context for smart name/link usage
  if (input.personalizationContext) {
    lines.push(input.personalizationContext)
  }
  
  lines.push(`User: ${input.message}`)
  
  return lines.join('\n')
}


