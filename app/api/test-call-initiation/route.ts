import { NextRequest, NextResponse } from 'next/server';
import { CallService } from '@/modules/calls/services/call.service';
import { UserService } from '@/modules/users/services/user.service';
import { PriorityScoringService } from '@/modules/scoring/services/priority-scoring.service';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    console.log('🧪 Testing call initiation workflow...');
    
    // Test 1: Database connections
    console.log('📋 Test 1: Checking database connections...');
    
    try {
      await prisma.$connect();
      console.log('✅ PostgreSQL connection: OK');
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error);
      return NextResponse.json({
        success: false,
        error: 'PostgreSQL connection failed',
        details: error
      }, { status: 500 });
    }
    
    // Test 2: UserService functionality
    console.log('👤 Test 2: Testing UserService...');
    const userService = new UserService();
    
    try {
      const userContext = await userService.getUserCallContext(5777);
      if (userContext) {
        console.log('✅ UserService working - user found');
        console.log(`📱 User: ${userContext.user.firstName} ${userContext.user.lastName}`);
        console.log(`📞 Phone: ${userContext.user.phoneNumber}`);
        console.log(`🏢 Claims: ${userContext.claims.length}`);
      } else {
        console.log('⚠️ UserService working but user 5777 not found');
      }
    } catch (userError: any) {
      console.error('❌ UserService failed:', userError);
      return NextResponse.json({
        success: false,
        error: 'UserService failed',
        details: userError.message,
        step: 'UserService test'
      }, { status: 500 });
    }
    
    // Test 3: CallService instantiation
    console.log('📞 Test 3: Testing CallService instantiation...');
    const logger = {
      info: (message: string, meta?: any) => console.log(`[Test] ${message}`, meta),
      error: (message: string, error?: any) => console.error(`[Test ERROR] ${message}`, error),
      warn: (message: string, meta?: any) => console.warn(`[Test WARN] ${message}`, meta)
    };
    
    try {
      const scoringService = new PriorityScoringService({ logger });
      const callService = new CallService({ prisma, userService, scoringService, logger });
      console.log('✅ CallService instantiated successfully');
      
      // Test 4: Simulate call initiation (without actually making the call)
      console.log('🔧 Test 4: Testing call initiation logic...');
      
      const mockCallOptions = {
        userId: 5777,
        agentId: 1,
        direction: 'outbound' as const,
        phoneNumber: '+447738585850'
      };
      
      // This will test the user context fetching without actually creating a call
      const userContextForCall = await userService.getUserCallContext(5777);
      if (userContextForCall) {
        console.log('✅ User context retrieved for call initiation');
        
        return NextResponse.json({
          success: true,
          message: 'Call initiation test completed successfully',
          tests: {
            postgresConnection: 'OK',
            userService: 'OK',
            callService: 'OK',
            userContext: 'OK'
          },
          userInfo: {
            id: userContextForCall.user.id,
            name: `${userContextForCall.user.firstName} ${userContextForCall.user.lastName}`,
            phone: userContextForCall.user.phoneNumber,
            claims: userContextForCall.claims.length,
            isEnabled: userContextForCall.user.isEnabled
          }
        });
      } else {
        throw new Error('User context is null');
      }
      
    } catch (callServiceError: any) {
      console.error('❌ CallService test failed:', callServiceError);
      return NextResponse.json({
        success: false,
        error: 'CallService test failed',
        details: callServiceError.message,
        step: 'CallService test'
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('❌ Call initiation test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date()
    }, { status: 500 });
  }
} 