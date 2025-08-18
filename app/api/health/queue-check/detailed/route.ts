// =============================================================================
// Queue Health Check Detailed Report API Endpoint
// =============================================================================
// Returns detailed user-level changes for audit and validation purposes

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Parse parameters
  const resultId = searchParams.get('resultId');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    console.log('📋 [DETAILED REPORT API] Getting detailed user changes');

    if (resultId) {
      // Get specific health check result with user details
      const result = await prisma.$queryRaw`
        SELECT 
          id,
          executed_at,
          total_checked,
          total_updated,
          summary_message,
          full_result
        FROM queue_health_check_results 
        WHERE id = ${resultId}
      `;

      if (!result || result.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Health check result not found'
        }, { status: 404 });
      }

      const healthCheckData = result[0];
      const fullResult = healthCheckData.full_result;
      
      // Extract user-level changes from the full result
      const userChanges = [];
      if (fullResult && fullResult.userChanges) {
        userChanges.push(...fullResult.userChanges);
      }

      return NextResponse.json({
        success: true,
        resultId: healthCheckData.id,
        executedAt: healthCheckData.executed_at,
        summary: {
          totalChecked: healthCheckData.total_checked,
          totalUpdated: healthCheckData.total_updated,
          summaryMessage: healthCheckData.summary_message
        },
        userChanges: userChanges.slice(offset, offset + limit),
        pagination: {
          total: userChanges.length,
          offset,
          limit,
          hasMore: (offset + limit) < userChanges.length
        }
      });

    } else {
      // Get recent health check results with basic info
      const recentResults = await prisma.$queryRaw`
        SELECT 
          id,
          executed_at,
          total_checked,
          total_updated,
          summary_message,
          timeout_hit,
          success
        FROM queue_health_check_results 
        WHERE executed_at > NOW() - INTERVAL '7 days'
          AND total_updated > 0
        ORDER BY executed_at DESC 
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return NextResponse.json({
        success: true,
        recentResults: recentResults.map((r: any) => ({
          id: r.id,
          executedAt: r.executed_at,
          totalChecked: r.total_checked,
          totalUpdated: r.total_updated,
          summaryMessage: r.summary_message,
          timeoutHit: r.timeout_hit,
          success: r.success,
          updatePercentage: r.total_checked > 0 ? ((r.total_updated / r.total_checked) * 100).toFixed(1) : '0.0',
          detailsUrl: `/api/health/queue-check/detailed?resultId=${r.id}`
        }))
      });
    }

  } catch (error: any) {
    console.error('❌ [DETAILED REPORT API ERROR]', error);
    
    return NextResponse.json({
      success: false,
      error: `Failed to get detailed report: ${error.message}`
    }, { status: 500 });
  }
}
