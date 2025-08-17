/**
 * SMS Destination Number Migration
 * 
 * Safely adds destination_number tracking to SMS messages for proper routing.
 * 
 * What this does:
 * 1. Adds destination_number field to sms_messages table
 * 2. Backfills existing records with intelligent defaults
 * 3. Creates indexes for performance
 * 4. Validates migration success
 * 
 * Safety features:
 * - Non-blocking (nullable field)
 * - Comprehensive logging
 * - Rollback capability
 * - Validation checks
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationResult {
  success: boolean;
  recordsUpdated: number;
  errors: string[];
  duration: number;
}

async function runMigration(): Promise<MigrationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsUpdated = 0;

  try {
    console.log('🚀 Starting SMS destination number migration...');

    // Step 1: Check if field already exists
    try {
      await prisma.$queryRaw`SELECT destination_number FROM sms_messages LIMIT 1`;
      console.log('ℹ️ destination_number field already exists, skipping schema update');
    } catch (error) {
      console.log('📝 Adding destination_number field to schema...');
      
      // Add the column (this is safe - nullable field)
      await prisma.$executeRaw`
        ALTER TABLE sms_messages 
        ADD COLUMN destination_number VARCHAR(20) NULL
      `;
      
      console.log('✅ destination_number field added successfully');
    }

    // Step 2: Create index for performance (CONCURRENTLY for safety)
    try {
      await prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sms_destination_number 
        ON sms_messages(destination_number)
      `;
      console.log('✅ Index created successfully');
    } catch (error) {
      console.log('ℹ️ Index already exists or creation failed (non-critical):', error);
    }

    // Step 3: Count records that need backfilling
    const recordsToUpdate = await prisma.$queryRaw<[{count: bigint}]>`
      SELECT COUNT(*) as count 
      FROM sms_messages 
      WHERE destination_number IS NULL
    `;
    
    const totalToUpdate = Number(recordsToUpdate[0].count);
    console.log(`📊 Found ${totalToUpdate} records to backfill`);

    if (totalToUpdate === 0) {
      console.log('✅ No records need backfilling - migration complete');
      return {
        success: true,
        recordsUpdated: 0,
        errors: [],
        duration: Date.now() - startTime
      };
    }

    // Step 4: Intelligent backfill strategy
    console.log('🔧 Starting intelligent backfill...');
    
    // Backfill with conservative defaults based on message patterns
    const updateResult = await prisma.$executeRaw`
      UPDATE sms_messages 
      SET destination_number = CASE 
        WHEN message_type = 'auto_response' OR message_type = 'ai_agent' 
          THEN '+447723495560'  -- AI test number for AI responses
        WHEN message_type = 'manual' OR direction = 'outbound' 
          THEN '+447488879172'  -- Main number for manual/outbound
        WHEN direction = 'inbound' 
          THEN '+447488879172'  -- Most inbound likely came to main number
        ELSE '+447723495560'    -- Conservative default (AI test number)
      END
      WHERE destination_number IS NULL
    `;

    recordsUpdated = Number(updateResult);
    console.log(`✅ Updated ${recordsUpdated} records with destination numbers`);

    // Step 5: Validation checks
    console.log('🔍 Running validation checks...');

    // Check that all records now have destination numbers
    const nullRecords = await prisma.$queryRaw<[{count: bigint}]>`
      SELECT COUNT(*) as count 
      FROM sms_messages 
      WHERE destination_number IS NULL
    `;

    if (Number(nullRecords[0].count) > 0) {
      errors.push(`${nullRecords[0].count} records still have NULL destination_number`);
    }

    // Check distribution of destination numbers
    const distribution = await prisma.$queryRaw<Array<{destination_number: string, count: bigint}>>`
      SELECT 
        destination_number,
        COUNT(*) as count
      FROM sms_messages 
      GROUP BY destination_number
      ORDER BY count DESC
    `;

    console.log('📊 Destination number distribution:');
    distribution.forEach(row => {
      console.log(`  ${row.destination_number}: ${row.count} messages`);
    });

    console.log('✅ Migration completed successfully');

    return {
      success: errors.length === 0,
      recordsUpdated,
      errors,
      duration: Date.now() - startTime
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMsg);
    console.error('❌ Migration failed:', error);

    return {
      success: false,
      recordsUpdated,
      errors,
      duration: Date.now() - startTime
    };
  }
}

async function rollbackMigration(): Promise<void> {
  console.log('🔄 Rolling back SMS destination number migration...');
  
  try {
    // Remove the column (this will also remove the index)
    await prisma.$executeRaw`
      ALTER TABLE sms_messages 
      DROP COLUMN IF EXISTS destination_number
    `;
    
    console.log('✅ Rollback completed successfully');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    await rollbackMigration();
  } else {
    const result = await runMigration();
    
    console.log('\n📋 Migration Summary:');
    console.log(`Success: ${result.success}`);
    console.log(`Records Updated: ${result.recordsUpdated}`);
    console.log(`Duration: ${result.duration}ms`);
    
    if (result.errors.length > 0) {
      console.log('Errors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (!result.success) {
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main().catch(console.error).finally(() => prisma.$disconnect());
}

export { runMigration, rollbackMigration };
