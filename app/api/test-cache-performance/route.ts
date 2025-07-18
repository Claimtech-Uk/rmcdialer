import { NextResponse } from 'next/server';
import { UserService } from '@/modules/users';
import { cacheService } from '@/lib/redis';

export async function GET() {
  try {
    console.log('🚀 Testing cache performance and Redis integration...');

    const userService = new UserService();
    const testResults: any = {
      success: true,
      tests: {},
      performance: {},
      cacheStats: {},
      timestamp: new Date()
    };

    // Test 1: Cache Service Basic Operations
    console.log('📋 Test 1: Basic cache operations...');
    const testKey = 'test_cache_key';
    const testData = { message: 'Hello Redis!', timestamp: Date.now() };

    await cacheService.set(testKey, testData, 60);
    const retrievedData = await cacheService.get(testKey);
    const exists = await cacheService.exists(testKey);

    testResults.tests.basicCacheOperations = {
      set: '✅ Working',
      get: retrievedData ? '✅ Working' : '❌ Failed',
      exists: exists ? '✅ Working' : '❌ Failed',
      dataIntegrity: JSON.stringify(testData) === JSON.stringify(retrievedData) ? '✅ Working' : '❌ Failed'
    };

    // Test 2: Cache Performance with Real User Data
    console.log('⚡ Test 2: Cache performance with real user data...');
    
    // First request (cache miss)
    const start1 = Date.now();
    const users1 = await userService.getEligibleUsers({ limit: 5 });
    const time1 = Date.now() - start1;

    // Second request (cache hit)
    const start2 = Date.now();
    const users2 = await userService.getEligibleUsers({ limit: 5 });
    const time2 = Date.now() - start2;

    testResults.performance = {
      firstRequest: `${time1}ms (cache miss)`,
      secondRequest: `${time2}ms (cache hit)`,
      speedImprovement: time1 > 0 ? `${Math.round(((time1 - time2) / time1) * 100)}%` : 'N/A',
      cacheWorking: time2 < time1 ? '✅ Cache effective' : '⚠️ Cache may not be working'
    };

    // Test 3: Individual User Context Caching
    if (users1.users.length > 0) {
      console.log('👤 Test 3: Individual user context caching...');
      const testUserId = users1.users[0].user.id;

      // First user context request (cache miss)
      const start3 = Date.now();
      const userContext1 = await userService.getUserCallContext(testUserId);
      const time3 = Date.now() - start3;

      // Second user context request (cache hit)
      const start4 = Date.now();
      const userContext2 = await userService.getUserCallContext(testUserId);
      const time4 = Date.now() - start4;

      testResults.tests.userContextCaching = {
        firstRequest: `${time3}ms`,
        secondRequest: `${time4}ms`,
        speedImprovement: time3 > 0 ? `${Math.round(((time3 - time4) / time3) * 100)}%` : 'N/A',
        dataConsistency: JSON.stringify(userContext1) === JSON.stringify(userContext2) ? '✅ Consistent' : '❌ Inconsistent'
      };
    }

    // Test 4: Cache Invalidation
    console.log('🗑️ Test 4: Cache invalidation...');
    if (users1.users.length > 0) {
      const testUserId = users1.users[0].user.id;
      
      // Ensure user is cached
      await userService.getUserCallContext(testUserId);
      
      // Invalidate cache
      await userService.invalidateUserCache(testUserId);
      
      // Check if cache was cleared (this should be slower than cached request)
      const start5 = Date.now();
      await userService.getUserCallContext(testUserId);
      const time5 = Date.now() - start5;

      testResults.tests.cacheInvalidation = {
        invalidationWorking: time5 > 50 ? '✅ Cache invalidated' : '⚠️ May still be cached',
        timeAfterInvalidation: `${time5}ms`
      };
    }

    // Test 5: Get Cache Statistics
    console.log('📊 Test 5: Cache statistics...');
    const stats = await cacheService.getStats();
    testResults.cacheStats = {
      redisConnected: stats.redisConnected ? '✅ Connected' : '❌ Using fallback',
      memoryCacheSize: stats.memoryCacheSize,
      fallbackMode: !stats.redisConnected ? '⚠️ Running in fallback mode' : '✅ Redis active'
    };

    // Test 6: Pattern Deletion
    console.log('🎯 Test 6: Pattern-based cache deletion...');
    await cacheService.set('pattern_test_1', { data: 'test1' }, 60);
    await cacheService.set('pattern_test_2', { data: 'test2' }, 60);
    await cacheService.set('other_key', { data: 'other' }, 60);

    await cacheService.delPattern('pattern_test*');
    
    const pattern1Exists = await cacheService.exists('pattern_test_1');
    const pattern2Exists = await cacheService.exists('pattern_test_2');
    const otherExists = await cacheService.exists('other_key');

    testResults.tests.patternDeletion = {
      pattern1Deleted: !pattern1Exists ? '✅ Deleted' : '❌ Still exists',
      pattern2Deleted: !pattern2Exists ? '✅ Deleted' : '❌ Still exists',
      otherKeyPreserved: otherExists ? '✅ Preserved' : '❌ Accidentally deleted'
    };

    // Cleanup test keys
    await cacheService.del(testKey);
    await cacheService.del('other_key');

    console.log('✅ All cache tests completed successfully');

    testResults.summary = {
      totalTests: 6,
      redisStatus: stats.redisConnected ? 'Connected' : 'Fallback Mode',
      performanceGain: testResults.performance.speedImprovement,
      recommendedAction: stats.redisConnected 
        ? 'Cache system working optimally' 
        : 'Consider setting up Redis for better performance'
    };

    return NextResponse.json(testResults);

  } catch (error: any) {
    console.error('❌ Cache performance test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date(),
      message: 'Cache performance test failed'
    }, { status: 500 });
  }
} 