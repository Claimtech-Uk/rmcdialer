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

    // Check their actual signature status in read replica
    const signatureData = await replicaDb.$queryRawUnsafe(
      `SELECT 
         id,
         current_signature_file_id
       FROM users 
       WHERE id IN (${userIds.join(',')})
       ORDER BY id ASC`
    ) as Array<{
      id: string
      current_signature_file_id: number | null
    }>

    return NextResponse.json({
      success: true,
      debug: `Found ${sampleUsers.length} sample users`,
      sampleUserIds: userIds,
      signatureData: signatureData.map(user => ({
        userId: user.id,
        signatureFileId: user.current_signature_file_id,
        isSignatureNull: user.current_signature_file_id === null,
        status: user.current_signature_file_id === null ? 'UNSIGNED' : 'SIGNED'
      }))
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