import { NextResponse } from 'next/server'
import { cacheService } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stats = await cacheService.getStats()
    return NextResponse.json({ ok: true, ...stats })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}


