import { NextResponse } from 'next/server'
import { listPhonesWithFollowups, popDueFollowups } from '@/modules/ai-agents/core/followup.store'
import { SMSService } from '@/modules/communications/services/sms.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    
    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }
    
    console.log('AI SMS | 🔧 Debug: Manually triggering follow-ups for', phone)
    
    const due = await popDueFollowups(phone)
    const results = []
    
    if (due.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No due follow-ups found',
        phone,
        sent: 0
      })
    }
    
    const smsService = new SMSService({ 
      authService: undefined as any, 
      userService: undefined as any 
    })
    
    for (const followup of due) {
      try {
        await smsService.sendSMS({
          phoneNumber: phone.startsWith('+') ? phone : `+${phone}`,
          message: followup.text,
          messageType: 'auto_response'
        })
        
        results.push({
          id: followup.id,
          text: followup.text,
          status: 'sent'
        })
        
        console.log('AI SMS | ✅ Debug: Sent follow-up', {
          id: followup.id,
          phone,
          textLength: followup.text.length
        })
      } catch (error) {
        results.push({
          id: followup.id,
          text: followup.text,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        
        console.error('AI SMS | ❌ Debug: Failed to send follow-up', {
          id: followup.id,
          phone,
          error
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      phone,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    })
    
  } catch (error) {
    console.error('AI SMS | ❌ Debug: Error triggering follow-ups:', error)
    return NextResponse.json(
      { error: 'Failed to trigger follow-ups' },
      { status: 500 }
    )
  }
}

