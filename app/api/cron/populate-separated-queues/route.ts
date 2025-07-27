import { NextRequest, NextResponse } from 'next/server';
import { SeparatedQueuePopulationService } from '../../../../modules/queue/services/separated-queue-population.service';

// Cron execution logging
async function logCronExecution(name: string, status: 'running' | 'success' | 'error', duration: number, metadata?: any) {
  console.log(`📝 [CRON-LOG] ${name}: ${status} (${duration}ms)`, metadata ? JSON.stringify(metadata) : '');
}

function getNextRunTime(): string {
  const next = new Date(Date.now() + 60 * 60 * 1000); // Next hour
  return next.toISOString();
}

/**
 * Hourly Queue Population Cron Job
 * 
 * Generates fresh separated queues from user_call_scores table:
 * - unsigned_users_queue (for users missing signatures)  
 * - outstanding_requests_queue (for users with pending requirements)
 * 
 * Runs every hour to refresh queues with latest scoring and user states.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🚀 [CRON] Separated Queue Population starting...');
    
    // Log start
    await logCronExecution('populate-separated-queues', 'running', 0, { 
      message: 'Hourly queue population started',
      timestamp: new Date().toISOString()
    });
    
    // Initialize queue population service
    const populationService = new SeparatedQueuePopulationService();
    
    // Generate both queues from user_call_scores
    const result = await populationService.populateAllQueues();
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [CRON] Separated Queue Population completed: ${result.summary} (${duration}ms)`);
    
    // Log success with detailed stats
    await logCronExecution('populate-separated-queues', 'success', duration, {
      result,
      queues: {
        unsigned_users: result.results.unsigned_users,
        outstanding_requests: result.results.outstanding_requests
      },
      summary: result.summary
    });
    
    return NextResponse.json({
      success: true,
      result,
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime(),
      
      // Detailed breakdown for monitoring
      queues: {
        unsigned_users: {
          populated: result.results.unsigned_users?.queuePopulated || 0,
          eligible: result.results.unsigned_users?.totalEligible || 0,
          errors: result.results.unsigned_users?.errors || 0,
          duration: result.results.unsigned_users?.duration || 0
        },
        outstanding_requests: {
          populated: result.results.outstanding_requests?.queuePopulated || 0,
          eligible: result.results.outstanding_requests?.totalEligible || 0,
          errors: result.results.outstanding_requests?.errors || 0,
          duration: result.results.outstanding_requests?.duration || 0
        }
      },
      
      // Health indicators
      health: {
        allQueuesGenerated: result.success,
        totalUsersQueued: (result.results.unsigned_users?.queuePopulated || 0) + 
                         (result.results.outstanding_requests?.queuePopulated || 0),
        totalErrors: (result.results.unsigned_users?.errors || 0) + 
                    (result.results.outstanding_requests?.errors || 0)
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON] Separated Queue Population failed:', error);
    
    // Log error
    await logCronExecution('populate-separated-queues', 'error', duration, {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime(),
      
      // Error details for debugging
      health: {
        allQueuesGenerated: false,
        totalUsersQueued: 0,
        totalErrors: 1,
        lastError: error.message
      }
    }, { status: 500 });
  }
}

/**
 * Health check endpoint for queue population system
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [CRON] Running queue population health check...');
    
    const populationService = new SeparatedQueuePopulationService();
    const healthResult = await populationService.healthCheck();
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      healthy: healthResult.healthy,
      issues: healthResult.issues,
      stats: healthResult.stats,
      
      // Additional health indicators
      recommendations: healthResult.issues.length > 0 ? [
        'Check user_call_scores table for data',
        'Verify currentQueueType values are set correctly',
        'Run lead discovery and scoring if no eligible users found'
      ] : [
        'Queue population system operating normally'
      ]
    }, {
      status: healthResult.healthy ? 200 : 206
    });
    
  } catch (error: any) {
    console.error('❌ [CRON] Queue population health check failed:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      healthy: false,
      issues: [`Health check failed: ${error.message}`],
      error: error.message
    }, { status: 500 });
  }
} 