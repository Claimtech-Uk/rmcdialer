import { NextRequest, NextResponse } from 'next/server';
import { LeadDiscoveryOptimizedService } from '@/modules/queue/services/lead-discovery-optimized.service';
import { QueueGenerationService } from '@/modules/queue/services/queue-generation.service';

async function logCronExecution(jobName: string, status: 'running' | 'success' | 'failed', duration: number, details: any, error?: string) {
  try {
    await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cron/logs`, {
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
    console.log('🚀 [CRON] OPTIMIZED Lead Discovery starting (NEW users only)...');
    
    // Log start
    await logCronExecution('optimized-lead-discovery', 'running', 0, { 
      message: 'OPTIMIZED Lead Discovery started (NEW users only)',
      timestamp: new Date().toISOString()
    });
    
    // Step 1: OPTIMIZED Lead Discovery (only NEW users)
    console.log('📊 Step 1: OPTIMIZED lead discovery (MySQL replica → user_call_scores for NEW users only)...');
    const discoveryService = new LeadDiscoveryOptimizedService();
    const discoveryReport = await discoveryService.runOptimizedDiscovery();
    
    console.log(`✅ Discovery complete: ${discoveryReport.totalNewUsersCreated} NEW users processed, ${discoveryReport.totalAlreadyScored} existing users skipped`);
    
    // Step 2: Queue Generation (user_call_scores → call_queue)
    console.log('🎯 Step 2: Queue generation (user_call_scores → call_queue)...');
    const queueService = new QueueGenerationService();
    const queueResults = await queueService.generateAllQueues();
    
    const duration = Date.now() - startTime;
    
    // Log success
    await logCronExecution('optimized-lead-discovery', 'success', duration, {
      discoveryResults: {
        totalEligibleInMysql: discoveryReport.totalEligibleInMysql,
        totalAlreadyScored: discoveryReport.totalAlreadyScored,
        totalNewUsersFound: discoveryReport.totalNewUsersFound,
        totalNewUsersCreated: discoveryReport.totalNewUsersCreated,
        performanceGain: discoveryReport.performanceGain
      },
      queueResults: queueResults.map(r => ({
        queueType: r.queueType,
        totalEligible: r.totalEligible,
        queuePopulated: r.queuePopulated
      })),
      summary: discoveryReport.summary,
      duration: `${duration}ms`
    });
    
    console.log(`🎉 [CRON] OPTIMIZED Lead Discovery completed successfully in ${duration}ms`);
    console.log(`📊 Performance gain: ${discoveryReport.performanceGain}`);
    
    return NextResponse.json({
      success: true,
      duration,
      discoveryReport,
      queueResults,
      summary: `OPTIMIZED Discovery: ${discoveryReport.totalNewUsersCreated} NEW users processed efficiently`
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON] OPTIMIZED Lead Discovery failed:', error);
    
    // Log failure
    await logCronExecution('optimized-lead-discovery', 'failed', duration, {
      error: error.message
    }, error.toString());
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
