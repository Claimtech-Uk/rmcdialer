#!/usr/bin/env node

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Test MySQL connection
async function testConnection() {
  try {
    console.log('🔗 Loading environment variables...');
    console.log('REPLICA_DATABASE_URL defined:', !!process.env.REPLICA_DATABASE_URL);
    
    if (!process.env.REPLICA_DATABASE_URL) {
      console.error('❌ REPLICA_DATABASE_URL not found in environment');
      process.exit(1);
    }
    
    // Import and test connection (use tsx for TypeScript)
    const { testReplicaConnection } = await import('../lib/mysql.ts');
    const success = await testReplicaConnection();
    
    if (success) {
      console.log('\n🎉 SUCCESS! Connected to real user data!');
      process.exit(0);
    } else {
      console.log('\n❌ Connection failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testConnection(); 