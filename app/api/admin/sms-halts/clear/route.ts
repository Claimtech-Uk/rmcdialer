import { NextRequest, NextResponse } from 'next/server'
import { clearAutomationHalt } from '@/modules/ai-agents/core/memory.store'

export async function POST(req: NextRequest) {
  try {
    const { phoneNumbers } = await req.json()
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing phoneNumbers[]' }, { status: 400 })
    }

    const results: Array<{ phoneNumber: string; success: boolean; error?: string }> = []
    for (const pn of phoneNumbers) {
      try {
        const clean = String(pn).replace(/^\+/, '')
        await clearAutomationHalt(clean)
        results.push({ phoneNumber: pn, success: true })
      } catch (err: any) {
        results.push({ phoneNumber: pn, success: false, error: err?.message || 'failed' })
      }
    }

    const ok = results.filter(r => r.success).length
    const failed = results.length - ok
    return NextResponse.json({ success: true, ok, failed, results })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}


