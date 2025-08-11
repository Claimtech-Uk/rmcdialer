import { NextResponse } from 'next/server'
import { listPhonesWithFollowups, popDueFollowups, withinBusinessHours } from '@/modules/ai-agents/core/followup.store'
import { SMSService } from '@/modules/communications/services/sms.service'
import { MagicLinkService } from '@/modules/communications/services/magic-link.service'

// Minimal cron endpoint to flush due SMS follow-ups.
// Invoke via external scheduler every 5 minutes.

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  const phones = await listPhonesWithFollowups()
  const results: Array<{ phone: string; sent: number }> = []
  if (!withinBusinessHours()) {
    return NextResponse.json({ ok: true, message: 'Outside business hours; follow-ups deferred', phones: phones.length, ms: Date.now() - startedAt })
  }
  const smsService = new SMSService({ authService: undefined as any, userService: undefined as any })
  for (const phone of phones) {
    const due = await popDueFollowups(phone)
    let sent = 0
    for (const f of due) {
      try {
        await smsService.sendSMS({
          phoneNumber: phone.startsWith('+') ? phone : `+${phone}`,
          message: f.text,
          messageType: 'auto_response'
        })
        sent++
      } catch (err) {
        console.error('AI SMS | ❌ Follow-up send failed', { phone, id: f.id, err })
      }
    }
    results.push({ phone, sent })
  }
  return NextResponse.json({ ok: true, phones: results.length, results, ms: Date.now() - startedAt })
}


