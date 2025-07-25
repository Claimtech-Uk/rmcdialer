import { NextRequest, NextResponse } from 'next/server'
import { NewUsersDiscoveryService } from '@/modules/discovery'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const startDate = new Date()
  
  console.log(`🚀 [CRON] Smart New Users Discovery STARTED`)
  console.log(`   🕐 Started at: ${startDate.toISOString()}`)
  console.log(`   🎯 Task: Discover users from last 2 hours`)
  
  try {
    const discoveryService = new NewUsersDiscoveryService()
    
    // Discover new users from the last 2 hours (updated for safety buffer)
    const result = await discoveryService.discoverNewUsers()
    
    const duration = Date.now() - startTime
    const endDate = new Date()
    
    console.log(`✅ [CRON] Smart New Users Discovery COMPLETED`)
    console.log(`   🕐 Finished at: ${endDate.toISOString()}`)
    console.log(`   ⏱️  Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`)
    console.log(`   📊 Result: ${result.summary}`)
    
    return NextResponse.json({
      success: result.success,
      duration,
      timestamp: result.timestamp,
      summary: result.summary,
      details: {
        usersChecked: result.usersChecked,
        newUsersFound: result.newUsersFound,
        newUsersCreated: result.newUsersCreated,
        skippedExisting: result.skippedExisting,
        unsigned: result.unsigned,
        signed: result.signed
      },
      errors: result.errors,
      nextRun: getNextRunTime()
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error(`❌ [CRON] Smart New Users Discovery FAILED`)
    console.error(`   🕐 Failed at: ${new Date().toISOString()}`)
    console.error(`   ⏱️  Duration: ${duration}ms`)
    console.error(`   ❗ Error: ${errorMessage}`)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

function getNextRunTime() {
  const now = new Date();
  const currentMinute = now.getMinutes();
  
  // Run every hour at minute 5
  const nextRun = new Date(now);
  if (currentMinute >= 5) {
    nextRun.setHours(nextRun.getHours() + 1);
  }
  nextRun.setMinutes(5);
  nextRun.setSeconds(0);
  
  const minutesUntil = Math.round((nextRun.getTime() - now.getTime()) / (1000 * 60));
  
  return `${minutesUntil} minutes`;
} 