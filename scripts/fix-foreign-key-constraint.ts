#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixForeignKeyConstraint() {
  console.log('🔧 Fixing foreign key constraint for call_queue...');
  
  try {
    // Option 1: Remove the foreign key constraint temporarily
    await prisma.$executeRaw`ALTER TABLE call_queue DROP CONSTRAINT IF EXISTS call_queue_user_id_fkey;`;
    
    console.log('✅ Removed foreign key constraint on call_queue.user_id');
    console.log('🎯 Queue discovery can now add users from MySQL replica');
    
    // Test the fix
    const testResult = await prisma.callQueue.count();
    console.log(`📊 Current queue entries: ${testResult}`);
    
  } catch (error) {
    console.error('❌ Failed to fix foreign key constraint:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixForeignKeyConstraint();
