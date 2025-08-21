import { NextRequest, NextResponse } from 'next/server';
import { ScheduledSmsService } from '@/modules/sms-followups';

export const maxDuration = 300; // 5 minutes for cron jobs

/**
 * SMS Follow-ups Processing Cron Job
 * 
 * Processes scheduled SMS follow-ups with pre-send eligibility checks.
 * Runs every 5 minutes to process due messages.
 * 
 * DESIGN:
 * - Atomic message claiming to prevent duplicate processing
 * - Per-type eligibility checks before sending (active conversation, signature status, etc.)
 * - Automatic cancellation when context changes (signed, active chat, callback updates)
 * - Respects quiet hours, throttles, and consent-first patterns
 * - Database-only state management (no Redis)
 * 
 * Schedule: every 5 minutes
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('📨 [CRON] SMS Follow-ups processing starting...');
    
    // ✅ CRITICAL: Verify Vercel cron authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('🚫 [CRON] Unauthorized cron access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Skip during build/preview
    if (process.env.VERCEL_ENV === 'preview' || process.env.CI === 'true') {
      return NextResponse.json({ success: true, message: 'Skipped during build' });
    }
    
    // Check if SMS Follow-ups are enabled (defaults to enabled)
    if (process.env.ENABLE_SMS_FOLLOWUPS === 'false') {
      return NextResponse.json({ 
        success: false, 
        message: 'SMS Follow-ups feature is disabled' 
      });
    }
    
    // Initialize service
    const scheduledSmsService = new ScheduledSmsService();
    
    // Process due messages with pre-send checks
    const result = await scheduledSmsService.processDue({
      limit: 20 // Process max 20 messages per run (Vercel timeout safety)
    });
    
    const duration = Date.now() - startTime;
    
    console.log('✅ [CRON] SMS Follow-ups processing completed:', {
      processed: result.processed,
      sent: result.sent,
      canceled: result.canceled,
      failed: result.failed,
      errors: result.errors.length,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    // Log any errors for investigation
    if (result.errors.length > 0) {
      console.error('❌ [CRON] SMS Follow-ups errors:', result.errors);
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} follow-ups: ${result.sent} sent, ${result.canceled} canceled, ${result.failed} failed`,
      result,
      duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ [CRON] SMS Follow-ups processing failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Health check endpoint for monitoring
 */
export async function POST(request: NextRequest) {
  try {
    const scheduledSmsService = new ScheduledSmsService();
    
    // Get pending count for health check
    const pendingCount = await scheduledSmsService.getPendingCount();
    
    return NextResponse.json({
      success: true,
      health: 'ok',
      pendingMessages: pendingCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [CRON] SMS Follow-ups health check failed:', error);
    
    return NextResponse.json({
      success: false,
      health: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
