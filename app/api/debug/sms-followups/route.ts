import { NextResponse } from 'next/server'
import { listPhonesWithFollowups, listFollowups } from '@/modules/ai-agents/core/followup.store'
import { cacheService } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    
    if (phone) {
      // Get follow-ups for specific phone
      const followups = await listFollowups(phone)
      const now = Date.now()
      
      const enrichedFollowups = followups.map(followup => ({
        ...followup,
        status: followup.dueAt <= now ? 'due' : 'pending',
        timeRemaining: followup.dueAt - now,
        dueDate: new Date(followup.dueAt).toISOString(),
        createdDate: new Date(followup.createdAt).toISOString()
      }))
      
      return NextResponse.json({
        phone,
        followups: enrichedFollowups,
        count: followups.length
      })
    } else {
      // Get all phones with follow-ups
      const phones = await listPhonesWithFollowups()
      const phoneData = []
      
      for (const phoneNumber of phones) {
        const followups = await listFollowups(phoneNumber)
        const now = Date.now()
        const dueCount = followups.filter(f => f.dueAt <= now).length
        const pendingCount = followups.filter(f => f.dueAt > now).length
        
        phoneData.push({
          phone: phoneNumber,
          totalFollowups: followups.length,
          due: dueCount,
          pending: pendingCount,
          nextDue: followups.length > 0 ? Math.min(...followups.map(f => f.dueAt)) : null
        })
      }
      
      return NextResponse.json({
        summary: {
          totalPhones: phones.length,
          totalFollowups: phoneData.reduce((sum, p) => sum + p.totalFollowups, 0),
          totalDue: phoneData.reduce((sum, p) => sum + p.due, 0),
          totalPending: phoneData.reduce((sum, p) => sum + p.pending, 0)
        },
        phones: phoneData
      })
    }
  } catch (error) {
    console.error('Error fetching SMS follow-ups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch follow-ups' },
      { status: 500 }
    )
  }
}

// Helper endpoint to get raw Redis data
export async function POST(request: Request) {
  try {
    const { key } = await request.json()
    
    if (!key) {
      return NextResponse.json({ error: 'Redis key required' }, { status: 400 })
    }
    
    const data = await cacheService.get(key)
    
    return NextResponse.json({
      key,
      data: data ? JSON.parse(data as string) : null,
      exists: data !== null
    })
  } catch (error) {
    console.error('Error fetching Redis data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Redis data' },
      { status: 500 }
    )
  }
}
