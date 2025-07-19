import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/modules/users/services/user.service';
import { QueueType } from '@/modules/queue/types/queue.types';

// Initialize the UserService  
const userService = new UserService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queueType = (searchParams.get('queueType') || 'unsigned_users') as QueueType;
    const limit = parseInt(searchParams.get('limit') || '5');

    console.log(`🧪 Testing ${queueType} queue with limit ${limit}`);

    // Get eligible users for the specified queue type
    const result = await userService.getEligibleUsersByQueueType(queueType, { 
      limit, 
      offset: 0 
    });

    console.log(`📊 Found ${result.users.length} users for ${queueType} queue`);

    // Format the response for debugging
    const debugData = {
      queueType,
      totalUsers: result.total,
      usersReturned: result.users.length,
      sampleUsers: result.users.slice(0, 3).map(userContext => ({
        userId: userContext.user.id,
        firstName: userContext.user.firstName,
        lastName: userContext.user.lastName,
        email: userContext.user.email,
        phoneNumber: userContext.user.phoneNumber,
        status: userContext.user.status,
        claimsCount: userContext.claims.length,
        totalRequirements: userContext.claims.reduce((acc, claim) => acc + claim.requirements.length, 0),
        // Show some requirements for debugging
        requirementsSample: userContext.claims.flatMap(claim => 
          claim.requirements.slice(0, 2).map(req => ({
            type: req.type,
            status: req.status,
            reason: req.reason
          }))
        ).slice(0, 3)
      })),
      // Statistics
      stats: {
        usersWithNames: result.users.filter(u => 
          u.user.firstName && u.user.firstName !== 'Unknown'
        ).length,
        usersWithoutNames: result.users.filter(u => 
          !u.user.firstName || u.user.firstName === 'Unknown'
        ).length,
        averageRequirements: result.users.length > 0 
          ? (result.users.reduce((acc, u) => acc + u.claims.reduce((a, c) => a + c.requirements.length, 0), 0) / result.users.length).toFixed(1)
          : 0
      }
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      debug: debugData
    });

  } catch (error) {
    console.error('❌ Test queue data error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 