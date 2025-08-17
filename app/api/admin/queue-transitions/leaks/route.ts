// =============================================================================
// Potential Conversion Leaks API
// =============================================================================
// Endpoint to fetch potential conversion leaks for monitoring dashboard

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET: Get potential conversion leaks
 */
export async function GET(request: NextRequest) {
  try {
    // Safe URL parsing with fallback
    let limit = 100;
    let hours = 24;
    
    try {
      const url = new URL(request.url || 'http://localhost:3000');
      limit = parseInt(url.searchParams.get('limit') || '100');
      hours = parseInt(url.searchParams.get('hours') || '24');
    } catch (urlError) {
      console.warn('Failed to parse URL parameters, using defaults:', urlError);
    }
    
    console.log(`🚨 Fetching potential conversion leaks (${hours}h, limit: ${limit})...`);
    
    // Try to fetch from the potential_conversion_leaks view
    try {
      const leaks = await prisma.$queryRaw`
        SELECT 
          user_id,
          from_queue,
          to_queue,
          timestamp,
          source,
          leak_type
        FROM potential_conversion_leaks
        WHERE timestamp > NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;
      
      return NextResponse.json({
        success: true,
        leaks: leaks || [],
        count: Array.isArray(leaks) ? leaks.length : 0,
        period: `${hours} hours`
      });
      
    } catch (viewError) {
      // View might not exist yet, try direct query
      console.warn('Potential leaks view not available, using direct query:', viewError);
      
      const leaks = await prisma.$queryRaw`
        SELECT 
          qta.user_id::text,
          qta.from_queue,
          qta.to_queue,
          qta.timestamp,
          qta.source,
          CASE 
            WHEN qta.from_queue = 'unsigned_users' 
                 AND qta.to_queue IN ('outstanding_requests', NULL)
            THEN 'SIGNATURE_CONVERSION_MISSED'
            WHEN qta.from_queue = 'outstanding_requests' 
                 AND qta.to_queue IS NULL
            THEN 'REQUIREMENTS_CONVERSION_MISSED'
            ELSE 'UNKNOWN'
          END as leak_type
        FROM queue_transition_audit qta
        LEFT JOIN conversions c ON c."userId" = qta.user_id::bigint
          AND c."convertedAt" BETWEEN qta.timestamp - INTERVAL '5 minutes' 
                                  AND qta.timestamp + INTERVAL '5 minutes'
        WHERE qta.timestamp > NOW() - INTERVAL '${hours} hours'
          AND qta.conversion_logged = false
          AND (
            (qta.from_queue = 'unsigned_users' AND qta.to_queue IN ('outstanding_requests', NULL))
            OR (qta.from_queue = 'outstanding_requests' AND qta.to_queue IS NULL)
          )
          AND c.id IS NULL
        ORDER BY qta.timestamp DESC
        LIMIT ${limit}
      `;
      
      return NextResponse.json({
        success: true,
        leaks: leaks || [],
        count: Array.isArray(leaks) ? leaks.length : 0,
        period: `${hours} hours`,
        note: 'Queried directly (view not available)'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Failed to fetch potential leaks:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch potential leaks',
      details: error instanceof Error ? error.message : String(error),
      leaks: [],
      count: 0
    }, { status: 500 });
  }
}
