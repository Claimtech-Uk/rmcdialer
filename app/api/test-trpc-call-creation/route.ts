import { NextRequest, NextResponse } from 'next/server';
import { CallService } from '@/modules/calls/services/call.service';
import { UserService } from '@/modules/users/services/user.service';
import { PriorityScoringService } from '@/modules/scoring/services/priority-scoring.service';
import { prisma } from '@/lib/db';

export async function GET() {
  console.log('🧪 Testing tRPC call creation flow...')
  
  const results = {
    step1_services: { success: false, details: null as any },
    step2_user_context: { success: false, details: null as any },
    step3_call_service: { success: false, details: null as any }
  }
  
  // Step 1: Test service instantiation
  try {
    console.log('🔧 Step 1: Creating services...')
    
    const logger = {
      info: (message: string, meta?: any) => console.log(`[Test] ${message}`, meta || ''),
      error: (message: string, error?: any) => console.error(`[Test ERROR] ${message}`, error || ''),
      warn: (message: string, meta?: any) => console.warn(`[Test WARN] ${message}`, meta || '')
    }
    
    const userService = new UserService();
    const scoringService = new PriorityScoringService({ logger });
    const callService = new CallService({ prisma, userService, scoringService, logger });
    
    results.step1_services = {
      success: true,
      details: { message: 'Services instantiated successfully' }
    }
    
    console.log('✅ Step 1: Services created')
    
    // Step 2: Test user context retrieval
    try {
      console.log('👤 Step 2: Getting user context...')
      
      const userContext = await userService.getUserCallContext(5777)
      
      if (userContext) {
        results.step2_user_context = {
          success: true,
          details: {
            userId: userContext.user.id,
            userName: `${userContext.user.firstName} ${userContext.user.lastName}`,
            phone: userContext.user.phoneNumber,
            claimsCount: userContext.claims.length
          }
        }
        console.log(`✅ Step 2: User context retrieved for ${userContext.user.firstName}`)
        
        // Step 3: Test call service initiation
        try {
          console.log('📞 Step 3: Testing call initiation...')
          
          const callOptions = {
            userId: 5777,
            agentId: 1,
            direction: 'outbound' as const,
            phoneNumber: userContext.user.phoneNumber || undefined
          }
          
          console.log('📋 Call options:', callOptions)
          
          // This should test the full call initiation flow
          const result = await callService.initiateCall(callOptions)
          
          results.step3_call_service = {
            success: true,
            details: {
              sessionId: result.callSession.id,
              status: result.callSession.status,
              userId: result.callSession.userId,
              agentId: result.callSession.agentId,
              phoneNumber: callOptions.phoneNumber
            }
          }
          
          console.log(`✅ Step 3: Call initiated successfully - ID: ${result.callSession.id}`)
          
          // Clean up test data
          try {
            await prisma.callSession.delete({
              where: { id: result.callSession.id }
            })
            console.log('🧹 Test call session cleaned up')
          } catch (cleanupError) {
            console.warn('⚠️ Could not clean up test data:', cleanupError)
          }
          
        } catch (callError: any) {
          results.step3_call_service = {
            success: false,
            details: {
              error: callError.message,
              code: callError.code,
              stack: callError.stack?.split('\n').slice(0, 3).join('\n')
            }
          }
          console.error('❌ Step 3 failed:', callError)
        }
        
      } else {
        results.step2_user_context = {
          success: false,
          details: { error: 'User context is null' }
        }
        console.error('❌ Step 2: User context is null')
      }
      
    } catch (userError: any) {
      results.step2_user_context = {
        success: false,
        details: {
          error: userError.message,
          code: userError.code
        }
      }
      console.error('❌ Step 2 failed:', userError)
    }
    
  } catch (serviceError: any) {
    results.step1_services = {
      success: false,
      details: {
        error: serviceError.message,
        code: serviceError.code
      }
    }
    console.error('❌ Step 1 failed:', serviceError)
  }
  
  const allSuccess = Object.values(results).every(result => result.success)
  
  return NextResponse.json({
    success: allSuccess,
    message: allSuccess ? 'tRPC call creation flow works!' : 'Issues found in call creation flow',
    results,
    timestamp: new Date().toISOString()
  }, { 
    status: allSuccess ? 200 : 500 
  })
} 