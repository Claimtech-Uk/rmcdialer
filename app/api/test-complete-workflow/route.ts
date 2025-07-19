import { NextResponse } from 'next/server';
import { PreCallValidationService } from '@/modules/queue/services/pre-call-validation.service';
import type { QueueType } from '@/modules/queue/types/queue.types';

export async function GET(request: Request) {
  try {
    console.log('🎯 Running complete workflow test...');
    
    const validationService = new PreCallValidationService();
    const results: any = {
      timestamp: new Date().toISOString(),
      workflow: [],
      summary: {
        totalQueuesTest: 0,
        validUsersFound: 0,
        readyForCalls: 0
      }
    };

    // Test workflow for each queue type
    for (const queueType of ['unsigned_users', 'outstanding_requests'] as QueueType[]) {
      console.log(`\n🔍 Testing ${queueType} workflow...`);
      
      const workflowStep = {
        queueType,
        step1_discovery: null as any,
        step2_validation: null as any,
        step3_userContext: null as any,
        step4_readyForCall: false
      };
      
      // Step 1: Discovery - Find next valid user
      console.log(`📋 Step 1: Discovering next valid user for ${queueType}...`);
      try {
        const nextUser = await validationService.getNextValidUserDirectFromReplica(queueType);
        
        workflowStep.step1_discovery = {
          status: nextUser ? 'found' : 'not_found',
          data: nextUser ? {
            userId: nextUser.userId,
            userName: `${nextUser.userContext.user.firstName} ${nextUser.userContext.user.lastName}`,
            queuePosition: nextUser.queuePosition
          } : { message: 'No users found' }
        };
        
        if (nextUser) {
          results.summary.validUsersFound++;
          
          // Step 2: Validation - Confirm user is valid
          console.log(`✅ Step 2: Validating user ${nextUser.userId}...`);
          const validation = await validationService.validateUserForCall(nextUser.userId, queueType);
          
          workflowStep.step2_validation = {
            status: validation.isValid ? 'valid' : 'invalid',
            data: {
              isValid: validation.isValid,
              reason: validation.reason,
              currentQueueType: validation.currentQueueType,
              userStatus: validation.userStatus
            }
          };
          
          if (validation.isValid) {
            // Step 3: User Context - Get complete call context
            console.log(`📞 Step 3: Preparing call context for user ${nextUser.userId}...`);
            
            workflowStep.step3_userContext = {
              status: 'ready',
              data: {
                userId: nextUser.userContext.user.id,
                fullName: `${nextUser.userContext.user.firstName} ${nextUser.userContext.user.lastName}`,
                phoneNumber: nextUser.userContext.user.phoneNumber,
                claims: nextUser.userContext.claims.map((claim: any) => ({
                  id: claim.id,
                  claimNumber: claim.claimNumber,
                  status: claim.status,
                  pendingRequirements: claim.requirements.length,
                  requirementTypes: claim.requirements.map((req: any) => req.type)
                })),
                callReady: {
                  hasPhoneNumber: !!nextUser.userContext.user.phoneNumber,
                  isEnabled: nextUser.userContext.user.isEnabled,
                  hasValidClaims: nextUser.userContext.claims.length > 0
                }
              }
            };
            
            // Step 4: Ready for Call - Final check
            const hasPhoneNumber = !!nextUser.userContext.user.phoneNumber;
            const isEnabled = nextUser.userContext.user.isEnabled;
            const hasValidClaims = nextUser.userContext.claims.length > 0;
            
            workflowStep.step4_readyForCall = hasPhoneNumber && isEnabled && hasValidClaims;
            
            if (workflowStep.step4_readyForCall) {
              results.summary.readyForCalls++;
              console.log(`🎉 Step 4: User ${nextUser.userId} is READY FOR CALL!`);
            } else {
              console.log(`⚠️ Step 4: User ${nextUser.userId} has issues - phone: ${hasPhoneNumber}, enabled: ${isEnabled}, claims: ${hasValidClaims}`);
            }
          }
        }
        
      } catch (error: any) {
        workflowStep.step1_discovery = {
          status: 'error',
          data: { error: error.message }
        };
      }
      
      results.workflow.push(workflowStep);
      results.summary.totalQueuesTest++;
    }

    // Generate summary
    const summary = results.summary;
    let overallStatus = 'success';
    let message = '';
    
    if (summary.readyForCalls === 0) {
      overallStatus = 'no_users_ready';
      message = 'No users ready for calling - queues may be empty or need attention';
    } else if (summary.readyForCalls < summary.totalQueuesTest) {
      overallStatus = 'partial_success';
      message = `${summary.readyForCalls}/${summary.totalQueuesTest} queues have users ready for calling`;
    } else {
      overallStatus = 'full_success';
      message = `All ${summary.totalQueuesTest} queues have users ready for calling`;
    }

    console.log(`\n🎯 Complete workflow test finished: ${message}`);
    
    return NextResponse.json({
      success: true,
      message: 'Complete workflow test finished',
      overallStatus,
      results,
      architecture: {
        mode: 'Direct MySQL Replica',
        description: 'Real-time validation and user discovery directly from MySQL replica',
        benefits: [
          'Zero wrong calls (real-time validation)',
          'Works without PostgreSQL queue',
          'Immediate access to 9,800+ users',
          'No cache staleness issues'
        ],
        workflow: [
          '1. Agent clicks "Call Next Valid User"',
          '2. System queries MySQL replica for eligible users',
          '3. Real-time validation confirms user status',
          '4. User context prepared for call',
          '5. Call initiated with guaranteed valid user'
        ]
      },
      usage: {
        testEndToEnd: 'This tests the complete workflow from discovery to call readiness',
        agentWorkflow: 'This simulates what happens when an agent clicks "Call Next Valid User"',
        systemStatus: 'Shows the current health and readiness of the calling system'
      }
    });

  } catch (error: any) {
    console.error('❌ Complete workflow test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString(),
      message: 'Complete workflow test failed'
    }, { status: 500 });
  }
} 