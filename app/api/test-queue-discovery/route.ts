import { NextResponse } from 'next/server';
import { QueueDiscoveryService } from '@/modules/queue/services/queue-discovery.service';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const testMode = searchParams.get('test') === 'true';
    const queueType = searchParams.get('queueType');
    
    console.log('🔍 Testing queue discovery service...');
    
    const discoveryService = new QueueDiscoveryService();
    
    if (queueType === 'unsigned_users') {
      // Test just unsigned users discovery
      const result = await discoveryService.discoverUnsignedUsers(10);
      
      return NextResponse.json({
        success: true,
        message: 'Unsigned users discovery test completed',
        result,
        usage: {
          testMode: 'Set ?test=true for test mode',
          limitUsers: 'Limited to 10 users for testing'
        }
      });
      
    } else if (queueType === 'outstanding_requests') {
      // Test just outstanding requests discovery
      const result = await discoveryService.discoverOutstandingRequests(10);
      
      return NextResponse.json({
        success: true,
        message: 'Outstanding requests discovery test completed',
        result,
        usage: {
          testMode: 'Set ?test=true for test mode',
          limitUsers: 'Limited to 10 users for testing'
        }
      });
      
    } else if (queueType === 'cleanup') {
      // Test cleanup functionality
      const result = await discoveryService.cleanupInvalidQueueEntries();
      
      return NextResponse.json({
        success: true,
        message: 'Queue cleanup test completed',
        result,
        usage: {
          testMode: 'Tests queue cleanup functionality',
          explanation: 'Removes users who are no longer eligible'
        }
      });
      
    } else {
      // Test full hourly discovery
      const report = await discoveryService.runHourlyDiscovery();
      
      return NextResponse.json({
        success: true,
        message: 'Hourly discovery test completed',
        report,
        usage: {
          testSpecificQueue: 'Add ?queueType=unsigned_users to test specific queue',
          testCleanup: 'Add ?queueType=cleanup to test cleanup',
          fullDiscovery: 'No parameters for full discovery test'
        }
      });
    }

  } catch (error: any) {
    console.error('❌ Queue discovery test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString(),
      message: 'Queue discovery test failed'
    }, { status: 500 });
  }
} 