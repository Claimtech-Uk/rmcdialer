import { cacheService, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'

// Enhanced conversation context types
export type ConversationInsights = {
  userSentiment: 'positive' | 'neutral' | 'cautious' | 'frustrated' | 'confused'
  conversationPhase: 'discovery' | 'objection_handling' | 'decision_making' | 'post_signup'
  topicsDiscussed: string[]
  userStyle: 'concise' | 'detailed' | 'reassuring_needed' | 'technical'
  objectionsSeen: string[]
  lastUpdated: number
  messageCount: number
  engagementLevel: 'high' | 'medium' | 'low'
  successfulPatterns: string[]
  // Smart personalization tracking
  lastNameUsedAt?: number
  nameUsageCount: number
  lastLinkSentAt?: number
  linkSentCount: number
  recentActions: Array<{
    type: 'name_used' | 'portal_link_sent' | 'portal_link_mentioned' | 'review_link_sent'
    timestamp: number
    messageIndex: number
  }>
}

export async function getConversationSummary(phoneNumber: string): Promise<string | null> {
  return await cacheService.get(convoKey(phoneNumber))
}

export async function setConversationSummary(phoneNumber: string, summary: string): Promise<void> {
  await cacheService.set(convoKey(phoneNumber), summary, CACHE_TTL.SHORT_TERM)
}

function convoKey(phoneNumber: string): string {
  return `sms:summary:${phoneNumber}`
}

export async function getLastReply(phoneNumber: string): Promise<string | null> {
  return await cacheService.get(lastReplyKey(phoneNumber))
}

export async function setLastReply(phoneNumber: string, reply: string): Promise<void> {
  await cacheService.set(lastReplyKey(phoneNumber), reply, CACHE_TTL.SHORT_TERM)
}

function lastReplyKey(phoneNumber: string): string {
  return `sms:lastReply:${phoneNumber}`
}

// Link cooldown tracking -------------------------------------------------------
export async function getLastLinkSentAt(phoneNumber: string): Promise<number | null> {
  const v = await cacheService.get(linkCooldownKey(phoneNumber))
  return typeof v === 'number' ? v : null
}

export async function setLastLinkSentAt(phoneNumber: string, timestampMs: number, cooldownSeconds: number): Promise<void> {
  await cacheService.set(linkCooldownKey(phoneNumber), timestampMs, cooldownSeconds)
}

function linkCooldownKey(phoneNumber: string): string {
  return `sms:lastLinkAt:${phoneNumber}`
}

// Review monthly throttle ------------------------------------------------------
export async function getLastReviewAskAt(phoneNumber: string): Promise<number | null> {
  const v = await cacheService.get(reviewAskKey(phoneNumber))
  return typeof v === 'number' ? v : null
}

export async function setLastReviewAskAt(phoneNumber: string, timestampMs: number, cooldownSeconds: number): Promise<void> {
  await cacheService.set(reviewAskKey(phoneNumber), timestampMs, cooldownSeconds)
}

function reviewAskKey(phoneNumber: string): string {
  return `sms:lastReviewAskAt:${phoneNumber}`
}

// Automation halt (complaint/abuse) -------------------------------------------------
function haltKey(phoneNumber: string): string {
  return `sms:halt:${phoneNumber}`
}

export async function setAutomationHalt(phoneNumber: string, ttlSeconds: number = 24 * 60 * 60): Promise<void> {
  await cacheService.set(haltKey(phoneNumber), 1, ttlSeconds)
}

export async function isAutomationHalted(phoneNumber: string): Promise<boolean> {
  const v = await cacheService.get(haltKey(phoneNumber))
  return Boolean(v)
}

// Admin utility to clear the automation halt for a phone
export async function clearAutomationHalt(phoneNumber: string): Promise<void> {
  // Best-effort delete; ignore errors
  try {
    // @ts-ignore - ICacheService exposes del
    await (cacheService as any).del(haltKey(phoneNumber))
  } catch {}
}

// Simple rate limiter (per phone) ----------------------------------------------------
function rateKey(phoneNumber: string): string {
  return `sms:rate:${phoneNumber}`
}

export async function checkAndBumpRate(phoneNumber: string, maxPerWindow: number = 4, windowSeconds: number = 60): Promise<boolean> {
  const key = rateKey(phoneNumber)
  const current = (await cacheService.get(key) as number) || 0
  if (current >= maxPerWindow) return false
  await cacheService.set(key, current + 1, windowSeconds)
  return true
}

// Idempotency keys ------------------------------------------------------------------
function idempotencyKey(key: string): string {
  return `sms:idemp:${key}`
}

export async function isIdempotencyKeyUsed(key: string): Promise<boolean> {
  return Boolean(await cacheService.get(idempotencyKey(key)))
}

export async function markIdempotencyKeyUsed(key: string, ttlSeconds: number = 3600): Promise<void> {
  await cacheService.set(idempotencyKey(key), 1, ttlSeconds)
}

// Enhanced Conversation Intelligence -----------------------------------------------

function conversationInsightsKey(phoneNumber: string): string {
  return `sms:insights:${phoneNumber}`
}

export async function getConversationInsights(phoneNumber: string): Promise<ConversationInsights | null> {
  try {
    const data = await cacheService.get(conversationInsightsKey(phoneNumber)) as string
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export async function setConversationInsights(
  phoneNumber: string, 
  insights: ConversationInsights
): Promise<void> {
  await cacheService.set(
    conversationInsightsKey(phoneNumber), 
    JSON.stringify(insights), 
    CACHE_TTL.STATIC_DATA // Keep insights for longer than basic conversation data (1 hour)
  )
}

export async function updateConversationInsights(
  phoneNumber: string,
  updates: Partial<ConversationInsights>
): Promise<ConversationInsights> {
  const existing = await getConversationInsights(phoneNumber)
  
  const updated: ConversationInsights = {
    userSentiment: 'neutral',
    conversationPhase: 'discovery',
    topicsDiscussed: [],
    userStyle: 'detailed',
    objectionsSeen: [],
    engagementLevel: 'medium',
    successfulPatterns: [],
    nameUsageCount: 0,
    linkSentCount: 0,
    recentActions: [],
    ...existing,
    ...updates,
    // Always update timestamp and increment message count
    lastUpdated: Date.now(),
    messageCount: (existing?.messageCount || 0) + 1
  }
  
  await setConversationInsights(phoneNumber, updated)
  return updated
}

// Track conversation patterns for optimization
export async function recordSuccessfulPattern(
  phoneNumber: string,
  pattern: string
): Promise<void> {
  const insights = await getConversationInsights(phoneNumber)
  if (insights) {
    const patterns = new Set([...insights.successfulPatterns, pattern])
    await updateConversationInsights(phoneNumber, {
      successfulPatterns: Array.from(patterns).slice(-5) // Keep last 5 successful patterns
    })
  }
}

// Quick sentiment update after message analysis
export async function updateUserSentiment(
  phoneNumber: string,
  sentiment: ConversationInsights['userSentiment']
): Promise<void> {
  await updateConversationInsights(phoneNumber, { userSentiment: sentiment })
}

// Track topics discussed to avoid repetition
export async function addDiscussedTopic(
  phoneNumber: string,
  topic: string
): Promise<void> {
  const insights = await getConversationInsights(phoneNumber)
  if (insights) {
    const topics = new Set([...insights.topicsDiscussed, topic])
    await updateConversationInsights(phoneNumber, {
      topicsDiscussed: Array.from(topics).slice(-10) // Keep last 10 topics
    })
  }
}

// Track objections to improve handling
export async function recordObjection(
  phoneNumber: string,
  objection: string
): Promise<void> {
  const insights = await getConversationInsights(phoneNumber)
  if (insights) {
    const objections = new Set([...insights.objectionsSeen, objection])
    await updateConversationInsights(phoneNumber, {
      objectionsSeen: Array.from(objections).slice(-5) // Keep last 5 objections
    })
  }
}

// Smart Personalization Intelligence -----------------------------------------------

export async function recordNameUsage(phoneNumber: string): Promise<void> {
  const insights = await getConversationInsights(phoneNumber)
  const now = Date.now()
  
  const newAction = {
    type: 'name_used' as const,
    timestamp: now,
    messageIndex: (insights?.messageCount || 0) + 1
  }
  
  await updateConversationInsights(phoneNumber, {
    lastNameUsedAt: now,
    nameUsageCount: (insights?.nameUsageCount || 0) + 1,
    recentActions: [...(insights?.recentActions || []), newAction].slice(-10) // Keep last 10 actions
  })
}

export async function recordLinkSent(
  phoneNumber: string, 
  linkType: 'portal_link_sent' | 'portal_link_mentioned' | 'review_link_sent'
): Promise<void> {
  const insights = await getConversationInsights(phoneNumber)
  const now = Date.now()
  
  const newAction = {
    type: linkType,
    timestamp: now,
    messageIndex: (insights?.messageCount || 0) + 1
  }
  
  const updates: Partial<ConversationInsights> = {
    recentActions: [...(insights?.recentActions || []), newAction].slice(-10)
  }
  
  if (linkType === 'portal_link_sent') {
    updates.lastLinkSentAt = now
    updates.linkSentCount = (insights?.linkSentCount || 0) + 1
  }
  
  await updateConversationInsights(phoneNumber, updates)
}

export async function shouldUseName(phoneNumber: string): Promise<boolean> {
  const insights = await getConversationInsights(phoneNumber)
  if (!insights) return true // First interaction, use name
  
  const now = Date.now()
  const lastNameUsed = insights.lastNameUsedAt
  
  // Don't use name if:
  // 1. Used in last 3 messages, OR
  // 2. Used within last 10 minutes, OR  
  // 3. Already used 3+ times in conversation
  
  const recentNameUsage = insights.recentActions
    .filter(a => a.type === 'name_used')
    .slice(-3) // Last 3 actions
  
  if (recentNameUsage.length > 0) {
    const lastNameAction = recentNameUsage[recentNameUsage.length - 1]
    const messagesSinceLastName = insights.messageCount - lastNameAction.messageIndex
    
    if (messagesSinceLastName < 3) return false // Used in last 3 messages
  }
  
  if (lastNameUsed && (now - lastNameUsed < 10 * 60 * 1000)) return false // Used within 10 minutes
  
  if (insights.nameUsageCount >= 3) return false // Used 3+ times already
  
  return true
}

export async function getRecentLinkContext(phoneNumber: string): Promise<{
  canReference: boolean
  referenceText: string
  shouldSendNew: boolean
}> {
  const insights = await getConversationInsights(phoneNumber)
  if (!insights) return { canReference: false, referenceText: '', shouldSendNew: true }
  
  const now = Date.now()
  const recentLinks = insights.recentActions
    .filter(a => a.type === 'portal_link_sent' || a.type === 'portal_link_mentioned')
    .slice(-3) // Last 3 link actions
  
  if (recentLinks.length === 0) {
    return { canReference: false, referenceText: '', shouldSendNew: true }
  }
  
  const lastLinkAction = recentLinks[recentLinks.length - 1]
  const messagesSinceLastLink = insights.messageCount - lastLinkAction.messageIndex
  const timeSinceLastLink = now - lastLinkAction.timestamp
  
  // Can reference if link was sent in last 2 messages or within 15 minutes
  const canReference = messagesSinceLastLink <= 2 || timeSinceLastLink < 15 * 60 * 1000
  
  // Don't send new link if we just sent one very recently
  const shouldSendNew = !(messagesSinceLastLink <= 1 && timeSinceLastLink < 5 * 60 * 1000)
  
  let referenceText = ''
  if (canReference && !shouldSendNew) {
    if (messagesSinceLastLink <= 1) {
      referenceText = 'the link above'
    } else if (messagesSinceLastLink <= 2) {
      referenceText = 'the link I just sent'
    } else {
      referenceText = 'the portal link from earlier'
    }
  }
  
  return { canReference, referenceText, shouldSendNew }
}


