#!/usr/bin/env tsx

/**
 * Test Script: Simplified Callback System
 * 
 * Tests the new callback flow:
 * 1. Create callback with queue type
 * 2. Verify auto-dialler picks it up as highest priority
 * 3. Verify it routes to correct queue type
 */

import { PrismaClient } from '@prisma/client';
import { PreCallValidationService } from '../modules/queue/services/pre-call-validation.service';
import { UserService } from '../modules/users';

const prisma = new PrismaClient();

async function testSimplifiedCallbackSystem() {
  console.log('🧪 Testing Simplified Callback System...\n');

  try {
    // 1. Find a test user in unsigned queue
    const testUser = await prisma.userCallScore.findFirst({
      where: {
        currentQueueType: 'unsigned_users',
        isActive: true
      }
    });

    if (!testUser) {
      console.log('❌ No test user found in unsigned queue');
      return;
    }

    console.log(`👤 Test user: ${testUser.userId} (queue: ${testUser.currentQueueType})`);

    // 2. Create a test callback for this user
    const callback = await prisma.callback.create({
      data: {
        userId: testUser.userId,
        scheduledFor: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (overdue)
        callbackReason: 'Test callback for simplified system',
        queueType: testUser.currentQueueType!, // Should be 'unsigned_users'
        originalCallSessionId: '00000000-0000-0000-0000-000000000000', // Dummy session ID
        status: 'pending'
      }
    });

    console.log(`📞 Created test callback: ${callback.id}`);
    console.log(`   Queue Type: ${callback.queueType}`);
    console.log(`   Scheduled: ${callback.scheduledFor} (overdue)`);

    // 3. Test auto-dialler priority - should return callback first
    const userService = new UserService();
    const validationService = new PreCallValidationService({
      prisma,
      userService,
      logger: {
        info: (msg, meta) => console.log(`[INFO] ${msg}`, meta),
        error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
        warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta)
      }
    });

    console.log('\n🎯 Testing auto-dialler priority...');
    const nextUser = await validationService.getNextValidUserForCall('unsigned_users', 1);

    if (nextUser && nextUser.queueEntryId === `callback-${callback.id}`) {
      console.log('✅ SUCCESS: Auto-dialler returned callback as highest priority!');
      console.log(`   Queue Entry ID: ${nextUser.queueEntryId}`);
      console.log(`   User ID: ${nextUser.userId}`);
      
      if (nextUser.userContext.isCallbackCall) {
        console.log('✅ SUCCESS: Callback markers are set correctly!');
        console.log(`   Callback Reason: ${nextUser.userContext.callbackData?.reason}`);
      } else {
        console.log('⚠️  WARNING: Callback markers not set');
      }
    } else {
      console.log('❌ FAILURE: Auto-dialler did not return callback');
      console.log(`   Expected: callback-${callback.id}`);
      console.log(`   Got: ${nextUser?.queueEntryId}`);
    }

    // 4. Test wrong queue type - should NOT return callback for different queue
    console.log('\n🔍 Testing queue isolation...');
    const wrongQueueUser = await validationService.getNextValidUserForCall('outstanding_requests', 1);
    
    if (wrongQueueUser && wrongQueueUser.queueEntryId === `callback-${callback.id}`) {
      console.log('❌ FAILURE: Callback appeared in wrong queue type!');
    } else {
      console.log('✅ SUCCESS: Callback correctly isolated to its queue type!');
    }

    // 5. Cleanup - remove test callback
    await prisma.callback.delete({
      where: { id: callback.id }
    });
    console.log('\n🧹 Test callback cleaned up');

    console.log('\n🎉 Simplified callback system test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testSimplifiedCallbackSystem();
}

export { testSimplifiedCallbackSystem };
