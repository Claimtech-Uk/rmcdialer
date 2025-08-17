// Simple migration script for SMS batching
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function applyMigration() {
  console.log('🔧 Applying SMS Batching Migration (Simple Version)\n');
  
  try {
    // Add columns one by one
    const columns = [
      { name: 'batch_id', type: 'VARCHAR(100)' },
      { name: 'batch_processed', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'batch_response_sent', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'batch_created_at', type: 'TIMESTAMP' }
    ];
    
    for (const col of columns) {
      try {
        console.log(`Adding column ${col.name}...`);
        await prisma.$executeRawUnsafe(
          `ALTER TABLE sms_messages ADD COLUMN ${col.name} ${col.type}`
        );
        console.log(`  ✅ Added ${col.name}`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate column')) {
          console.log(`  ⏭️  ${col.name} already exists`);
        } else {
          console.log(`  ⚠️  Error: ${error.message}`);
        }
      }
    }
    
    // Create indexes
    console.log('\nCreating indexes...');
    
    const indexes = [
      {
        name: 'idx_sms_batch_processing',
        sql: 'CREATE INDEX idx_sms_batch_processing ON sms_messages(batch_id, batch_processed) WHERE direction = \'inbound\''
      },
      {
        name: 'idx_sms_batch_ready',
        sql: 'CREATE INDEX idx_sms_batch_ready ON sms_messages(batch_id, batch_created_at) WHERE direction = \'inbound\' AND batch_processed = FALSE'
      }
    ];
    
    for (const idx of indexes) {
      try {
        await prisma.$executeRawUnsafe(idx.sql);
        console.log(`  ✅ Created ${idx.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  ${idx.name} already exists`);
        } else {
          console.log(`  ⚠️  Error creating ${idx.name}: ${error.message}`);
        }
      }
    }
    
    // Create sms_batch_status table
    console.log('\nCreating sms_batch_status table...');
    
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE sms_batch_status (
          batch_id VARCHAR(100) PRIMARY KEY,
          phone_number VARCHAR(20) NOT NULL,
          message_count INT DEFAULT 0,
          processing_started BOOLEAN DEFAULT FALSE,
          processing_started_at TIMESTAMP,
          processing_completed BOOLEAN DEFAULT FALSE,
          processing_completed_at TIMESTAMP,
          response_text TEXT,
          response_sent BOOLEAN DEFAULT FALSE,
          response_sent_at TIMESTAMP,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('  ✅ Created sms_batch_status table');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('  ⏭️  sms_batch_status table already exists');
      } else {
        console.log('  ⚠️  Error: ' + error.message);
      }
    }
    
    // Create table indexes
    const tableIndexes = [
      'CREATE INDEX idx_batch_status_phone ON sms_batch_status(phone_number, created_at)',
      'CREATE INDEX idx_batch_status_ready ON sms_batch_status(processing_started, created_at)'
    ];
    
    for (const sql of tableIndexes) {
      try {
        await prisma.$executeRawUnsafe(sql);
        console.log('  ✅ Created index');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('  ⏭️  Index already exists');
        } else {
          console.log('  ⚠️  Error: ' + error.message);
        }
      }
    }
    
    // Test the new setup
    console.log('\n🔍 Testing migration...');
    
    const testBatchId = `test:${Math.floor(Date.now() / 15000)}`;
    
    try {
      // Test batch status table
      await prisma.smsBatchStatus.create({
        data: {
          batchId: testBatchId,
          phoneNumber: '447700900000',
          messageCount: 0
        }
      });
      console.log('  ✅ SmsBatchStatus table working');
      
      // Clean up
      await prisma.smsBatchStatus.delete({
        where: { batchId: testBatchId }
      });
      
    } catch (error) {
      console.log('  ⚠️  Test failed:', error.message);
    }
    
    console.log('\n✅ Migration completed!');
    console.log('\n📋 Next steps:');
    console.log('  1. Run: npm run db:generate');
    console.log('  2. Test locally: node scripts/check-sms-block.js');
    console.log('  3. Deploy: vercel --prod');
    console.log('  4. Monitor: curl https://yourapp.vercel.app/api/debug/sms-batch-status');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
