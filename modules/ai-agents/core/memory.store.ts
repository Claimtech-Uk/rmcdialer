import { cacheService, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'

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

// Simple rate limiter (per phone) ----------------------------------------------------
function rateKey(phoneNumber: string): string {
  return `sms:rate:${phoneNumber}`
}

export async function checkAndBumpRate(phoneNumber: string, maxPerWindow: number = 4, windowSeconds: number = 60): Promise<boolean> {
  const key = rateKey(phoneNumber)
  const current = (await cacheService.get<number>(key)) || 0
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


