import { NextRequest, NextResponse } from 'next/server';
import { QueueLevelMonitorService } from '../../../../modules/queue/services/queue-level-monitor.service';

/**
 * Queue Level Check & Auto-Regeneration API
 * 
 * Monitors queue levels and triggers regeneration when queues drop below thresholds.
 * Called periodically (every 5-10 minutes) by monitoring system.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🔍 [QUEUE-LEVEL-CHECK] Starting queue level monitoring...');
    
    const monitorService = new QueueLevelMonitorService();
    const report = await monitorService.checkAndRegenerateQueues();
    
    const duration = Date.now() - startTime;
    
    if (report.regenerationTriggered) {
      console.log(`🚨 [QUEUE-LEVEL-CHECK] Auto-regeneration triggered: ${report.reason} (${duration}ms)`);
    } else {
      console.log(`✅ [QUEUE-LEVEL-CHECK] Queue levels adequate (${duration}ms)`);
    }
    
    return NextResponse.json({
      success: true,
      report,
      duration,
      timestamp: new Date().toISOString(),
      
      // Summary for monitoring dashboards
      summary: {
        regenerationTriggered: report.regenerationTriggered,
        reason: report.reason,
        queueLevels: {
          unsigned: report.unsigned_users.currentLevel,
          outstanding: report.outstanding_requests.currentLevel
        },
        thresholds: {
          unsigned: report.unsigned_users.threshold,
          outstanding: report.outstanding_requests.threshold
        }
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [QUEUE-LEVEL-CHECK] Queue level monitoring failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Configuration endpoint for queue level monitoring
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const monitorService = new QueueLevelMonitorService();
    
    if (body.action === 'updateConfig') {
      monitorService.updateConfiguration(body.config);
      
      return NextResponse.json({
        success: true,
        message: 'Configuration updated successfully',
        config: monitorService.getConfiguration(),
        timestamp: new Date().toISOString()
      });
    }
    
    if (body.action === 'healthCheck') {
      const health = await monitorService.healthCheck();
      
      return NextResponse.json({
        success: true,
        health,
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use "updateConfig" or "healthCheck"'
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('❌ [QUEUE-LEVEL-CHECK] Configuration request failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 