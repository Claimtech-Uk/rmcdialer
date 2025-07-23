import { NextRequest, NextResponse } from 'next/server';
import { LeadScoringService } from '@/modules/queue/services/lead-scoring.service';
import { QueueGenerationService } from '@/modules/queue/services/queue-generation.service';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🧪 Testing corrected pre-call system...');
    
    // Step 1: Lead Scoring (populate user_call_scores)
    const leadService = new LeadScoringService();
    const scoringResult = await leadService.runLeadScoring();
    
    // Step 2: Queue Generation (populate call_queue)
    const queueService = new QueueGenerationService();
    const queueResults = await queueService.generateAllQueues();
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: 'CORRECTED: Pre-call system test completed successfully',
      duration: `${duration}ms`,
      leadScoring: scoringResult,
      queueGeneration: queueResults,
      architecture: {
        step1: 'MySQL replica → user_call_scores (proper scoring)',
        step2: 'user_call_scores → call_queue (top users)',
        improvement: 'NEW leads start with score = 0'
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ Pre-call system test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
} 