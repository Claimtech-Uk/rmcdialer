import { NextRequest, NextResponse } from 'next/server';
import { QueueDiscoveryService } from '@/modules/queue/services/queue-discovery.service';

async function logCronExecution(jobName: string, status: 'running' | 'success' | 'failed', duration: number, details: any, error?: string) {
  try {
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
  const startTime = Date.now();
  
  try {
    console.log('🔄 [CRON] Queue Discovery starting...');
    
    // Log start
    await logCronExecution('queue-discovery', 'running', 0, { 
      message: 'Queue discovery started',
      timestamp: new Date().toISOString()
    });
    
    const discoveryService = new QueueDiscoveryService();
    const report = await discoveryService.runHourlyDiscovery();
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [CRON] Queue Discovery completed: ${report.summary} (${duration}ms)`);
    
    // Log success
    await logCronExecution('queue-discovery', 'success', duration, {
      report,
      summary: report.summary,
      usersProcessed: report.usersProcessed || 0,
      queuesUpdated: report.queuesUpdated || 0
    });
    
    return NextResponse.json({
      success: true,
      report,
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime()
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON] Queue Discovery failed:', error);
    
    // Log failure
    await logCronExecution('queue-discovery', 'failed', duration, {
      errorMessage: error.message,
      errorStack: error.stack
    }, error.message);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime()
    }, { status: 500 });
  }
}

// For manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}

function getNextRunTime() {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const targetMinutes = [0, 15, 30, 45];
  
  const nextMinute = targetMinutes.find(min => min > currentMinute) || (targetMinutes[0] + 60);
  const minutesUntil = nextMinute > 60 ? nextMinute - 60 : nextMinute - currentMinute;
  
  return `${minutesUntil} minutes`;
}
