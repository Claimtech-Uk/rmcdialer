import { cacheService } from '@/lib/redis'
import type { SmsAgentType } from './session.store'

/**
 * A small, TTL-based store that lets us temporarily override the SMS agent behaviour
 * for a given phone number. Useful for manual testing via the /aibehaviour page.
 */

const key = (phone: string) => `sms:behaviour_override:${phone}`

export type BehaviourOverride = {
  /** Agent type to force, e.g. 'customer_service' | 'unsigned_chase' | 'requirements' | 'review_collection' */
  type: SmsAgentType
  /** Epoch ms when the override was created */
  createdAt: number
  /** Optional note for audit */
  note?: string
}

/**
 * Set a temporary behaviour override for a phone number.
 * @param phone e.g. +447... (E164), but we store as provided to match router usage
 * @param type One of the SmsAgentType values
 * @param ttlSeconds Default 7200s (2 hours)
 */
export async function setBehaviourOverride(
  phone: string,
  type: SmsAgentType,
  ttlSeconds: number = 2 * 60 * 60,
  note?: string
): Promise<void> {
  const override: BehaviourOverride = {
    type,
    createdAt: Date.now(),
    note
  }
  await cacheService.set(key(phone), override, ttlSeconds)
}

/** Get current override (if any) */
export async function getBehaviourOverride(phone: string): Promise<BehaviourOverride | null> {
  const val = (await cacheService.get(key(phone))) as BehaviourOverride | null
  return val || null
}

/** Clear any existing override */
export async function clearBehaviourOverride(phone: string): Promise<void> {
  // Setting a tiny TTL to make the key evaporate quickly while leaving a trace
  const existing = (await cacheService.get(key(phone))) as BehaviourOverride | null
  if (existing) {
    await cacheService.set(key(phone), { ...existing, clearedAt: Date.now() }, 10)
  }
  // Then actually delete
  await cacheService.del(key(phone))
}



