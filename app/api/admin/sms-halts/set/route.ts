import { NextRequest, NextResponse } from 'next/server'
import { setAutomationHalt } from '@/modules/ai-agents/core/memory.store'

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, reason, durationHours = 24 } = await req.json()
    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: 'Missing phoneNumber' }, { status: 400 })
    }

    const maxHours = 24 * 7
    const minHours = 1
    const hours = Math.max(minHours, Math.min(maxHours, Number(durationHours) || 24))
    const ttl = hours * 60 * 60

    const clean = String(phoneNumber).replace(/^\+/, '')
    await setAutomationHalt(clean, ttl)

    return NextResponse.json({
      success: true,
      phoneNumber,
      reason: reason || 'manual',
      durationHours: hours,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}


