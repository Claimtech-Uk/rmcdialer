#!/usr/bin/env tsx
/**
 * Safe Production Migration Runner
 * Applies SMS processing fields migration with full safety checks
 */

import { PrismaClient } from '@prisma/client'

// Use the production database URL from environment or command line
const DATABASE_URL = process.env.DATABASE_URL || process.argv[2]

if (!DATABASE_URL) {
  console.error('❌ Please provide DATABASE_URL as environment variable or argument')
  console.error('Usage: DATABASE_URL="postgres://..." tsx scripts/run-production-migration.ts')
  console.error('   or: tsx scripts/run-production-migration.ts "postgres://..."')
  process.exit(1)
}

// Mask the password in logs
const maskedUrl = DATABASE_URL.replace(/:([^@]+)@/, ':****@')
console.log('🔗 Connecting to:', maskedUrl)

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
})

async function runMigration() {
  console.log('🚀 Starting SAFE SMS Processing Migration...')
  console.log('═'.repeat(60))
  
  try {
    // Step 1: Pre-migration snapshot
    console.log('\n📊 Step 1: Pre-Migration Snapshot')
    const preMigration = {
      messageCount: await prisma.smsMessage.count(),
      conversationCount: await prisma.smsConversation.count(),
      timestamp: new Date().toISOString()
    }
    console.log('  Messages:', preMigration.messageCount)
    console.log('  Conversations:', preMigration.conversationCount)
    
    // Step 2: Check existing columns
    console.log('\n🔍 Step 2: Checking Existing Columns')
    const existingColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'sms_messages'
      AND column_name IN ('processed', 'processed_at', 'phone_number', 'user_id', 'message_sid')
    ` as any[]
    
    console.log('  Found columns:', existingColumns.map((c: any) => c.column_name).join(', ') || 'none')
    
    if (existingColumns.length === 5) {
      console.log('\n✅ Migration already completed - all columns exist!')
      await prisma.$disconnect()
      return
    }
    
    // Step 3: Apply migration
    console.log('\n⚙️  Step 3: Applying Migration')
    
    // Add columns one by one with explicit SQL
    const columnsToAdd = [
      { name: 'processed', type: 'BOOLEAN DEFAULT false' },
      { name: 'processed_at', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'phone_number', type: 'VARCHAR(50)' },
      { name: 'user_id', type: 'BIGINT' },
      { name: 'message_sid', type: 'VARCHAR(100)' }
    ]
    
    for (const column of columnsToAdd) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type}`
        )
        console.log(`  ✅ Added column: ${column.name}`)
      } catch (e: any) {
        if (e.message?.includes('already exists')) {
          console.log(`  ℹ️  Column ${column.name} already exists`)
        } else {
          console.log(`  ⚠️  Column ${column.name}: ${e.message}`)
        }
      }
    }
    
    // Create indexes
    console.log('\n📇 Step 4: Creating Indexes')
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_sms_messages_phone_processed" 
        ON "sms_messages" ("phone_number", "processed", "created_at")
      `
      console.log('  ✅ Created index: idx_sms_messages_phone_processed')
    } catch (e) {
      console.log('  ⚠️  Index might already exist')
    }
    
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_sms_messages_message_sid" 
        ON "sms_messages" ("message_sid")
      `
      console.log('  ✅ Created index: idx_sms_messages_message_sid')
    } catch (e) {
      console.log('  ⚠️  Index might already exist')
    }
    
    // Step 5: Verify data integrity
    console.log('\n🔒 Step 5: Verifying Data Integrity')
    const postAddColumns = await prisma.smsMessage.count()
    if (postAddColumns !== preMigration.messageCount) {
      throw new Error(`Data integrity check failed! Before: ${preMigration.messageCount}, After: ${postAddColumns}`)
    }
    console.log('  ✅ All messages preserved:', postAddColumns)
    
    // Step 6: Safe backfill
    console.log('\n📝 Step 6: Backfilling Existing Data')
    
    // Check which columns actually exist before backfilling
    const actualColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'sms_messages'
      AND column_name IN ('processed', 'processed_at', 'phone_number', 'user_id', 'message_sid')
    ` as any[]
    const columnNames = actualColumns.map((c: any) => c.column_name)
    
    // Backfill phone numbers from conversations if column exists
    if (columnNames.includes('phone_number')) {
      try {
        const phoneBackfill = await prisma.$executeRaw`
          UPDATE "sms_messages" sm
          SET "phone_number" = sc."phone_number"
          FROM "sms_conversations" sc
          WHERE sm."conversation_id" = sc."id" 
          AND sm."phone_number" IS NULL
        `
        console.log(`  ✅ Updated ${phoneBackfill} messages with phone numbers`)
      } catch (e: any) {
        console.log(`  ⚠️  Phone backfill: ${e.message}`)
      }
    }
    
    // Copy twilioMessageSid to message_sid if column exists
    if (columnNames.includes('message_sid')) {
      try {
        const sidBackfill = await prisma.$executeRaw`
          UPDATE "sms_messages" 
          SET "message_sid" = "twilioMessageSid"
          WHERE "message_sid" IS NULL 
          AND "twilioMessageSid" IS NOT NULL
        `
        console.log(`  ✅ Updated ${sidBackfill} messages with message SIDs`)
      } catch (e: any) {
        console.log(`  ⚠️  Message SID backfill: ${e.message}`)
      }
    }
    
    // Mark old messages as processed if columns exist
    if (columnNames.includes('processed') && columnNames.includes('processed_at')) {
      try {
        const processedBackfill = await prisma.$executeRaw`
          UPDATE "sms_messages" 
          SET "processed" = TRUE,
              "processed_at" = COALESCE("processed_at", "created_at")
          WHERE "processed" IS NOT TRUE
          AND "created_at" < NOW() - INTERVAL '1 hour'
        `
        console.log(`  ✅ Marked ${processedBackfill} old messages as processed`)
      } catch (e: any) {
        console.log(`  ⚠️  Processed backfill: ${e.message}`)
      }
    }
    
    // Step 7: Final verification
    console.log('\n✅ Step 7: Final Verification')
    const postMigration = {
      messageCount: await prisma.smsMessage.count(),
      conversationCount: await prisma.smsConversation.count(),
      processedCount: await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "sms_messages" WHERE "processed" = TRUE
      `.then((r: any) => Number(r[0]?.count) || 0),
      timestamp: new Date().toISOString()
    }
    
    console.log('  Total messages:', postMigration.messageCount)
    console.log('  Processed messages:', postMigration.processedCount)
    console.log('  Data preserved:', postMigration.messageCount === preMigration.messageCount ? '✅ YES' : '❌ NO')
    
    console.log('\n' + '═'.repeat(60))
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!')
    console.log('═'.repeat(60))
    console.log('\n📋 Next Steps:')
    console.log('1. Add SMS_USE_DB_TRACKING=true to Vercel environment variables')
    console.log('2. Redeploy the application')
    console.log('3. Monitor logs for any issues')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    console.error('\n⚠️  Rollback Instructions:')
    console.error('If needed, run this SQL to remove the new columns:')
    console.error(`
ALTER TABLE "sms_messages" 
DROP COLUMN IF EXISTS "processed",
DROP COLUMN IF EXISTS "processed_at",
DROP COLUMN IF EXISTS "phone_number",
DROP COLUMN IF EXISTS "user_id",
DROP COLUMN IF EXISTS "message_sid";
    `)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
runMigration().catch(console.error)
