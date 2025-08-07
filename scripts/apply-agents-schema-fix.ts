import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAgentsSchema() {
  console.log('🔧 Fixing agents table schema mismatch...');
  
  try {
    // Add created_by column
    console.log('Adding created_by column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS created_by INTEGER NULL
    `);
    console.log('✅ created_by column added/verified');
    
    // Add last_login_at column
    console.log('Adding last_login_at column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL
    `);
    console.log('✅ last_login_at column added/verified');
    
    // Add updated_by column
    console.log('Adding updated_by column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS updated_by INTEGER NULL
    `);
    console.log('✅ updated_by column added/verified');
    
    // Verify columns exist
    const columns = await prisma.$queryRaw`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM 
        information_schema.columns 
      WHERE 
        table_name = 'agents' 
        AND column_name IN ('created_by', 'last_login_at', 'updated_by')
      ORDER BY 
        column_name
    `;
    
    console.log('\n📊 Schema verification:');
    console.table(columns);
    
    console.log('\n✅ Schema fix completed successfully!');
    console.log('🚀 The login should work now.');
    
  } catch (error) {
    console.error('❌ Error fixing schema:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixAgentsSchema().catch(console.error);