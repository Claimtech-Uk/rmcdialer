import { cacheService, CACHE_TTL } from '@/lib/redis'

export type SmsFollowup = {
  id: string
  text: string
  delaySec: number
  createdAt: number
  dueAt: number
  metadata?: Record<string, any>
}

const key = (phone: string) => `sms:followups:${phone}`
const indexKey = 'sms:followups:index'

async function addPhoneToIndex(phone: string): Promise<void> {
  const current = (await cacheService.get(indexKey)) as string[] | null
  const list = Array.isArray(current) ? current : []
  if (!list.includes(phone)) {
    list.push(phone)
  }
  // Keep the index around for 14 days from last update
  await cacheService.set(indexKey, list, 14 * 24 * 60 * 60)
}

async function removePhoneFromIndexIfEmpty(phone: string): Promise<void> {
  const list = (await cacheService.get(indexKey)) as string[] | null
  if (!Array.isArray(list) || list.length === 0) return
  const queue = (await cacheService.get(key(phone))) as SmsFollowup[] | null
  if (queue && queue.length > 0) return
  const next = list.filter(p => p !== phone)
  await cacheService.set(indexKey, next, 14 * 24 * 60 * 60)
}

export async function listPhonesWithFollowups(): Promise<string[]> {
  const list = (await cacheService.get(indexKey)) as string[] | null
  return Array.isArray(list) ? list : []
}

export async function scheduleFollowup(phone: string, followup: Omit<SmsFollowup, 'createdAt' | 'dueAt' | 'id'> & { id?: string }): Promise<SmsFollowup> {
  const id = followup.id || `fup_${Date.now()}`
  const createdAt = Date.now()
  const dueAt = createdAt + (followup.delaySec * 1000)
  const entry: SmsFollowup = { id, text: followup.text, delaySec: followup.delaySec, createdAt, dueAt, metadata: followup.metadata }
  const list = (await cacheService.get(key(phone))) as SmsFollowup[] | null
  const next = Array.isArray(list) ? [...list, entry] : [entry]
  // TTL: keep up to 7 days after last due item
  const maxDue = next.reduce((m, e) => Math.max(m, e.dueAt), dueAt)
  const ttlSec = Math.ceil((maxDue - Date.now()) / 1000) + 7 * 24 * 60 * 60
  await cacheService.set(key(phone), next, ttlSec)
  await addPhoneToIndex(phone)
  return entry
}

export async function listFollowups(phone: string): Promise<SmsFollowup[]> {
  return ((await cacheService.get(key(phone))) as SmsFollowup[] | null) || []
}

export async function popDueFollowups(phone: string, nowMs: number = Date.now()): Promise<SmsFollowup[]> {
  const list = ((await cacheService.get(key(phone))) as SmsFollowup[] | null) || []
  const due = list.filter(f => f.dueAt <= nowMs)
  const pending = list.filter(f => f.dueAt > nowMs)
  const ttlSec = pending.length ? Math.ceil((pending.reduce((m, e) => Math.max(m, e.dueAt), nowMs) - nowMs) / 1000) + 24 * 60 * 60 : 60
  await cacheService.set(key(phone), pending, ttlSec)
  if (pending.length === 0) {
    await removePhoneFromIndexIfEmpty(phone)
  }
  return due
}

// Business-hours guard (08:00–20:00 UK time). 
export function withinBusinessHours(date: Date = new Date()): boolean {
  // Check if business hours are bypassed for testing
  if (process.env.AI_SMS_IGNORE_BUSINESS_HOURS === 'true') {
    return true
  }
  
  // Get UK time using Europe/London timezone
  const ukTime = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/London' }))
  const h = ukTime.getHours()
  return h >= 8 && h < 20
}

// Seconds until next business open (08:00 UK time)
export function secondsUntilBusinessOpen(date: Date = new Date()): number {
  // If business hours are bypassed, return minimal delay
  if (process.env.AI_SMS_IGNORE_BUSINESS_HOURS === 'true') {
    return 1
  }
  
  // Calculate based on UK timezone
  const now = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/London' }))
  const h = now.getHours()
  
  // Create a new date for the next business opening in UK time
  const open = new Date(now)
  if (h < 8) {
    // Before 8am - open today at 8am
    open.setHours(8, 0, 0, 0)
  } else {
    // During or after business hours - open tomorrow at 8am
    open.setDate(now.getDate() + 1)
    open.setHours(8, 0, 0, 0)
  }
  
  // Convert back to UTC for calculation
  const nowUTC = new Date(date)
  const openUTC = new Date(open.toLocaleString('en-US', { timeZone: 'UTC' }))
  
  const diffMs = openUTC.getTime() - nowUTC.getTime()
  return Math.max(1, Math.ceil(diffMs / 1000))
}

export async function scheduleAtBusinessOpen(phone: string, text: string, metadata?: Record<string, any>): Promise<SmsFollowup> {
  const delaySec = secondsUntilBusinessOpen()
  return scheduleFollowup(phone, { text, delaySec, metadata })
}


