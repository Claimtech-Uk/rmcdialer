import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Checking SMS migration status...')
    
    // Check existing columns
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'sms_messages'
      AND column_name IN ('processed', 'processed_at', 'phone_number', 'user_id', 'message_sid')
    ` as any[]
    
    const existingColumns = tableInfo.map((row: any) => row.column_name)
    
    // Count messages
    const messageCount = await prisma.smsMessage.count()
    
    // Check recent messages
    const recentMessages = await prisma.smsMessage.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        direction: true,
        twilioMessageSid: true
      }
    })
    
    // Check if columns exist
    const migrationNeeded = existingColumns.length < 5
    
    return NextResponse.json({
      status: 'ready_to_check',
      migrationNeeded,
      currentState: {
        totalMessages: messageCount,
        existingMigrationColumns: existingColumns,
        missingColumns: ['processed', 'processed_at', 'phone_number', 'user_id', 'message_sid']
          .filter(col => !existingColumns.includes(col)),
        recentMessageCount: recentMessages.length,
        oldestRecentMessage: recentMessages[recentMessages.length - 1]?.createdAt,
        newestMessage: recentMessages[0]?.createdAt
      },
      recommendation: migrationNeeded 
        ? '⚠️ Migration needed - columns are missing' 
        : '✅ Migration already completed - all columns exist'
    })
    
  } catch (error) {
    console.error('❌ Status check failed:', error)
    return NextResponse.json({ 
      error: 'Status check failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      recommendation: 'Check database connection and try again'
    }, { status: 500 })
  }
}
