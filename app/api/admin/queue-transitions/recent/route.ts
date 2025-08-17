// =============================================================================
// Recent Queue Transitions API
// =============================================================================
// Endpoint to fetch recent queue transitions for monitoring dashboard

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET: Get recent queue transitions
 */
export async function GET(request: NextRequest) {
  try {
    // Safe URL parsing with fallback
    let limit = 50;
    let hours = 24;
    
    try {
      const url = new URL(request.url || 'http://localhost:3000');
      limit = parseInt(url.searchParams.get('limit') || '50');
      hours = parseInt(url.searchParams.get('hours') || '24');
    } catch (urlError) {
      console.warn('Failed to parse URL parameters, using defaults:', urlError);
    }
    
    console.log(`📊 Fetching recent queue transitions (${hours}h, limit: ${limit})...`);
    
    // Try to fetch from the recent_queue_transitions view
    try {
      const transitions = await prisma.$queryRaw`
        SELECT 
          user_id,
          from_queue,
          to_queue,
          reason,
          source,
          conversion_logged,
          timestamp
        FROM recent_queue_transitions
        WHERE timestamp > NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;
      
      return NextResponse.json({
        success: true,
        transitions: transitions || [],
        count: Array.isArray(transitions) ? transitions.length : 0,
        period: `${hours} hours`
      });
      
    } catch (viewError) {
      // View might not exist yet, try direct table query
      console.warn('View not available, querying table directly:', viewError);
      
      const transitions = await prisma.$queryRaw`
        SELECT 
          user_id::text,
          from_queue,
          to_queue,
          reason,
          source,
          conversion_logged,
          timestamp
        FROM queue_transition_audit
        WHERE timestamp > NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;
      
      return NextResponse.json({
        success: true,
        transitions: transitions || [],
        count: Array.isArray(transitions) ? transitions.length : 0,
        period: `${hours} hours`,
        note: 'Queried from audit table directly (view not available)'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Failed to fetch recent transitions:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch recent transitions',
      details: error instanceof Error ? error.message : String(error),
      transitions: [],
      count: 0
    }, { status: 500 });
  }
}
