import { NextRequest, NextResponse } from 'next/server';
import { LeadScoringService } from '@/modules/queue/services/lead-scoring.service';
import { QueueGenerationService } from '@/modules/queue/services/queue-generation.service';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🧪 Testing corrected lead scoring system...');
    
    // Step 1: Score leads (populate user_call_scores)
    console.log('📊 Step 1: Lead scoring (populating user_call_scores)...');
    const leadService = new LeadScoringService();
    const scoringReport = await leadService.runLeadScoring();
    
    // Step 2: Generate queues from scores (populate call_queue)
    console.log('🎯 Step 2: Queue generation (populating call_queue from user_call_scores)...');
    const queueService = new QueueGenerationService();
    const queueResults = await queueService.generateAllQueues();
    
    // Step 3: Get final status
    const finalStatus = await queueService.getQueueStatus();
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: 'Corrected lead scoring and queue generation test completed successfully',
      duration: `${duration}ms`,
      step1_leadScoring: scoringReport,
      step2_queueGeneration: queueResults,
      finalStatus,
      architecture: {
        step1: 'MySQL replica → user_call_scores (with proper scoring)',
        step2: 'user_call_scores → call_queue (top 100 per queue)',
        result: 'Proper lead lifecycle with score = 0 for new leads'
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ Lead scoring test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

// Also allow POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
} 