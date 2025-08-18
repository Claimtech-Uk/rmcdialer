// =============================================================================
// Queue Health Check History API Endpoint
// =============================================================================
// Endpoint for querying historical queue health check results
// Following pattern from your existing health and monitoring endpoints

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { HealthCheckHistoryResponse } from '@/modules/health/types/health.types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Parse query parameters
  const days = parseInt(searchParams.get('days') || '7');
  const limit = parseInt(searchParams.get('limit') || '50');
  const includeDetails = searchParams.get('details') === 'true';
  const successOnly = searchParams.get('successOnly') === 'true';

  try {
    console.log('📊 [HEALTH HISTORY API] Querying health check history:', {
      days,
      limit,
      includeDetails,
      successOnly
    });

    // Get recent health check results
    const results = await prisma.$queryRaw`
      SELECT 
        id,
        executed_at,
        duration_ms,
        success,
        timeout_hit,
        batches_processed,
        batch_size,
        start_offset,
        max_users_limit,
        dry_run,
        total_checked,
        total_updated,
        correct_queue_count,
        wrong_queue_count,
        unsigned_users_count,
        outstanding_requests_count,
        no_queue_count,
        not_in_user_call_scores,
        no_queue_type_assigned,
        wrong_queue_type,
        marked_inactive,
        in_cooldown,
        should_be_in_queue,
        already_in_queue,
        summary_message,
        can_resume,
        next_offset,
        ${includeDetails ? 'full_result,' : ''}
        created_at
      FROM queue_health_check_results 
      WHERE executed_at > NOW() - INTERVAL '${days} days'
        ${successOnly ? 'AND success = true' : ''}
      ORDER BY executed_at DESC 
      LIMIT ${limit}
    `;

    // Get summary statistics
    const summaryResults = await prisma.$queryRaw<Array<{
      total_runs: bigint;
      successful_runs: bigint;
      timeout_runs: bigint;
      dry_runs: bigint;
      avg_duration_ms: number;
      total_users_checked: bigint;
      total_users_updated: bigint;
      avg_update_percentage: number;
    }>>`
      SELECT 
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE success = true) as successful_runs,
        COUNT(*) FILTER (WHERE timeout_hit = true) as timeout_runs,
        COUNT(*) FILTER (WHERE dry_run = true) as dry_runs,
        COALESCE(AVG(duration_ms), 0)::INTEGER as avg_duration_ms,
        COALESCE(SUM(total_checked), 0) as total_users_checked,
        COALESCE(SUM(total_updated), 0) as total_users_updated,
        CASE 
          WHEN SUM(total_checked) > 0 
          THEN ROUND((SUM(total_updated) * 100.0 / SUM(total_checked))::numeric, 2)
          ELSE 0 
        END as avg_update_percentage
      FROM queue_health_check_results 
      WHERE executed_at > NOW() - INTERVAL '${days} days'
        ${successOnly ? 'AND success = true' : ''}
    `;

    const summary = summaryResults[0] || {
      total_runs: 0n,
      successful_runs: 0n,
      timeout_runs: 0n,
      dry_runs: 0n,
      avg_duration_ms: 0,
      total_users_checked: 0n,
      total_users_updated: 0n,
      avg_update_percentage: 0
    };

    // Format response
    const response: HealthCheckHistoryResponse = {
      success: true,
      period: `Last ${days} days`,
      summary: {
        total_runs: Number(summary.total_runs),
        successful_runs: Number(summary.successful_runs),
        timeout_runs: Number(summary.timeout_runs),
        avg_duration_ms: summary.avg_duration_ms,
        total_users_checked: Number(summary.total_users_checked),
        total_users_updated: Number(summary.total_users_updated),
        avg_update_percentage: summary.avg_update_percentage
      },
      results: results.map((r: any) => {
        const updatePercentage = r.total_checked > 0 
          ? ((r.total_updated / r.total_checked) * 100).toFixed(1)
          : '0.0';

        return {
          id: r.id,
          executed_at: r.executed_at,
          duration_ms: r.duration_ms,
          success: r.success,
          timeout_hit: r.timeout_hit,
          batches_processed: r.batches_processed,
          batch_size: r.batch_size,
          start_offset: r.start_offset,
          max_users_limit: r.max_users_limit,
          dry_run: r.dry_run,
          total_checked: r.total_checked,
          total_updated: r.total_updated,
          correct_queue_count: r.correct_queue_count,
          wrong_queue_count: r.wrong_queue_count,
          unsigned_users_count: r.unsigned_users_count,
          outstanding_requests_count: r.outstanding_requests_count,
          no_queue_count: r.no_queue_count,
          // Issue breakdown
          not_in_user_call_scores: r.not_in_user_call_scores,
          no_queue_type_assigned: r.no_queue_type_assigned,
          wrong_queue_type: r.wrong_queue_type,
          marked_inactive: r.marked_inactive,
          in_cooldown: r.in_cooldown,
          should_be_in_queue: r.should_be_in_queue,
          already_in_queue: r.already_in_queue,
          summary_message: r.summary_message,
          can_resume: r.can_resume,
          next_offset: r.next_offset,
          update_percentage,
          ...(includeDetails && { full_result: r.full_result })
        };
      })
    };

    console.log('✅ [HEALTH HISTORY API] Query completed:', {
      totalResults: results.length,
      summaryPeriod: response.period
    });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 minute cache for history
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    console.error('❌ [HEALTH HISTORY API ERROR]', error);
    
    return NextResponse.json({
      success: false,
      error: `Failed to query health check history: ${error.message}`,
      period: `Last ${days} days`,
      summary: {
        total_runs: 0,
        successful_runs: 0,
        timeout_runs: 0,
        avg_duration_ms: 0,
        total_users_checked: 0,
        total_users_updated: 0,
        avg_update_percentage: 0
      },
      results: []
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  }
}
