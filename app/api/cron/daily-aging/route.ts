import { NextRequest, NextResponse } from 'next/server';
import { DailyAgingService } from '@/modules/queue/services/daily-aging.service';

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function logCronExecution(jobName: string, status: 'running' | 'success' | 'failed', duration: number, details: any, error?: string) {
  try {
    await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cron/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobName,
        status, 
        duration,
        details,
        error
      })
    });
  } catch (logError) {
    console.error('Failed to log cron execution:', logError);
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('📅 [CRON] Daily Aging starting...');
    
    // Log start
    await logCronExecution('daily-aging', 'running', 0, { 
      message: 'Daily aging process started',
      timestamp: new Date().toISOString()
    });
    
    // Run daily aging
    const agingService = new DailyAgingService();
    const agingReport = await agingService.runDailyAging();
    
    const duration = Date.now() - startTime;
    
    if (agingReport.isSkippedSunday) {
      // Log Sunday skip
      await logCronExecution('daily-aging', 'success', duration, {
        skipped: true,
        reason: 'Sunday is rest day',
        summary: agingReport.summary
      });
      
      console.log('🛑 [CRON] Daily aging skipped - Sunday rest day');
      
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Sunday is rest day',
        duration,
        summary: agingReport.summary
      });
      
    } else {
      // Log successful aging
      await logCronExecution('daily-aging', 'success', duration, {
        usersAged: agingReport.usersAged,
        conversionsDetected: agingReport.conversionsDetected,
        summary: agingReport.summary,
        timestamp: agingReport.timestamp
      });
      
      console.log(`✅ [CRON] Daily aging completed: ${agingReport.usersAged} users aged, ${agingReport.conversionsDetected} conversions`);
      
      return NextResponse.json({
        success: true,
        duration,
        agingReport,
        summary: agingReport.summary
      });
    }
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON] Daily aging failed:', error);
    
    // Log failure
    await logCronExecution('daily-aging', 'failed', duration, {
      error: error.message
    }, error.toString());
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration
    }, { status: 500 });
  }
} 