import { NextRequest, NextResponse } from 'next/server';
import { LeadScoringSimpleService } from '@/modules/queue/services/lead-scoring-simple.service';
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
    console.log('🔄 [CRON] TIMEOUT-FIXED Lead Scoring & Queue Generation starting...');
    
    // Log start
    await logCronExecution('queue-discovery', 'running', 0, { message: 'Starting timeout-fixed lead scoring' });
    
    // Step 1: Lead Scoring with timeout protection
    console.log('📊 Step 1: TIMEOUT-FIXED lead scoring (MySQL replica → user_call_scores)...');
    const leadService = new LeadScoringSimpleService();
    const scoringResult = await leadService.runLeadScoring();
    
    // Step 2: Queue Generation (only if we have time)
    const timeUsed = Date.now() - startTime;
    if (timeUsed < 25000) { // Leave 5 seconds for queue generation
      console.log('🎯 Step 2: Queue generation (user_call_scores → call_queue)...');
      const queueService = new QueueGenerationService();
      const queueResults = await queueService.generateAllQueues();
      
      const duration = Date.now() - startTime;
      
      // Log success with both steps
      await logCronExecution('queue-discovery', 'success', duration, {
        leadScoring: scoringResult,
        queueGeneration: queueResults,
        timeoutProtection: 'enabled',
        architecture: 'corrected'
      });
      
      return NextResponse.json({
        success: true,
        message: 'TIMEOUT-FIXED: Lead scoring and queue generation completed',
        duration: `${duration}ms`,
        leadScoring: scoringResult,
        queueGeneration: queueResults,
        timeoutProtection: true
      });
      
    } else {
      // Only lead scoring completed due to timeout
      const duration = Date.now() - startTime;
      
      await logCronExecution('queue-discovery', 'success', duration, {
        leadScoring: scoringResult,
        queueGeneration: 'skipped_due_to_timeout',
        timeoutProtection: 'enabled'
      });
      
      return NextResponse.json({
        success: true,
        message: 'TIMEOUT-FIXED: Lead scoring completed, queue generation skipped',
        duration: `${duration}ms`,
        leadScoring: scoringResult,
        queueGeneration: { message: 'Skipped due to timeout protection' },
        timeoutProtection: true
      });
    }

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON] Failed:', error);
    
    await logCronExecution('queue-discovery', 'failed', duration, {}, error.message);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration: `${duration}ms`,
      timeoutProtection: true
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
