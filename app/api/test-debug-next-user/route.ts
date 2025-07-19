import { NextResponse } from 'next/server';
import { replicaDb } from '@/lib/mysql';
import type { QueueType } from '@/modules/queue/types/queue.types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queueTypeParam = searchParams.get('queueType') as QueueType || 'unsigned_users';
    
    console.log(`🔍 Debug: Finding next valid user for ${queueTypeParam} queue...`);
    
    const results: any = {
      timestamp: new Date().toISOString(),
      debug: []
    };

    // Step 1: Find users in MySQL replica (same logic as getNextValidUserDirectFromReplica)
    console.log('🔍 Step 1: Querying MySQL replica for candidates...');
    
    let users: any[] = [];
    
    if (queueTypeParam === 'unsigned_users') {
      users = await replicaDb.user.findMany({
        where: {
          is_enabled: true,
          current_signature_file_id: null,
          claims: {
            some: {
              status: { not: 'complete' }
            }
          }
        },
        include: {
          claims: {
            include: {
              requirements: {
                where: { status: 'PENDING' }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 5
      });
    } else if (queueTypeParam === 'outstanding_requests') {
      users = await replicaDb.user.findMany({
        where: {
          is_enabled: true,
          current_signature_file_id: { not: null },
          claims: {
            some: {
              requirements: {
                some: {
                  status: 'PENDING'
                }
              }
            }
          }
        },
        include: {
          claims: {
            include: {
              requirements: {
                where: { status: 'PENDING' }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 5
      });
    }

    results.debug.push({
      step: 'MySQL Query',
      status: 'success',
      data: {
        queueType: queueTypeParam,
        candidatesFound: users.length,
        candidates: users.map(user => ({
          userId: Number(user.id),
          firstName: user.first_name,
          lastName: user.last_name,
          hasSignature: !!user.current_signature_file_id,
          isEnabled: user.is_enabled,
          claimsCount: user.claims.length,
          pendingRequirements: user.claims.reduce((acc: number, claim: any) => acc + claim.requirements.length, 0)
        }))
      }
    });

    if (users.length === 0) {
      console.log(`❌ No candidate users found for ${queueTypeParam}`);
      return NextResponse.json({
        success: true,
        message: 'Debug completed - no candidates found',
        results
      });
    }

    // Step 2: Test validation for each candidate
    console.log('🔍 Step 2: Testing validation for each candidate...');
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const userId = Number(user.id);
      
      console.log(`🧪 Testing user ${userId} (${user.first_name} ${user.last_name})...`);
      
      // Simple validation check (without full UserService)
      const hasSignature = user.current_signature_file_id !== null;
      const pendingRequirements = user.claims.reduce((acc: number, claim: any) => acc + claim.requirements.length, 0);
      const isEnabled = user.is_enabled;
      
      let isValid = false;
      let currentQueueType: QueueType | null = null;
      let validationReason = '';
      
      if (!isEnabled) {
        validationReason = 'User is disabled';
      } else if (queueTypeParam === 'unsigned_users' && hasSignature) {
        validationReason = 'User already has signature';
      } else if (queueTypeParam === 'outstanding_requests' && !hasSignature) {
        validationReason = 'User missing signature';
      } else if (queueTypeParam === 'outstanding_requests' && pendingRequirements === 0) {
        validationReason = 'No pending requirements';
      } else {
        isValid = true;
        currentQueueType = queueTypeParam;
        validationReason = 'Valid for queue';
      }

      results.debug.push({
        step: `Validate User ${userId}`,
        status: isValid ? 'valid' : 'invalid',
        data: {
          userId,
          firstName: user.first_name,
          lastName: user.last_name,
          validation: {
            isValid,
            currentQueueType,
            reason: validationReason,
            checks: {
              isEnabled,
              hasSignature,
              pendingRequirements,
              queueMatch: currentQueueType === queueTypeParam
            }
          }
        }
      });

      if (isValid) {
        console.log(`✅ Found valid user: ${userId} - ${user.first_name} ${user.last_name}`);
        
        results.debug.push({
          step: 'Success',
          status: 'found_valid_user',
          data: {
            selectedUserId: userId,
            selectedUserName: `${user.first_name} ${user.last_name}`,
            position: i + 1,
            totalCandidates: users.length
          }
        });
        break;
      }
    }

    console.log('✅ Debug test completed');
    
    return NextResponse.json({
      success: true,
      message: 'Debug test completed',
      results,
      usage: {
        testSpecificQueue: 'Add ?queueType=outstanding_requests to test different queue',
        explanation: 'This debugs the exact logic used in finding next valid users'
      }
    });

  } catch (error: any) {
    console.error('❌ Debug test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString(),
      message: 'Debug test failed'
    }, { status: 500 });
  }
} 