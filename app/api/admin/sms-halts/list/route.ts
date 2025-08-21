import { NextRequest, NextResponse } from 'next/server'
import { cacheService } from '@/lib/redis'

// Force dynamic rendering to prevent build-time Redis calls
export const dynamic = 'force-dynamic'

interface SmsHalt {
  phoneNumber: string
  displayPhone: string
  haltKey: string
  expiresAt?: string
  timeRemaining?: string
  status: 'active' | 'expired'
}

export async function GET(_req: NextRequest) {
  try {
    const halts = await findAllSmsHalts()
    return NextResponse.json({ success: true, halts, count: halts.length, timestamp: new Date().toISOString() })
  } catch (e: any) {
    console.error('Failed to list SMS halts:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Failed to scan halts' }, { status: 500 })
  }
}

async function findAllSmsHalts(): Promise<SmsHalt[]> {
  const pattern = 'sms:halt:*'
  const results: SmsHalt[] = []

  try {
    const redis = (cacheService as any).redis
    if (!redis || typeof redis.scan !== 'function') {
      // No Redis connected (dev fallback)
      return []
    }

    let cursor = 0
    do {
      const res = (await redis.scan(cursor, { match: pattern, count: 500 })) as any
      const nextCursor = Array.isArray(res) ? res[0] : res?.cursor ?? 0
      const keys: string[] = Array.isArray(res) ? res[1] ?? [] : res?.keys ?? []

      for (const key of keys) {
        const phone = key.replace('sms:halt:', '')
        let ttlSeconds: number | undefined
        try {
          ttlSeconds = typeof redis.ttl === 'function' ? await redis.ttl(key) : undefined
        } catch {}

        let expiresAt: string | undefined
        let timeRemaining: string | undefined
        let status: 'active' | 'expired' = 'active'
        if (typeof ttlSeconds === 'number') {
          if (ttlSeconds > 0) {
            const expiry = new Date(Date.now() + ttlSeconds * 1000)
            expiresAt = expiry.toISOString()
            timeRemaining = formatTimeRemaining(ttlSeconds)
            status = 'active'
          } else if (ttlSeconds === -1) {
            timeRemaining = 'No expiry'
          } else {
            status = 'expired'
            timeRemaining = 'Expired'
          }
        }

        results.push({
          phoneNumber: phone,
          displayPhone: formatPhoneForDisplay(phone),
          haltKey: key,
          expiresAt,
          timeRemaining,
          status
        })
      }

      cursor = nextCursor
    } while (cursor !== 0)

    // Order by soonest expiry first
    return results.sort((a, b) => {
      if (!a.expiresAt && !b.expiresAt) return 0
      if (!a.expiresAt) return 1
      if (!b.expiresAt) return -1
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
    })
  } catch (err) {
    console.error('Error scanning Redis for sms:halt:*', err)
    return []
  }
}

function formatPhoneForDisplay(phone: string): string {
  if (phone.startsWith('+')) return phone
  if (phone.length === 12 && phone.startsWith('44')) {
    return `+44 ${phone.slice(2, 6)} ${phone.slice(6)}`
  }
  if (phone.length === 11 && phone.startsWith('0')) {
    return `+44 ${phone.slice(1, 5)} ${phone.slice(5)}`
  }
  return `+${phone}`
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}


