import { cacheService } from '@/lib/redis'

export type SmsAgentType = 'customer_service' | 'unsigned_chase' | 'requirements' | 'review_collection'

export type SmsAgentSession = {
  type: SmsAgentType
  startedAt: number
  lastAt: number
  ttlSeconds: number
  metadata?: Record<string, any>
}

const key = (phone: string) => `sms:session:${phone}`

export async function getActiveSession(phone: string): Promise<SmsAgentSession | null> {
  const session = (await cacheService.get(key(phone))) as SmsAgentSession | null
  return session || null
}

export async function startSession(phone: string, session: SmsAgentSession): Promise<void> {
  await cacheService.set(key(phone), session, session.ttlSeconds)
}

export async function updateSession(phone: string, partial: Partial<SmsAgentSession>): Promise<SmsAgentSession | null> {
  const current = (await cacheService.get(key(phone))) as SmsAgentSession | null
  if (!current) return null
  const next: SmsAgentSession = {
    ...current,
    ...partial,
    lastAt: Date.now()
  }
  await cacheService.set(key(phone), next, next.ttlSeconds)
  return next
}

export async function completeSession(phone: string): Promise<void> {
  // Set a short TTL to keep a tiny tail of state for debugging, then drop
  const existing = (await cacheService.get(key(phone))) as SmsAgentSession | null
  if (existing) {
    await cacheService.set(key(phone), { ...existing, completedAt: Date.now() }, 60)
  }
}


