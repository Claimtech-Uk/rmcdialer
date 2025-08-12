import { NextRequest, NextResponse } from 'next/server'
import { setBehaviourOverride, clearBehaviourOverride } from '@/modules/ai-agents/core/agent-behavior-override.store'
import type { SmsAgentType } from '@/modules/ai-agents/core/session.store'

// Very light auth: require an env token for now
function isAuthorized(req: NextRequest): boolean {
  const tokenHeader = req.headers.get('x-admin-token') || req.nextUrl.searchParams.get('token')
  const expected = process.env.ADMIN_CONTROL_TOKEN
  return !!expected && tokenHeader === expected
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const phone = (body.phone || '').toString().trim()
    const behaviour = (body.behaviour || '').toString().trim()
    const ttlSeconds = Number(body.ttlSeconds || 7200)

    if (!phone) {
      return NextResponse.json({ ok: false, error: 'phone_required' }, { status: 400 })
    }

    // behaviour "user" clears override
    if (!behaviour || behaviour === 'user') {
      await clearBehaviourOverride(phone)
      return NextResponse.json({ ok: true, cleared: true })
    }

    // Map UI behaviour options to SmsAgentType
    const map: Record<string, SmsAgentType> = {
      unsigned: 'unsigned_chase',
      'outstanding info': 'requirements',
      outstanding: 'requirements',
      requirements: 'requirements',
      reviews: 'review_collection',
      'customer service': 'customer_service',
      customer: 'customer_service'
    }

    const mapped = (map[behaviour.toLowerCase()] || behaviour) as SmsAgentType
    const allowed: SmsAgentType[] = ['customer_service', 'unsigned_chase', 'requirements', 'review_collection']
    if (!allowed.includes(mapped)) {
      return NextResponse.json({ ok: false, error: 'invalid_behaviour' }, { status: 400 })
    }

    await setBehaviourOverride(phone, mapped, ttlSeconds, `manual override via /aibehaviour`)
    return NextResponse.json({ ok: true, phone, behaviour: mapped, ttlSeconds })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'unknown_error' }, { status: 500 })
  }
}


