import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Force dynamic rendering to prevent build-time database calls
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Check auth
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.ADMIN_API_SECRET || 'your-secret-token'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🚀 Starting SAFE SMS processing migration...')
    
    // SAFETY CHECK 1: Count existing messages first
    const messageCount = await prisma.smsMessage.count()
    console.log(`📊 Found ${messageCount} existing SMS messages to preserve`)

    // Check if columns already exist
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'sms_messages'
      AND column_name IN ('processed', 'processed_at', 'phone_number', 'user_id', 'message_sid')
    ` as any[]

    const existingColumns = new Set(tableInfo.map((row: any) => row.column_name))

    // Add missing columns
    const migrations = []
    
    if (!existingColumns.has('processed')) {
      migrations.push(prisma.$executeRaw`
        ALTER TABLE "sms_messages" 
        ADD COLUMN IF NOT EXISTS "processed" BOOLEAN NOT NULL DEFAULT FALSE
      `)
    }
    
    if (!existingColumns.has('processed_at')) {
      migrations.push(prisma.$executeRaw`
        ALTER TABLE "sms_messages" 
        ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3)
      `)
    }
    
    if (!existingColumns.has('phone_number')) {
      migrations.push(prisma.$executeRaw`
        ALTER TABLE "sms_messages" 
        ADD COLUMN IF NOT EXISTS "phone_number" TEXT
      `)
    }
    
    if (!existingColumns.has('user_id')) {
      migrations.push(prisma.$executeRaw`
        ALTER TABLE "sms_messages" 
        ADD COLUMN IF NOT EXISTS "user_id" BIGINT
      `)
    }
    
    if (!existingColumns.has('message_sid')) {
      migrations.push(prisma.$executeRaw`
        ALTER TABLE "sms_messages" 
        ADD COLUMN IF NOT EXISTS "message_sid" TEXT
      `)
    }

    // Run migrations
    if (migrations.length > 0) {
      await Promise.all(migrations)
      console.log(`✅ Added ${migrations.length} columns`)
    } else {
      console.log('✅ All columns already exist')
    }

    // Create indexes if they don't exist
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_phone_processed" 
        ON "sms_messages"("phone_number", "processed", "created_at")
      `
      console.log('✅ Created phone_processed index')
    } catch (e) {
      console.log('⚠️ Index idx_phone_processed might already exist')
    }

    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_message_sid" 
        ON "sms_messages"("message_sid")
      `
      console.log('✅ Created message_sid index')
    } catch (e) {
      console.log('⚠️ Index idx_message_sid might already exist')
    }

    // SAFETY CHECK 2: Verify no data loss after column additions
    const messageCountAfter = await prisma.smsMessage.count()
    if (messageCountAfter !== messageCount) {
      throw new Error(`Data integrity check failed! Before: ${messageCount}, After: ${messageCountAfter}`)
    }
    
    // Backfill existing data (mark old messages as already processed)
    // Only update messages older than 1 hour to avoid race conditions
    const updated = await prisma.$executeRaw`
      UPDATE "sms_messages" 
      SET "processed" = TRUE,
          "processed_at" = COALESCE("processed_at", "created_at")
      WHERE ("processed" IS NULL OR "processed" = FALSE)
      AND "created_at" < NOW() - INTERVAL '1 hour'
    `
    
    console.log(`✅ Safely backfilled ${updated} existing messages as processed`)
    
    // SAFETY CHECK 3: Final verification
    const finalCount = await prisma.smsMessage.count()
    const processedCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM "sms_messages" 
      WHERE "processed" = TRUE
    ` as any[]
    
    return NextResponse.json({ 
      success: true,
      message: 'SMS processing migration completed SAFELY',
      safety: {
        dataPreserved: finalCount === messageCount,
        originalMessageCount: messageCount,
        finalMessageCount: finalCount,
        messagesProcessed: processedCount[0]?.count || 0
      },
      columnsAdded: migrations.length,
      messagesBackfilled: updated,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'SMS processing migration endpoint',
    usage: 'POST with Authorization: Bearer [ADMIN_API_SECRET]'
  })
}
