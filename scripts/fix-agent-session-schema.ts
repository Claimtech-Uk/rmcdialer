import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAgentSessionSchema() {
  console.log('🔧 Checking and fixing agent_sessions table schema...\n');
  
  try {
    // Check what columns exist
    const columns = await prisma.$queryRaw`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM 
        information_schema.columns 
      WHERE 
        table_name = 'agent_sessions'
      ORDER BY 
        ordinal_position
    ` as any[];
    
    console.log('Current agent_sessions columns:');
    console.table(columns);
    
    // Add missing columns if needed
    const columnNames = columns.map((c: any) => c.column_name);
    
    // Check for loginAt column (might be login_at in DB)
    if (!columnNames.includes('login_at')) {
      console.log('\n⚠️  Missing login_at column, adding...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE agent_sessions 
        ADD COLUMN IF NOT EXISTS login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✅ login_at column added');
    }
    
    // Check for endedAt column  
    if (!columnNames.includes('ended_at')) {
      console.log('\n⚠️  Missing ended_at column, adding...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE agent_sessions 
        ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP NULL
      `);
      console.log('✅ ended_at column added');
    }
    
    // Check for lastActivity column
    if (!columnNames.includes('last_activity')) {
      console.log('\n⚠️  Missing last_activity column, adding...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE agent_sessions 
        ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✅ last_activity column added');
    }
    
    // Check for lastHeartbeat column
    if (!columnNames.includes('last_heartbeat')) {
      console.log('\n⚠️  Missing last_heartbeat column, adding...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE agent_sessions 
        ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✅ last_heartbeat column added');
    }
    
    console.log('\n✅ Schema check/fix completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixAgentSessionSchema().catch(console.error);