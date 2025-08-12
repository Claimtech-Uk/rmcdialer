import { NextRequest, NextResponse } from 'next/server'
import { clearAutomationHalt } from '@/modules/ai-agents/core/memory.store'

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone) return NextResponse.json({ ok: false, error: 'Missing phone' }, { status: 400 })
    await clearAutomationHalt(String(phone).replace(/^\+/, ''))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}



