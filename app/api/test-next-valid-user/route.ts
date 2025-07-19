import { NextResponse } from 'next/server';
import { PreCallValidationService } from '@/modules/queue/services/pre-call-validation.service';
import type { QueueType } from '@/modules/queue/types/queue.types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queueTypeParam = searchParams.get('queueType') as QueueType;
    
    console.log('🧪 Testing next valid user functionality with direct replica mode...');
    
    const validationService = new PreCallValidationService();
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test specific queue type if provided
    if (queueTypeParam) {
      console.log(`🎯 Testing next valid user for ${queueTypeParam} queue...`);
      
      try {
        const nextUser = await validationService.getNextValidUserDirectFromReplica(queueTypeParam);
        results.tests.push({
          name: `Next Valid User - ${queueTypeParam}`,
          status: nextUser ? 'found' : 'not_found',
          data: nextUser ? {
            userId: nextUser.userId,
            userName: `${nextUser.userContext.user.firstName} ${nextUser.userContext.user.lastName}`,
            phoneNumber: nextUser.userContext.user.phoneNumber,
            queuePosition: nextUser.queuePosition,
            isValid: nextUser.validationResult.isValid,
            userStatus: nextUser.validationResult.userStatus,
            queueType: nextUser.validationResult.currentQueueType,
            claimsCount: nextUser.userContext.claims.length,
            pendingRequirements: nextUser.userContext.claims.reduce((acc: number, claim: any) => 
              acc + claim.requirements.length, 0
            )
          } : { message: 'No valid users found' }
        });
      } catch (error: any) {
        results.tests.push({
          name: `Next Valid User - ${queueTypeParam}`,
          status: 'error',
          data: { error: error.message }
        });
      }
    } else {
      // Test all queue types
      console.log('🔄 Testing next valid user for all queue types...');
      
      for (const queueType of ['unsigned_users', 'outstanding_requests'] as QueueType[]) {
        try {
          const nextUser = await validationService.getNextValidUserDirectFromReplica(queueType);
          results.tests.push({
            name: `Next Valid User - ${queueType}`,
            status: nextUser ? 'found' : 'not_found',
            data: nextUser ? {
              userId: nextUser.userId,
              userName: `${nextUser.userContext.user.firstName} ${nextUser.userContext.user.lastName}`,
              phoneNumber: nextUser.userContext.user.phoneNumber,
              queuePosition: nextUser.queuePosition,
              isValid: nextUser.validationResult.isValid,
              userStatus: nextUser.validationResult.userStatus,
              queueType: nextUser.validationResult.currentQueueType,
              claimsCount: nextUser.userContext.claims.length,
              pendingRequirements: nextUser.userContext.claims.reduce((acc: number, claim: any) => 
                acc + claim.requirements.length, 0
              )
            } : { message: 'No valid users found' }
          });
        } catch (error: any) {
          results.tests.push({
            name: `Next Valid User - ${queueType}`,
            status: 'error',
            data: { error: error.message }
          });
        }
      }
    }

    console.log('✅ Next valid user test completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Next valid user test completed',
      results,
      usage: {
        testSpecificQueue: 'Add ?queueType=unsigned_users to test specific queue',
        testAll: 'No parameters to test all queue types',
        explanation: 'This tests the direct replica mode for finding next valid users'
      }
    });

  } catch (error: any) {
    console.error('❌ Next valid user test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString(),
      message: 'Next valid user test failed'
    }, { status: 500 });
  }
} 