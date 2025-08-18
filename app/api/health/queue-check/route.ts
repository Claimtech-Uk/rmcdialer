// =============================================================================
// Queue Health Check API Endpoint
// =============================================================================
// Main endpoint for running queue health checks with resumable operations
// Following pattern from your existing /api/cron and /api/migration endpoints

import { NextRequest, NextResponse } from 'next/server';
import { QueueHealthCheckService } from '@/modules/health/services/queue-health-check.service';
import type { HealthCheckApiResponse } from '@/modules/health/types/health.types';

export async function GET(request: NextRequest) {
  // ✅ CRITICAL: Verify Vercel cron authentication (following your established pattern)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('🚫 [HEALTH] Unauthorized health check access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Skip during build
  if (process.env.VERCEL_ENV === 'preview' || process.env.CI === 'true') {
    return NextResponse.json({ success: true, message: 'Skipped during build' });
  }

  const searchParams = request.nextUrl.searchParams;
  
  // Parse parameters with defaults (following your established pattern)
  const offset = parseInt(searchParams.get('offset') || '0');
  const batchSize = parseInt(searchParams.get('batchSize') || '200');
  const maxUsersParam = searchParams.get('maxUsers');
  const maxUsers = maxUsersParam ? parseInt(maxUsersParam) : undefined;
  const dryRun = searchParams.get('dryRun') === 'true';

  const healthService = new QueueHealthCheckService();

  try {
    console.log('🏥 [HEALTH API] Starting queue health check');
    console.log(`   Settings: offset=${offset}, batchSize=${batchSize}, maxUsers=${maxUsers || 'all'}, dryRun=${dryRun}`);

    const result = await healthService.runHealthCheck({
      offset,
      batchSize,
      maxUsers,
      dryRun
    });

    // Build response with resumable continuation info (following migration pattern)
    const response: HealthCheckApiResponse = {
      ...result,
      continuation: result.timeoutHit ? {
        nextOffset: offset + result.progress.processed,
        command: `curl "${request.nextUrl.origin}/api/health/queue-check?offset=${offset + result.progress.processed}&batchSize=${batchSize}${maxUsers ? `&maxUsers=${maxUsers}` : ''}${dryRun ? '&dryRun=true' : ''}"`
      } : null
    };

    // Log summary for monitoring
    console.log('✅ [HEALTH API] Queue health check completed:', {
      success: result.success,
      checked: result.stats.checked,
      updated: result.stats.updated,
      timeoutHit: result.timeoutHit,
      duration: result.duration
    });

    return NextResponse.json(response, { 
      status: result.success ? 200 : 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error: any) {
    console.error('❌ [HEALTH API ERROR]', error);
    
    const errorResponse: HealthCheckApiResponse = {
      success: false,
      timestamp: new Date(),
      duration: 0,
      timeoutHit: false,
      batchesProcessed: 0,
      progress: { total: 0, processed: 0, percentage: 0 },
      stats: {
        checked: 0,
        updated: 0,
        correctQueue: 0,
        wrongQueue: 0,
        queueDistribution: { unsigned_users: 0, outstanding_requests: 0, none: 0 },
        issues: {
          notInUserCallScores: 0,
          noQueueTypeAssigned: 0,
          wrongQueueType: 0,
          markedInactive: 0,
          inCooldown: 0,
          shouldBeInQueue: 0,
          alreadyInQueue: 0
        }
      },
      summary: `❌ Health check failed: ${error.message}`,
      continuation: {
        nextOffset: offset,
        command: `curl "${request.nextUrl.origin}/api/health/queue-check?offset=${offset}&batchSize=${batchSize}${maxUsers ? `&maxUsers=${maxUsers}` : ''}${dryRun ? '&dryRun=true' : ''}"`
      }
    };

    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}
