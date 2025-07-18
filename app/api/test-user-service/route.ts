import { NextResponse } from 'next/server';
import { UserService } from '@/modules/users';

export async function GET() {
  try {
    const userService = new UserService();
    
    console.log('🧪 Testing UserService with real data...');

    // Test 1: Get eligible users (first 5)
    console.log('📋 Test 1: Getting eligible users...');
    const eligibleUsers = await userService.getEligibleUsers({
      limit: 5,
      offset: 0,
      filters: {}
    });

    console.log(`✅ Found ${eligibleUsers.total} total eligible users`);
    console.log(`📊 Retrieved ${eligibleUsers.users.length} users for testing`);

    // Test 2: Get detailed context for first user
    if (eligibleUsers.users.length > 0) {
      const firstUser = eligibleUsers.users[0];
      console.log(`👤 Test 2: Getting detailed context for user ${firstUser.user.id} (${firstUser.user.firstName} ${firstUser.user.lastName})`);
      
      const userContext = await userService.getUserCallContext(firstUser.user.id);
      
      if (userContext) {
        console.log(`✅ User context retrieved successfully`);
        console.log(`📱 Phone: ${userContext.user.phoneNumber}`);
        console.log(`📧 Email: ${userContext.user.email}`);
        console.log(`🏢 Claims: ${userContext.claims.length}`);
        console.log(`📄 Total Requirements: ${userContext.claims.reduce((acc, c) => acc + c.requirements.length, 0)}`);
        
        // Test 3: Check queue eligibility
        console.log(`🎯 Test 3: Checking queue eligibility...`);
        const isEligible = await userService.checkQueueEligibility(firstUser.user.id);
        console.log(`✅ Queue eligible: ${isEligible}`);
      }
    }

    // Test 4: Test caching (second request should be faster)
    if (eligibleUsers.users.length > 0) {
      const testUserId = eligibleUsers.users[0].user.id;
      console.log(`⚡ Test 4: Testing cache performance for user ${testUserId}...`);
      
      const start = Date.now();
      await userService.getUserCallContext(testUserId);
      const cachedTime = Date.now() - start;
      
      console.log(`⚡ Cached request completed in ${cachedTime}ms`);
    }

    // Prepare response with test results
    const testResults = {
      success: true,
      tests: {
        eligibleUsers: {
          total: eligibleUsers.total,
          retrieved: eligibleUsers.users.length,
          sampleUsers: eligibleUsers.users.map(u => ({
            id: u.user.id,
            name: `${u.user.firstName} ${u.user.lastName}`,
            phone: u.user.phoneNumber,
            claimsCount: u.claims.length,
            requirementsCount: u.claims.reduce((acc, c) => acc + c.requirements.length, 0),
            hasCallScore: !!u.callScore
          }))
        },
        userContext: eligibleUsers.users.length > 0 ? {
          tested: true,
          userId: eligibleUsers.users[0].user.id,
          hasAddress: !!eligibleUsers.users[0].user.address,
          claimsData: eligibleUsers.users[0].claims.map(c => ({
            id: c.id,
            type: c.type,
            status: c.status,
            lender: c.lender,
            requirementsCount: c.requirements.length,
            vehiclePackagesCount: c.vehiclePackages.length
          }))
        } : { tested: false },
        caching: {
          implemented: true,
          inMemoryCache: true,
          redisTodo: true
        }
      },
      timestamp: new Date(),
      message: 'UserService tests completed successfully!'
    };

    return NextResponse.json(testResults);

  } catch (error: any) {
    console.error('❌ UserService test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date(),
      message: 'UserService tests failed'
    }, { status: 500 });
  }
} 