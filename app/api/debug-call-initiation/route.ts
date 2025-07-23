import { NextRequest, NextResponse } from 'next/server';
import { CallService } from '@/modules/calls/services/call.service';
import { UserService } from '@/modules/users/services/user.service';
import { PriorityScoringService } from '@/modules/scoring/services/priority-scoring.service';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    console.log('🔍 Debugging call initiation components...');
    
    // Test 1: Basic service instantiation
    console.log('📋 Test 1: Service instantiation...');
    const logger = {
      info: (message: string, meta?: any) => console.log(`ℹ️ ${message}`, meta || ''),
      error: (message: string, error?: any) => console.error(`❌ ${message}`, error || ''),
      warn: (message: string, meta?: any) => console.warn(`⚠️ ${message}`, meta || '')
    };
    
    const userService = new UserService();
    const scoringService = new PriorityScoringService({ logger });
    const callService = new CallService({ prisma, userService, scoringService, logger });
    console.log('✅ Services created successfully');
    
    // Test 2: Database connections
    console.log('📋 Test 2: Database connections...');
    try {
      // Test PostgreSQL
      await prisma.$connect();
      const sessionCount = await prisma.callSession.count();
      console.log(`✅ PostgreSQL: Connected (${sessionCount} call sessions)`);
    } catch (pgError: any) {
      console.error('❌ PostgreSQL failed:', pgError.message);
      return NextResponse.json({
        success: false,
        step: 'PostgreSQL connection',
        error: pgError.message
      }, { status: 500 });
    }
    
    // Test MySQL via UserService
    try {
      const userContext = await userService.getUserCallContext(5777);
      if (userContext) {
        console.log(`✅ MySQL: Connected (User: ${userContext.user.firstName} ${userContext.user.lastName})`);
      } else {
        console.log('⚠️ MySQL: Connected but user 5777 not found');
      }
    } catch (mysqlError: any) {
      console.error('❌ MySQL failed:', mysqlError.message);
      return NextResponse.json({
        success: false,
        step: 'MySQL/UserService connection',
        error: mysqlError.message
      }, { status: 500 });
    }
    
    // Test 3: Mock call initiation (without actually creating)
    console.log('📋 Test 3: Mock call initiation...');
    try {
      const mockCallOptions = {
        userId: 5777,
        agentId: 1,
        direction: 'outbound' as const,
        phoneNumber: '+447738585850'
      };
      
      // Test the getUserCallContext method specifically
      const userContext = await userService.getUserCallContext(5777);
      if (userContext) {
        console.log('✅ User context retrieved for call');
        
        // Don't actually create the call, just validate we can reach this point
        console.log('✅ Mock call initiation would succeed');
        
        return NextResponse.json({
          success: true,
          message: 'All call initiation components working',
          tests: {
            serviceInstantiation: 'OK',
            postgresConnection: 'OK',
            mysqlConnection: 'OK',
            userContextRetrieval: 'OK',
            mockCallInitiation: 'OK'
          },
          userInfo: {
            id: userContext.user.id,
            name: `${userContext.user.firstName} ${userContext.user.lastName}`,
            phone: userContext.user.phoneNumber,
            claims: userContext.claims.length,
            isEnabled: userContext.user.isEnabled
          }
        });
      } else {
        throw new Error('User context is null for user 5777');
      }
      
    } catch (callError: any) {
      console.error('❌ Mock call initiation failed:', callError.message);
      return NextResponse.json({
        success: false,
        step: 'Mock call initiation',
        error: callError.message,
        stack: callError.stack
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('❌ Debug test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date()
    }, { status: 500 });
  }
} 