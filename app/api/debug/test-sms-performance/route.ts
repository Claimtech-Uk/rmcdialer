import { NextRequest, NextResponse } from 'next/server';
import { SMSService } from '@/modules/communications';

// Test endpoint to compare SMS conversations performance
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 SMS Performance Test Started');

    // Create SMS service instance for testing
    const authForComms = {
      getCurrentAgent: async () => ({ id: 1, role: 'test' })
    };

    const userServiceAdapter = {
      async getUserData(userId: number) {
        // Simplified user data for testing
        return {
          id: userId,
          firstName: 'Test',
          lastName: 'User',
          email: `user${userId}@test.com`,
          phoneNumber: `+4477${userId.toString().padStart(8, '0')}`
        };
      }
    };

    const smsService = new SMSService({ 
      authService: authForComms,
      userService: userServiceAdapter
    });

    const testOptions = {
      page: 1,
      limit: 10 // Small limit for testing
    };

    console.log('🧪 Testing optimized method...');
    const startOptimized = Date.now();
    let optimizedResult;
    let optimizedError = null;
    
    try {
      optimizedResult = await smsService.getConversationsOptimized(testOptions);
    } catch (error) {
      optimizedError = error instanceof Error ? error.message : String(error);
      console.error('🧪 Optimized method failed:', optimizedError);
    }
    const optimizedTime = Date.now() - startOptimized;

    console.log('🧪 Testing legacy method...');
    const startLegacy = Date.now();
    let legacyResult;
    let legacyError = null;
    
    try {
      legacyResult = await smsService.getConversationsLegacy(testOptions);
    } catch (error) {
      legacyError = error instanceof Error ? error.message : String(error);
      console.error('🧪 Legacy method failed:', legacyError);
    }
    const legacyTime = Date.now() - startLegacy;

    // Calculate performance improvement
    const performanceImprovement = legacyTime > 0 ? 
      `${Math.round(((legacyTime - optimizedTime) / legacyTime) * 100)}%` : 
      'N/A';

    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      environmentFlag: process.env.SMS_USE_OPTIMIZED_QUERIES,
      performance: {
        optimized: {
          timeMs: optimizedTime,
          success: !optimizedError,
          error: optimizedError,
          conversationCount: optimizedResult?.data?.length || 0
        },
        legacy: {
          timeMs: legacyTime,
          success: !legacyError,
          error: legacyError,
          conversationCount: legacyResult?.data?.length || 0
        },
        improvement: performanceImprovement,
        speedupFactor: legacyTime > 0 ? `${(legacyTime / optimizedTime).toFixed(1)}x` : 'N/A'
      },
      dataConsistency: {
        bothSucceeded: !optimizedError && !legacyError,
        sameCounts: optimizedResult?.data?.length === legacyResult?.data?.length,
        optimizedCount: optimizedResult?.data?.length || 0,
        legacyCount: legacyResult?.data?.length || 0
      },
      recommendation: optimizedError ? 
        "❌ Optimized method has errors - stick with legacy" :
        legacyError ?
        "✅ Legacy method has errors - use optimized" :
        optimizedTime < legacyTime ?
        "✅ Optimized method is faster - safe to use" :
        "⚠️  Legacy method is faster - investigate optimized method"
    };

    console.log('🧪 SMS Performance Test Results:', results);

    return NextResponse.json(results);

  } catch (error) {
    console.error('🧪 SMS Performance Test Failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Test with specific parameters
  try {
    const body = await request.json();
    const { testType = 'performance', limit = 10, status } = body;

    console.log('🧪 SMS Custom Performance Test:', { testType, limit, status });

    const authForComms = {
      getCurrentAgent: async () => ({ id: 1, role: 'test' })
    };

    const userServiceAdapter = {
      async getUserData(userId: number) {
        return {
          id: userId,
          firstName: 'Test',
          lastName: 'User',
          email: `user${userId}@test.com`,
          phoneNumber: `+4477${userId.toString().padStart(8, '0')}`
        };
      }
    };

    const smsService = new SMSService({ 
      authService: authForComms,
      userService: userServiceAdapter
    });

    const testOptions = {
      page: 1,
      limit: Math.min(limit, 50), // Cap at 50 for safety
      ...(status && { status: status as 'active' | 'closed' })
    };

    console.log('🧪 Running custom test with options:', testOptions);
    const startTime = Date.now();
    
    const result = await smsService.getConversations(testOptions);
    const endTime = Date.now();

    return NextResponse.json({
      success: true,
      testType,
      options: testOptions,
      performance: {
        timeMs: endTime - startTime,
        conversationCount: result.data.length,
        totalCount: result.pagination.total
      },
      sample: result.data.slice(0, 2).map(conv => ({
        id: conv.id,
        phoneNumber: conv.phoneNumber,
        status: conv.status,
        hasUser: !!conv.user,
        hasLatestMessage: !!conv.latestMessage,
        messageCount: conv.messageCount
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🧪 Custom SMS Performance Test Failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
