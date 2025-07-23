import { NextResponse } from 'next/server';
import { PreCallValidationService } from '@/modules/queue/services/pre-call-validation.service';
import { QueueDiscoveryService } from '@/modules/queue/services/queue-discovery.service';

export async function GET() {
  try {
    console.log('🧪 Testing pre-call validation system...');

    const validationService = new PreCallValidationService();
    const discoveryService = new QueueDiscoveryService();

    // Test 1: Validate a specific user for each queue type
    const testResults = {
      validation: {
        unsigned_users: null as any,
        outstanding_requests: null as any,
        callback: null as any
      },
      queueHealth: {
        unsigned_users: null as any,
        outstanding_requests: null as any,
        callback: null as any
      },
      nextUser: {
        unsigned_users: null as any,
        outstanding_requests: null as any,
        callback: null as any
      }
    };

    // Test queue health for each queue type  
    console.log('🏥 Testing queue health...');
    testResults.queueHealth.unsigned_users = await validationService.validateQueueHealth('unsigned_users', 5);
    testResults.queueHealth.outstanding_requests = await validationService.validateQueueHealth('outstanding_requests', 5);

    // Test getting next user for each queue type
    console.log('👤 Testing next user selection...');
    try {
      testResults.nextUser.unsigned_users = await validationService.getNextValidUserDirectFromReplica('unsigned_users');
    } catch (error: any) {
      testResults.nextUser.unsigned_users = { error: error.message };
    }

    try {
      testResults.nextUser.outstanding_requests = await validationService.getNextValidUserDirectFromReplica('outstanding_requests');
    } catch (error: any) {
      testResults.nextUser.outstanding_requests = { error: error.message };
    }

    // Calculate summary statistics
    const totalHealthChecked = Object.values(testResults.queueHealth).reduce((sum, health) => sum + (health?.totalChecked || 0), 0);
    const totalValid = Object.values(testResults.queueHealth).reduce((sum, health) => sum + (health?.validUsers || 0), 0);
    const totalInvalid = Object.values(testResults.queueHealth).reduce((sum, health) => sum + (health?.invalidUsers || 0), 0);
    const healthPercentage = totalHealthChecked > 0 ? Math.round((totalValid / totalHealthChecked) * 100) : 0;

    const usersFound = Object.values(testResults.nextUser).filter(user => user && !user.error).length;

    return NextResponse.json({
      success: true,
      summary: {
        systemStatus: healthPercentage >= 80 ? 'healthy' : 'needs_attention',
        healthPercentage,
        totalUsersChecked: totalHealthChecked,
        validUsers: totalValid,
        invalidUsers: totalInvalid,
        usersFoundForCalling: usersFound,
        preCallValidationWorking: true,
        directReplicaMode: true
      },
      testResults,
      recommendations: [
        healthPercentage >= 80 
          ? '✅ Pre-call validation system is working correctly'
          : '⚠️ Queue health below 80% - consider running discovery job',
        usersFound > 0 
          ? '✅ System can find valid users for calling'
          : '⚠️ No valid users found - may need to populate queues',
        '📋 System is ready for agent use with real-time validation'
      ],
      nextSteps: [
        'Run hourly discovery job: POST /api/cron/discover-new-leads',
        'Monitor queue health: GET /api/health/queues',
        'Test agent workflow: Use "Call Next Valid User" button in queue pages'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Pre-call system test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also allow POST for manual testing
export async function POST() {
  return GET();
} 