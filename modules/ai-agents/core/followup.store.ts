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

// Business-hours guard (08:00–20:00 local time). For UK deployment this approximates UK hours.
export function withinBusinessHours(date: Date = new Date()): boolean {
  const h = date.getHours()
  return h >= 8 && h < 20
}

// Seconds until next business open (08:00 local time)
export function secondsUntilBusinessOpen(date: Date = new Date()): number {
  const now = new Date(date)
  const h = now.getHours()
  const open = new Date(now)
  if (h < 8) {
    open.setHours(8, 0, 0, 0)
  } else {
    // During or after business hours, schedule for next day 08:00
    open.setDate(now.getDate() + 1)
    open.setHours(8, 0, 0, 0)
  }
  const diffMs = open.getTime() - now.getTime()
  return Math.max(1, Math.ceil(diffMs / 1000))
}

export async function scheduleAtBusinessOpen(phone: string, text: string, metadata?: Record<string, any>): Promise<SmsFollowup> {
  const delaySec = secondsUntilBusinessOpen()
  return scheduleFollowup(phone, { text, delaySec, metadata })
}


