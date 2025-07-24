import { NextRequest, NextResponse } from 'next/server'
import { NewRequirementsDiscoveryService } from '@/modules/discovery/services/new-requirements-discovery.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function logCronExecution(jobName: string, status: 'running' | 'success' | 'failed', duration: number, details: any, error?: string) {
  try {
    // Skip logging in production serverless environment to avoid localhost connection errors
    // The main console.log statements provide sufficient logging in Vercel
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    
    await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cron/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobName,
        status, 
        duration,
        details,
        error
      })
    });
  } catch (logError) {
    console.error('Failed to log cron execution:', logError);
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const startDate = new Date()
  
  console.log(`🚀 [CRON] Requirements Lookup & Discovery STARTED`)
  console.log(`   🕐 Started at: ${startDate.toISOString()}`)
  console.log(`   🎯 Task: Lookup new claim requirements from last 1 hour`)
  
  try {
    // Log start
    await logCronExecution('discover-new-requirements', 'running', 0, { 
      message: 'Requirements lookup and discovery started',
      timestamp: startDate.toISOString()
    });
    
    const discoveryService = new NewRequirementsDiscoveryService()
    
    // Discover new requirements from the last hour
    const result = await discoveryService.discoverNewRequirements({ hoursBack: 1 })
    
    const duration = Date.now() - startTime
    const endDate = new Date()
    
    console.log(`✅ [CRON] Requirements Lookup & Discovery COMPLETED`)
    console.log(`   🕐 Finished at: ${endDate.toISOString()}`)
    console.log(`   ⏱️  Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`)
    console.log(`   📊 Result: ${result.summary}`)
    
    // Log success
    await logCronExecution('discover-new-requirements', 'success', duration, {
      requirementsChecked: result.requirementsChecked,
      newRequirementsFound: result.newRequirementsFound,
      usersUpdated: result.usersUpdated,
      skippedUnsigned: result.skippedUnsigned,
      excludedTypes: result.excludedTypes,
      summary: result.summary
    });
    
    return NextResponse.json({
      success: result.success,
      duration,
      timestamp: result.timestamp,
      summary: result.summary,
      details: {
        requirementsChecked: result.requirementsChecked,
        newRequirementsFound: result.newRequirementsFound,
        usersUpdated: result.usersUpdated,
        skippedUnsigned: result.skippedUnsigned,
        excludedTypes: result.excludedTypes
      },
      errors: result.errors,
      nextRun: getNextRunTime()
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error(`❌ [CRON] Requirements Lookup & Discovery FAILED`)
    console.error(`   🕐 Failed at: ${new Date().toISOString()}`)
    console.error(`   ⏱️  Duration: ${duration}ms`)
    console.error(`   ❗ Error: ${errorMessage}`)
    
    // Log failure
    await logCronExecution('discover-new-requirements', 'failed', duration, {
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined
    }, errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime()
    }, { status: 500 })
  }
}

// For manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}

function getNextRunTime() {
  const now = new Date();
  const currentMinute = now.getMinutes();
  
  // Runs at 35 minutes past each hour
  const targetMinute = 35;
  
  let minutesUntil: number;
  if (currentMinute < targetMinute) {
    minutesUntil = targetMinute - currentMinute;
  } else {
    minutesUntil = (60 - currentMinute) + targetMinute;
  }
  
  return `${minutesUntil} minutes`;
} 