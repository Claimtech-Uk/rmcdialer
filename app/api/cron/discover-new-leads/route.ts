import { NextRequest, NextResponse } from 'next/server';
import { LeadScoringService } from '@/modules/queue/services/lead-scoring.service';
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
    console.log('🔄 [CRON] Lead Scoring & Queue Generation starting...');
    
    // Log start
    await logCronExecution('lead-scoring-queue-generation', 'running', 0, { 
      message: 'CORRECTED: Lead scoring and queue generation started',
      timestamp: new Date().toISOString(),
      architecture: 'MySQL replica → user_call_scores → call_queue'
    });
    
    // Step 1: Lead Scoring (populate user_call_scores)
    console.log('📊 Step 1: Lead scoring (MySQL replica → user_call_scores)...');
    const leadService = new LeadScoringService();
    const scoringReport = await leadService.runLeadScoring();
    
    // Step 2: Queue Generation (populate call_queue from user_call_scores)
    console.log('🎯 Step 2: Queue generation (user_call_scores → call_queue)...');
    const queueService = new QueueGenerationService();
    const queueResults = await queueService.generateAllQueues();
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [CRON] CORRECTED Lead Scoring & Queue Generation completed in ${duration}ms`);
    console.log(`📊 Lead Scoring: ${scoringReport.totalEligible} leads (${scoringReport.totalNewLeads} new, ${scoringReport.totalExistingLeads} existing)`);
    console.log(`🎯 Queue Generation: ${queueResults.length} queues, ${queueResults.reduce((sum, r) => sum + r.queuePopulated, 0)} users queued`);
    
    // Log success
    await logCronExecution('lead-scoring-queue-generation', 'success', duration, {
      scoringReport,
      queueResults,
      summary: `✅ CORRECTED: ${scoringReport.totalEligible} leads scored, ${queueResults.reduce((sum, r) => sum + r.queuePopulated, 0)} queued`
    });
    
    return NextResponse.json({
      success: true,
      report: {
        ...scoringReport,
        queueGeneration: queueResults
      },
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime(),
      architecture: {
        step1: 'MySQL replica → user_call_scores (lead scoring)',
        step2: 'user_call_scores → call_queue (queue generation)',
        improvement: 'NEW leads start with score = 0, existing leads keep scores'
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON] Lead Scoring & Queue Generation failed:', error);
    
    // Log failure
    await logCronExecution('lead-scoring-queue-generation', 'failed', duration, {
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
