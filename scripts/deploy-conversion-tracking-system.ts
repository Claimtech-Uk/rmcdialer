// =============================================================================
// Deploy Conversion Tracking System
// =============================================================================
// One-click deployment script for the complete conversion tracking system

import { prisma } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentResult {
  success: boolean;
  steps: {
    name: string;
    success: boolean;
    error?: string;
    duration: number;
  }[];
  totalDuration: number;
  timestamp: Date;
}

/**
 * Main deployment function
 */
export async function deployConversionTrackingSystem(): Promise<DeploymentResult> {
  const startTime = Date.now();
  const result: DeploymentResult = {
    success: false,
    steps: [],
    totalDuration: 0,
    timestamp: new Date()
  };
  
  console.log('🚀 Starting Conversion Tracking System deployment...');
  
  try {
    // Step 1: Apply database schema changes
    await executeStep(result, 'Apply Queue Transition Audit Schema', async () => {
      const sqlPath = path.join(process.cwd(), 'scripts', 'add-queue-transition-audit.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      
      // Execute the SQL in chunks (split by semicolon)
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          await prisma.$executeRawUnsafe(statement);
        }
      }
      
      console.log('✅ Database schema updated successfully');
    });
    
    // Step 2: Create monitoring metrics table
    await executeStep(result, 'Create Monitoring Metrics Table', async () => {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS conversion_monitoring_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMP WITH TIME ZONE UNIQUE NOT NULL,
          potential_leaks INTEGER DEFAULT 0,
          recovered_conversions INTEGER DEFAULT 0,
          unrecovered_leaks INTEGER DEFAULT 0,
          execution_time_ms INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_timestamp 
        ON conversion_monitoring_metrics(timestamp DESC)
      `;
      
      console.log('✅ Monitoring metrics table created');
    });
    
    // Step 3: Verify queue_transition_audit table
    await executeStep(result, 'Verify Audit Table', async () => {
      const auditCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM queue_transition_audit
      `;
      console.log(`✅ Audit table verified (${(auditCount as any)[0].count} existing records)`);
    });
    
    // Step 4: Test Universal Queue Transition Service
    await executeStep(result, 'Test Universal Queue Transition Service', async () => {
      // Import and test the service
      const { universalQueueTransitionService } = await import('@/modules/queue/services/universal-queue-transition.service');
      
      // Test with a dummy transition (should not actually modify data)
      const testResult = await universalQueueTransitionService.transitionUserQueue({
        userId: 99999, // Non-existent user
        fromQueue: 'unsigned_users',
        toQueue: 'unsigned_users', // No change = safe test
        reason: 'Deployment test - no actual change',
        source: 'deployment_test',
        skipConversionCheck: true
      });
      
      if (!testResult.success) {
        throw new Error(`Service test failed: ${testResult.error}`);
      }
      
      console.log('✅ Universal Queue Transition Service is functional');
    });
    
    // Step 5: Initialize leak monitoring
    await executeStep(result, 'Initialize Leak Monitoring', async () => {
      const { conversionLeakMonitor } = await import('@/modules/monitoring/services/conversion-leak-monitor.service');
      
      // Test the monitoring service
      const healthMetrics = await conversionLeakMonitor.getHealthMetrics(1);
      
      console.log('✅ Leak monitoring service initialized', healthMetrics);
    });
    
    // Step 6: Validate system health
    await executeStep(result, 'Validate System Health', async () => {
      // Check that all views are accessible
      const views = [
        'recent_queue_transitions',
        'potential_conversion_leaks', 
        'conversion_tracking_health'
      ];
      
      for (const view of views) {
        try {
          await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM ${view} LIMIT 1`);
          console.log(`✅ View ${view} is accessible`);
        } catch (error) {
          throw new Error(`View ${view} is not accessible: ${error}`);
        }
      }
    });
    
    result.success = true;
    result.totalDuration = Date.now() - startTime;
    
    console.log(`🎉 Deployment completed successfully in ${result.totalDuration}ms!`);
    
    // Print summary
    console.log('\n📋 DEPLOYMENT SUMMARY:');
    console.log('✅ Universal Queue Transition Service deployed');
    console.log('✅ Real-time leak monitoring active'); 
    console.log('✅ Database audit system enabled');
    console.log('✅ PostgreSQL triggers installed');
    console.log('✅ Monitoring views created');
    
    console.log('\n🔗 NEXT STEPS:');
    console.log('1. Test with a real call completion to verify conversion tracking');
    console.log('2. Monitor /api/admin/conversion-leak-monitor for health metrics');
    console.log('3. Check potential_conversion_leaks view for any existing leaks');
    console.log('4. Deploy Layer 3 (batch recovery) and Layer 4 (health dashboard)');
    
    return result;
    
  } catch (error) {
    result.success = false;
    result.totalDuration = Date.now() - startTime;
    
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

/**
 * Execute a deployment step with error handling and timing
 */
async function executeStep(
  result: DeploymentResult, 
  stepName: string, 
  stepFunction: () => Promise<void>
): Promise<void> {
  const stepStartTime = Date.now();
  
  try {
    console.log(`\n🔧 ${stepName}...`);
    await stepFunction();
    
    const duration = Date.now() - stepStartTime;
    result.steps.push({
      name: stepName,
      success: true,
      duration
    });
    
    console.log(`✅ ${stepName} completed (${duration}ms)`);
    
  } catch (error) {
    const duration = Date.now() - stepStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    result.steps.push({
      name: stepName,
      success: false,
      error: errorMessage,
      duration
    });
    
    console.error(`❌ ${stepName} failed (${duration}ms):`, errorMessage);
    throw error;
  }
}

/**
 * Run deployment if this script is executed directly
 */
if (require.main === module) {
  deployConversionTrackingSystem()
    .then((result) => {
      console.log('\n🎉 Deployment Result:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Deployment Failed:', error);
      process.exit(1);
    });
}
