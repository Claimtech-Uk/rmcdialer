import { NextRequest, NextResponse } from 'next/server';
import { SmartDiscoveryService } from '@/modules/queue/services/smart-discovery.service';

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
    console.log('🆕 [CRON] Smart New Users Discovery starting...');
    
    // Log start
    await logCronExecution('smart-new-users-discovery', 'running', 0, { 
      message: 'Smart new users discovery started',
      timestamp: new Date().toISOString()
    });
    
    // Run smart discovery for new users
    console.log('🔍 Step 1: Discovering new users from last hour...');
    const discoveryService = new SmartDiscoveryService();
    const discoveryResult = await discoveryService.discoverNewUsers(1); // Last 1 hour
    
    console.log(`✅ Discovery complete: ${discoveryResult.newUsersCreated} new users processed`);
    console.log(`📊 Details: ${discoveryResult.unsigned} unsigned, ${discoveryResult.signed} signed`);
    console.log(`⏭️ Skipped: ${discoveryResult.skippedExisting} existing users`);
    
    const duration = Date.now() - startTime;
    
    // Log success
    await logCronExecution('smart-new-users-discovery', 'success', duration, {
      discoveryResult,
      summary: `Processed ${discoveryResult.newUsersCreated}/${discoveryResult.newUsersFound} new users (${discoveryResult.unsigned} unsigned, ${discoveryResult.signed} signed)`
    });
    
    console.log(`🎉 [CRON] Smart New Users Discovery completed successfully in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      duration,
      discoveryResult,
      summary: `Smart Discovery: ${discoveryResult.newUsersCreated} new users processed from last hour`
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON] Smart New Users Discovery failed:', error);
    
    // Log failure
    await logCronExecution('smart-new-users-discovery', 'failed', duration, {
      error: error.message
    }, error.toString());
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
} 