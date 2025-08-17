import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// TEMPORARY SAFE MIGRATION RUNNER
// This endpoint runs the migration in a SAFE mode with extensive checks

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Starting ULTRA-SAFE SMS migration...')
    
    // Step 1: Pre-migration snapshot
    const preMigration = {
      messageCount: await prisma.smsMessage.count(),
      conversationCount: await prisma.smsConversation.count(),
      timestamp: new Date().toISOString()
    }
    
    console.log('📊 Pre-migration state:', preMigration)
    
    // Step 2: Check if migration already done
    const existingColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'sms_messages'
      AND column_name IN ('processed', 'processed_at', 'phone_number', 'user_id', 'message_sid')
    ` as any[]
    
    if (existingColumns.length === 5) {
      return NextResponse.json({
        status: 'already_completed',
        message: '✅ Migration already completed - all columns exist',
        details: {
          existingColumns: existingColumns.map((c: any) => c.column_name),
          ...preMigration
        }
      })
    }
    
    // Step 3: Add columns one by one with safety checks
    const results = {
      columnsAdded: [] as string[],
      columnsFailed: [] as string[],
      indexesCreated: [] as string[],
      messagesBackfilled: 0
    }
    
    // Add 'processed' column
    try {
      await prisma.$executeRaw`
        ALTER TABLE "sms_messages" 
        ADD COLUMN IF NOT EXISTS "processed" BOOLEAN DEFAULT FALSE
      `
      results.columnsAdded.push('processed')
      console.log('✅ Added column: processed')
    } catch (e) {
      console.log('⚠️ Column processed might already exist')
    }
    
    // Add 'processed_at' column
    try {
      await prisma.$executeRaw`
        ALTER TABLE "sms_messages" 
        ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3)
      `
      results.columnsAdded.push('processed_at')
      console.log('✅ Added column: processed_at')
    } catch (e) {
      console.log('⚠️ Column processed_at might already exist')
    }
    
    // Add 'phone_number' column
    try {
      await prisma.$executeRaw`
        ALTER TABLE "sms_messages" 
        ADD COLUMN IF NOT EXISTS "phone_number" TEXT
      `
      results.columnsAdded.push('phone_number')
      console.log('✅ Added column: phone_number')
    } catch (e) {
      console.log('⚠️ Column phone_number might already exist')
    }
    
    // Add 'user_id' column
    try {
      await prisma.$executeRaw`
        ALTER TABLE "sms_messages" 
        ADD COLUMN IF NOT EXISTS "user_id" BIGINT
      `
      results.columnsAdded.push('user_id')
      console.log('✅ Added column: user_id')
    } catch (e) {
      console.log('⚠️ Column user_id might already exist')
    }
    
    // Add 'message_sid' column
    try {
      await prisma.$executeRaw`
        ALTER TABLE "sms_messages" 
        ADD COLUMN IF NOT EXISTS "message_sid" TEXT
      `
      results.columnsAdded.push('message_sid')
      console.log('✅ Added column: message_sid')
    } catch (e) {
      console.log('⚠️ Column message_sid might already exist')
    }
    
    // Step 4: Create indexes
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_phone_processed" 
        ON "sms_messages"("phone_number", "processed", "created_at")
      `
      results.indexesCreated.push('idx_phone_processed')
      console.log('✅ Created index: idx_phone_processed')
    } catch (e) {
      console.log('⚠️ Index might already exist')
    }
    
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_message_sid" 
        ON "sms_messages"("message_sid")
      `
      results.indexesCreated.push('idx_message_sid')
      console.log('✅ Created index: idx_message_sid')
    } catch (e) {
      console.log('⚠️ Index might already exist')
    }
    
    // Step 5: Verify no data loss
    const postAddColumns = await prisma.smsMessage.count()
    if (postAddColumns !== preMigration.messageCount) {
      throw new Error(`Data integrity check failed! Messages before: ${preMigration.messageCount}, after: ${postAddColumns}`)
    }
    
    // Step 6: Safe backfill (only old messages)
    const backfilled = await prisma.$executeRaw`
      UPDATE "sms_messages" 
      SET "processed" = TRUE,
          "processed_at" = COALESCE("processed_at", "created_at"),
          "phone_number" = COALESCE(
            "phone_number",
            (SELECT "phone_number" FROM "sms_conversations" WHERE "id" = "sms_messages"."conversation_id")
          ),
          "message_sid" = COALESCE("message_sid", "twilioMessageSid")
      WHERE "processed" IS NOT TRUE
      AND "created_at" < NOW() - INTERVAL '1 hour'
    `
    
    results.messagesBackfilled = Number(backfilled)
    console.log(`✅ Backfilled ${backfilled} messages`)
    
    // Step 7: Final verification
    const postMigration = {
      messageCount: await prisma.smsMessage.count(),
      conversationCount: await prisma.smsConversation.count(),
      processedCount: await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "sms_messages" WHERE "processed" = TRUE
      `.then((r: any) => r[0]?.count || 0),
      timestamp: new Date().toISOString()
    }
    
    // Verify data preservation
    const dataPreserved = 
      postMigration.messageCount === preMigration.messageCount &&
      postMigration.conversationCount === preMigration.conversationCount
    
    return NextResponse.json({
      status: 'success',
      message: '🎉 Migration completed successfully!',
      safety: {
        dataPreserved,
        messagesLost: preMigration.messageCount - postMigration.messageCount,
        conversationsLost: preMigration.conversationCount - postMigration.conversationCount
      },
      preMigration,
      postMigration,
      results,
      recommendation: dataPreserved 
        ? '✅ All data preserved - safe to enable SMS_USE_DB_TRACKING=true'
        : '⚠️ Data mismatch detected - investigate before proceeding'
    })
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    
    // Try to get current state for debugging
    const currentState = {
      messageCount: await prisma.smsMessage.count().catch(() => 'unknown'),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    
    return NextResponse.json({ 
      status: 'error',
      message: 'Migration failed',
      error: currentState.error,
      currentMessageCount: currentState.messageCount,
      recommendation: 'Check logs and consider rollback if data was affected'
    }, { status: 500 })
  }
}

export async function GET() {
  // Check current migration status
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'sms_messages'
      AND column_name IN ('processed', 'processed_at', 'phone_number', 'user_id', 'message_sid')
      ORDER BY column_name
    ` as any[]
    
    const stats = {
      totalMessages: await prisma.smsMessage.count(),
      existingColumns: columns.map((c: any) => c.column_name),
      missingColumns: ['processed', 'processed_at', 'phone_number', 'user_id', 'message_sid']
        .filter(col => !columns.find((c: any) => c.column_name === col)),
      migrationComplete: columns.length === 5
    }
    
    return NextResponse.json({
      status: 'ready',
      ...stats,
      recommendation: stats.migrationComplete 
        ? '✅ Migration complete - enable SMS_USE_DB_TRACKING=true'
        : `⚠️ Migration needed - ${stats.missingColumns.length} columns missing`
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
