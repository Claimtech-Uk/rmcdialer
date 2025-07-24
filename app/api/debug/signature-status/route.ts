// Debug endpoint to check signature status of users
import { NextRequest, NextResponse } from 'next/server'
import { replicaDb } from '@/lib/mysql'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get a few sample user IDs from user_call_scores
    const sampleUsers = await prisma.userCallScore.findMany({
      // @ts-ignore - Debug endpoint
      where: { currentQueueType: null },
      select: { userId: true },
      take: 5,
      orderBy: { userId: 'asc' }
    })

    const userIds = sampleUsers.map(u => u.userId.toString())

    return NextResponse.json({
      success: true,
      debug: `Found ${sampleUsers.length} sample users`,
      sampleUserIds: userIds,
      rawSampleUsers: sampleUsers.map(u => ({ userId: u.userId.toString() }))
    }, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
} 