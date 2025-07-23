import { NextResponse } from 'next/server';
import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import type { QueueType } from '@/modules/queue/types/queue.types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');
    
    console.log('🧪 Starting simple pre-call validation test with real replica data...');
    
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test 1: Basic MySQL connection
    console.log('🔌 Testing MySQL replica connection...');
    try {
      const userCount = await replicaDb.user.count({
        where: { is_enabled: true }
      });
      results.tests.push({
        name: 'MySQL Connection',
        status: 'success',
        data: { enabledUsers: userCount }
      });
    } catch (error: any) {
      results.tests.push({
        name: 'MySQL Connection',
        status: 'error',
        data: { error: error.message }
      });
    }

    // Test 2: Get sample unsigned users directly from replica
    console.log('📋 Testing unsigned users query...');
    try {
      const unsignedUsers = await replicaDb.user.findMany({
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
        take: 3
      });

      results.tests.push({
        name: 'Unsigned Users Query',
        status: 'success',
        data: {
          totalUsers: unsignedUsers.length,
          sampleUsers: unsignedUsers.map(user => ({
            userId: Number(user.id),
            firstName: user.first_name,
            lastName: user.last_name,
            hasSignature: !!user.current_signature_file_id,
            pendingRequirements: user.claims.reduce((acc, claim) => 
              acc + claim.requirements.length, 0
            ),
            isEnabled: user.is_enabled
          }))
        }
      });
    } catch (error: any) {
      results.tests.push({
        name: 'Unsigned Users Query',
        status: 'error',
        data: { error: error.message }
      });
    }

    // Test 3: Core validation logic for specific user (if provided)
    if (userIdParam) {
      const userId = parseInt(userIdParam);
      console.log(`🔍 Testing validation logic for user ${userId}...`);
      
      try {
        // Get current user state from MySQL replica (simplified query)
        const userData = await replicaDb.user.findUnique({
          where: { id: BigInt(userId) },
          include: {
            claims: {
              include: {
                requirements: {
                  where: { status: 'PENDING' }
                }
              }
            }
          }
        });

        if (!userData) {
          results.tests.push({
            name: `User ${userId} Validation`,
            status: 'not_found',
            data: { message: 'User not found in replica database' }
          });
        } else {
          // Check for scheduled callback from PostgreSQL (with error handling)
          let scheduledCallback = null;
          try {
            scheduledCallback = await prisma.callback.findFirst({
              where: {
                userId: BigInt(userId),
                status: 'pending',
                scheduledFor: { lte: new Date() }
              }
            });
          } catch (error: any) {
            console.log(`⚠️ Could not check callbacks for user ${userId}: ${error.message}`);
            // Continue without callback check - PostgreSQL might not be running
          }

          // Determine current eligibility
          const hasSignature = userData.current_signature_file_id !== null;
          const pendingRequirements = userData.claims.reduce((acc, claim) => 
            acc + claim.requirements.length, 0
          );

          const userStatus = {
            hasSignature,
            pendingRequirements,
            hasScheduledCallback: !!scheduledCallback,
            isEnabled: userData.is_enabled,
            userExists: true
          };

          // Determine current queue type
          let currentQueueType: QueueType | null = null;
          
          if (scheduledCallback) {
            // User has callback - they go in their appropriate queue with callback priority
            if (!hasSignature) {
              currentQueueType = 'unsigned_users';
            } else if (pendingRequirements > 0) {
              currentQueueType = 'outstanding_requests';
            } else {
              currentQueueType = 'outstanding_requests'; // Default for callbacks
            }
          } else if (!hasSignature) {
            currentQueueType = 'unsigned_users';
          } else if (pendingRequirements > 0) {
            currentQueueType = 'outstanding_requests';
          } else {
            currentQueueType = null; // User doesn't need to be in any queue
          }

          results.tests.push({
            name: `User ${userId} Validation`,
            status: 'success',
            data: {
              userId: Number(userData.id),
              firstName: userData.first_name,
              lastName: userData.last_name,
              currentQueueType,
              userStatus,
              validationLogic: {
                hasSignature: hasSignature ? 'YES' : 'NO',
                pendingRequirements: pendingRequirements,
                hasCallback: scheduledCallback ? 'YES' : 'NO',
                isEnabled: userData.is_enabled ? 'YES' : 'NO',
                queueEligibility: currentQueueType || 'NONE'
              }
            }
          });
        }
      } catch (error: any) {
        results.tests.push({
          name: `User ${userId} Validation`,
          status: 'error',
          data: { error: error.message }
        });
      }
    }

    // Test 4: Outstanding requests users
    console.log('📋 Testing outstanding requests query...');
    try {
      const outstandingUsers = await replicaDb.user.findMany({
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
        take: 3
      });

      results.tests.push({
        name: 'Outstanding Requests Query',
        status: 'success',
        data: {
          totalUsers: outstandingUsers.length,
          sampleUsers: outstandingUsers.map(user => ({
            userId: Number(user.id),
            firstName: user.first_name,
            lastName: user.last_name,
            hasSignature: !!user.current_signature_file_id,
            pendingRequirements: user.claims.reduce((acc, claim) => 
              acc + claim.requirements.length, 0
            ),
            isEnabled: user.is_enabled
          }))
        }
      });
    } catch (error: any) {
      results.tests.push({
        name: 'Outstanding Requests Query',
        status: 'error',
        data: { error: error.message }
      });
    }

    console.log('✅ Simple validation test completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Simple pre-call validation test completed',
      results,
      usage: {
        testSpecificUser: 'Add ?userId=12345 to test specific user validation logic',
        explanation: 'This tests the core validation logic directly against MySQL replica data'
      }
    });

  } catch (error: any) {
    console.error('❌ Simple validation test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString(),
      message: 'Simple validation test failed'
    }, { status: 500 });
  }
} 