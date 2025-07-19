import { NextRequest, NextResponse } from 'next/server';
import { QueueDiscoveryService } from '@/modules/queue/services/queue-discovery.service';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting hourly lead discovery cron job...');
    
    const discoveryService = new QueueDiscoveryService();
    const report = await discoveryService.runHourlyDiscovery();
    
    console.log(`✅ Hourly discovery completed: ${report.summary}`);
    
    return NextResponse.json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Hourly discovery failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// For manual testing
export async function POST(request: NextRequest) {
  return GET(request);
} 