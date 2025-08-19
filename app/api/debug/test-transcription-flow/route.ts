import { NextRequest, NextResponse } from 'next/server'
import { transcriptionQueue } from '@/modules/transcription-async/server/services/transcription-queue.service'
import { cacheService } from '@/lib/redis'

export const dynamic = 'force-dynamic'

/**
 * Test the complete transcription flow end-to-end
 */
export async function GET(request: NextRequest) {
  const testCallId = 'test-call-' + Date.now()
  const results = []
  
  try {
    results.push('🧪 Starting transcription flow test...')
    
    // Test 1: Cache service basic operations
    results.push('\n📋 Test 1: Cache Service')
    try {
      await cacheService.set('test-key', { test: true }, 60)
      const testValue = await cacheService.get('test-key')
      await cacheService.del('test-key')
      results.push(`✅ Cache operations work: ${JSON.stringify(testValue)}`)
    } catch (error) {
      results.push(`❌ Cache operations failed: ${error}`)
    }
    
    // Test 2: Add job to queue
    results.push('\n📋 Test 2: Queue Job Addition')
    try {
      const jobId = await transcriptionQueue.addJob(testCallId)
      results.push(`✅ Job added successfully: ${jobId}`)
    } catch (error) {
      results.push(`❌ Failed to add job: ${error}`)
    }
    
    // Test 3: Check queue stats
    results.push('\n📋 Test 3: Queue Stats')
    try {
      const stats = await transcriptionQueue.getQueueStats()
      results.push(`✅ Queue stats: ${JSON.stringify(stats)}`)
    } catch (error) {
      results.push(`❌ Failed to get stats: ${error}`)
    }
    
    // Test 4: Check job status
    results.push('\n📋 Test 4: Job Status Check')
    try {
      const status = await transcriptionQueue.getCallStatus(testCallId)
      results.push(`✅ Job status: ${JSON.stringify(status)}`)
    } catch (error) {
      results.push(`❌ Failed to check status: ${error}`)
    }
    
    // Test 5: Get next job from queue
    results.push('\n📋 Test 5: Queue Processing')
    try {
      const nextJob = await transcriptionQueue.getNextJob()
      results.push(`✅ Next job: ${JSON.stringify(nextJob)}`)
    } catch (error) {
      results.push(`❌ Failed to get next job: ${error}`)
    }
    
    // Test 6: Check environment variables
    results.push('\n📋 Test 6: Environment Check')
    const envCheck = {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasUpstash: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
      hasTwilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    }
    results.push(`✅ Environment: ${JSON.stringify(envCheck)}`)
    
    // Test 7: Check cache service type
    results.push('\n📋 Test 7: Cache Service Type')
    try {
      const cacheStats = await cacheService.getStats()
      results.push(`✅ Cache service: ${JSON.stringify(cacheStats)}`)
    } catch (error) {
      results.push(`❌ Cache stats failed: ${error}`)
    }
    
    results.push('\n🎉 Test completed!')
    
    return NextResponse.json({
      success: true,
      testResults: results.join('\n'),
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    results.push(`\n❌ Test failed: ${error}`)
    
    return NextResponse.json({
      success: false,
      testResults: results.join('\n'),
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Manual transcription trigger for testing
 */
export async function POST(request: NextRequest) {
  try {
    const { callId } = await request.json().catch(() => ({}))
    
    if (!callId) {
      return NextResponse.json({
        success: false,
        error: 'callId is required'
      }, { status: 400 })
    }
    
    // Add to queue
    const jobId = await transcriptionQueue.addJob(callId)
    
    // Manually trigger processing (bypass cron)
    const job = await transcriptionQueue.getNextJob()
    
    return NextResponse.json({
      success: true,
      message: 'Manual transcription test triggered',
      jobId,
      nextJob: job,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
