import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  console.log('🧪 Testing call session creation...')
  
  const results = {
    step1_env_check: { success: false, details: null as any },
    step2_prisma_connection: { success: false, details: null as any },
    step3_test_query: { success: false, details: null as any },
    step4_call_creation: { success: false, details: null as any }
  }
  
  // Step 1: Check environment variables
  try {
    const hasDbUrl = !!process.env.DATABASE_URL
    const dbUrlLength = process.env.DATABASE_URL?.length || 0
    results.step1_env_check = {
      success: hasDbUrl,
      details: {
        hasDbUrl,
        dbUrlLength,
        dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...'
      }
    }
    console.log('✅ Step 1: Environment check passed')
  } catch (error: any) {
    results.step1_env_check = {
      success: false,
      details: { error: error.message }
    }
    console.error('❌ Step 1 failed:', error)
  }
  
  // Step 2: Test Prisma connection
  try {
    console.log('🔗 Testing Prisma connection...')
    await prisma.$connect()
    results.step2_prisma_connection = {
      success: true,
      details: { message: 'Prisma connected successfully' }
    }
    console.log('✅ Step 2: Prisma connection successful')
  } catch (error: any) {
    results.step2_prisma_connection = {
      success: false,
      details: { 
        error: error.message,
        code: error.code,
        meta: error.meta
      }
    }
    console.error('❌ Step 2 failed:', error)
    
    // Early return if can't connect
    return NextResponse.json({
      success: false,
      message: 'Prisma connection failed',
      results,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
  
  // Step 3: Test basic query
  try {
    console.log('📊 Testing basic query...')
    const count = await prisma.callSession.count()
    results.step3_test_query = {
      success: true,
      details: { 
        callSessionCount: count,
        message: 'Query executed successfully'
      }
    }
    console.log(`✅ Step 3: Query successful - ${count} call sessions found`)
  } catch (error: any) {
    results.step3_test_query = {
      success: false,
      details: { 
        error: error.message,
        code: error.code
      }
    }
    console.error('❌ Step 3 failed:', error)
  }
  
  // Step 4: Test call session creation
  try {
    console.log('🎯 Testing call session creation...')
    
    const testCallSession = await prisma.callSession.create({
      data: {
        userId: BigInt(5777),
        agentId: 1,
        callQueueId: crypto.randomUUID(), // Generate proper UUID
        status: 'initiated',
        direction: 'outbound',
        startedAt: new Date(),
        callAttemptNumber: 1,
        callSource: 'test'
      }
    })
    
    results.step4_call_creation = {
      success: true,
      details: {
        sessionId: testCallSession.id,
        userId: Number(testCallSession.userId),
        status: testCallSession.status,
        createdAt: testCallSession.startedAt
      }
    }
    
    console.log(`✅ Step 4: Call session created successfully - ID: ${testCallSession.id}`)
    
    // Clean up test data
    await prisma.callSession.delete({
      where: { id: testCallSession.id }
    })
    
    console.log('🧹 Test data cleaned up')
    
  } catch (error: any) {
    results.step4_call_creation = {
      success: false,
      details: { 
        error: error.message,
        code: error.code,
        meta: error.meta
      }
    }
    console.error('❌ Step 4 failed:', error)
  }
  
  const allSuccess = Object.values(results).every(result => result.success)
  
  return NextResponse.json({
    success: allSuccess,
    message: allSuccess ? 'All tests passed! Call creation should work.' : 'Some tests failed - see details',
    results,
    timestamp: new Date().toISOString()
  }, { 
    status: allSuccess ? 200 : 500 
  })
} 