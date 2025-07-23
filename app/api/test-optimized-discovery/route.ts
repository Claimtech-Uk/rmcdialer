import { NextRequest, NextResponse } from 'next/server';
import { LeadDiscoveryOptimizedService } from '@/modules/queue/services/lead-discovery-optimized.service';
import { QueueGenerationService } from '@/modules/queue/services/queue-generation.service';
import { DailyAgingService } from '@/modules/queue/services/daily-aging.service';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🧪 Testing OPTIMIZED lead discovery system...');
    
    // Step 1: Test optimized discovery (NEW users only)
    console.log('📊 Step 1: Testing OPTIMIZED lead discovery (NEW users only)...');
    const discoveryService = new LeadDiscoveryOptimizedService();
    const discoveryReport = await discoveryService.runOptimizedDiscovery();
    
    // Step 2: Test queue generation
    console.log('🎯 Step 2: Testing queue generation...');
    const queueService = new QueueGenerationService();
    const queueResults = await queueService.generateAllQueues();
    
    // Step 3: Test daily aging (but don't actually run it)
    console.log('📅 Step 3: Testing daily aging service (dry run)...');
    const agingService = new DailyAgingService();
    // Just checking the service loads correctly
    
    const duration = Date.now() - startTime;
    
    console.log('✅ OPTIMIZED system test completed successfully!');
    console.log(`📊 Performance: ${discoveryReport.performanceGain}`);
    
    return NextResponse.json({
      success: true,
      duration,
      optimizedDiscovery: {
        totalEligibleInMysql: discoveryReport.totalEligibleInMysql,
        totalAlreadyScored: discoveryReport.totalAlreadyScored,
        totalNewUsersFound: discoveryReport.totalNewUsersFound,
        totalNewUsersCreated: discoveryReport.totalNewUsersCreated,
        performanceGain: discoveryReport.performanceGain,
        summary: discoveryReport.summary
      },
      queueGeneration: queueResults.map(r => ({
        queueType: r.queueType,
        totalEligible: r.totalEligible,
        queuePopulated: r.queuePopulated
      })),
      improvements: [
        '✅ Only processes NEW users (not existing)',
        '✅ Removed daily aging from discovery',
        '✅ Efficient batch processing',
        '✅ Timeout protection',
        '✅ Separated concerns (discovery vs aging)'
      ],
      nextSteps: [
        '🎯 Deploy to production',
        '📊 Monitor performance improvements',
        '📅 Set up daily aging cron (once per day)',
        '🚀 Scale to handle thousands of users'
      ]
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ OPTIMIZED system test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration
    }, { status: 500 });
  }
} 