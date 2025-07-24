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
         current_signature_file_id,
         (current_signature_file_id IS NULL) as is_unsigned_check,
         (current_signature_file_id IS NOT NULL) as is_signed_check,
         created_at
       FROM users 
       WHERE id IN (${userIds.join(',')})
       ORDER BY id ASC`
    ) as Array<{
      id: string
      current_signature_file_id: number | null
      is_unsigned_check: number
      is_signed_check: number
      created_at: string
    }>

    return NextResponse.json({
      success: true,
      sampleUserIds: userIds,
      signatureData: signatureData,
      analysis: signatureData.map(user => ({
        userId: user.id,
        signatureFileId: user.current_signature_file_id,
        isNull: user.current_signature_file_id === null,
        mysqlUnsignedCheck: user.is_unsigned_check === 1,
        mysqlSignedCheck: user.is_signed_check === 1,
        ourLogic: user.is_unsigned_check === 1 ? 'UNSIGNED' : 'SIGNED',
        createdAt: user.created_at
      }))
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
} 