// =============================================================================
// Conversion Leak Monitor API
// =============================================================================
// Admin endpoint for manual leak detection and health monitoring

import { NextRequest, NextResponse } from 'next/server';
import { conversionLeakMonitor } from '@/modules/monitoring/services/conversion-leak-monitor.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET: Get leak monitoring health metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Safe URL parsing with fallback
    let hoursBack = 24;
    
    try {
      const url = new URL(request.url || 'http://localhost:3000');
      hoursBack = parseInt(url.searchParams.get('hours') || '24');
    } catch (urlError) {
      console.warn('Failed to parse URL parameters, using defaults:', urlError);
    }
    
    console.log(`📊 Getting conversion leak health metrics (${hoursBack}h back)...`);
    
    const healthMetrics = await conversionLeakMonitor.getHealthMetrics(hoursBack);
    
    // Get recent leak detection results
    const currentStatus = await conversionLeakMonitor.detectPotentialLeaks();
    
    return NextResponse.json({
      success: true,
      data: {
        health: healthMetrics,
        currentStatus,
        period: `${hoursBack} hours`,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('❌ Failed to get leak monitoring metrics:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get leak monitoring metrics',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * POST: Manually trigger leak detection
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Manual conversion leak detection triggered...');
    
    const result = await conversionLeakMonitor.detectPotentialLeaks();
    
    const status = result.unrecovered > 0 ? 'warning' : 'healthy';
    const message = result.unrecovered > 0 
      ? `Found ${result.unrecovered} unrecoverable leaks out of ${result.potentialLeaks} potential leaks`
      : `All ${result.potentialLeaks} potential leaks were recovered (or verified as not needing conversions)`;
    
    console.log(`✅ Leak detection completed: ${message}`);
    
    return NextResponse.json({
      success: true,
      status,
      message,
      data: {
        potentialLeaks: result.potentialLeaks,
        recovered: result.recovered,
        unrecovered: result.unrecovered,
        executionTimeMs: result.executionTimeMs,
        timestamp: result.timestamp
      },
      recommendations: result.unrecovered > 0 ? [
        'Check recent queue transitions for anomalies',
        'Verify Universal Queue Transition Service is being used',
        'Review database trigger logs for direct updates',
        'Run historical backfill to catch older missed conversions'
      ] : [
        'System is healthy - no immediate action needed',
        'Continue monitoring for trend analysis'
      ]
    });
    
  } catch (error: any) {
    console.error('❌ Manual leak detection failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Manual leak detection failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * PUT: Start/stop continuous monitoring
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body; // 'start' or 'stop'
    
    if (action === 'start') {
      conversionLeakMonitor.startContinuousMonitoring();
      
      return NextResponse.json({
        success: true,
        message: 'Continuous conversion leak monitoring started',
        status: 'monitoring',
        interval: '60 seconds'
      });
    }
    
    // For now, we don't support stopping (would need to track interval ID)
    return NextResponse.json({
      success: false,
      error: 'Stop action not implemented yet',
      note: 'Monitoring runs continuously once started'
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('❌ Failed to control monitoring:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to control monitoring',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
