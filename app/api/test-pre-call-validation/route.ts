import { NextResponse } from 'next/server';
import { PreCallValidationService } from '@/modules/queue/services/pre-call-validation.service';
import type { QueueType } from '@/modules/queue/types/queue.types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');
    const queueTypeParam = searchParams.get('queueType') as QueueType;
    const testHealthCheck = searchParams.get('healthCheck') === 'true';
    
    console.log('🧪 Starting pre-call validation test...');
    
    const validationService = new PreCallValidationService();
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test 1: Queue statistics
    console.log('📊 Testing queue statistics...');
    const queueStats = await validationService.getQueueStatistics();
    results.tests.push({
      name: 'Queue Statistics',
      status: 'success',
      data: queueStats
    });

    // Test 2: Specific user validation (if userId and queueType provided)
    if (userIdParam && queueTypeParam) {
      const userId = parseInt(userIdParam);
      console.log(`🔍 Testing validation for user ${userId} in ${queueTypeParam} queue...`);
      
      const validation = await validationService.validateUserForCall(userId, queueTypeParam);
      results.tests.push({
        name: `User ${userId} Validation`,
        status: validation.isValid ? 'valid' : 'invalid',
        data: validation
      });

      // Test 3: Get next valid user for the same queue type
      console.log(`🎯 Testing next valid user for ${queueTypeParam} queue...`);
      const nextUser = await validationService.getNextValidUserForCall(queueTypeParam);
      results.tests.push({
        name: `Next Valid User for ${queueTypeParam}`,
        status: nextUser ? 'found' : 'not_found',
        data: nextUser ? {
          userId: nextUser.userId,
          queuePosition: nextUser.queuePosition,
          validationStatus: nextUser.validationResult.isValid
        } : null
      });
    }

    // Test 4: Health check (if requested)
    if (testHealthCheck) {
      console.log('🏥 Testing queue health check...');
      
      for (const queueType of ['unsigned_users', 'outstanding_requests', 'callback'] as QueueType[]) {
        const healthCheck = await validationService.validateQueueHealth(queueType, 10);
        results.tests.push({
          name: `Health Check - ${queueType}`,
          status: 'completed',
          data: healthCheck
        });
      }
    }

    // Test 5: Sample next user from each queue type
    if (!userIdParam) {
      console.log('🔄 Testing next valid user for each queue type...');
      
      for (const queueType of ['unsigned_users', 'outstanding_requests', 'callback'] as QueueType[]) {
        try {
          const nextUser = await validationService.getNextValidUserForCall(queueType);
          results.tests.push({
            name: `Next User - ${queueType}`,
            status: nextUser ? 'found' : 'empty',
            data: nextUser ? {
              userId: nextUser.userId,
              queuePosition: nextUser.queuePosition,
              isValid: nextUser.validationResult.isValid,
              userStatus: nextUser.validationResult.userStatus
            } : { message: 'No users in queue' }
          });
        } catch (error: any) {
          results.tests.push({
            name: `Next User - ${queueType}`,
            status: 'error',
            data: { error: error.message }
          });
        }
      }
    }

    console.log('✅ Pre-call validation test completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Pre-call validation test completed',
      results,
      usage: {
        testSpecificUser: 'Add ?userId=12345&queueType=unsigned_users to test specific user',
        testHealthCheck: 'Add ?healthCheck=true to run health checks',
        testAll: 'No parameters to test next user from each queue'
      }
    });

  } catch (error: any) {
    console.error('❌ Pre-call validation test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString(),
      message: 'Pre-call validation test failed'
    }, { status: 500 });
  }
} 