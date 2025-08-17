// =============================================================================
// Conversion Leak Monitor Service
// =============================================================================
// Layer 2: Real-time detection and recovery of missed conversions
// Runs every 60 seconds to catch anything that slips through Layer 1

import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { ConversionLoggingService } from '@/modules/discovery/services/conversion-logging.service';

export interface LeakDetectionResult {
  potentialLeaks: number;
  recovered: number;
  unrecovered: number;
  executionTimeMs: number;
  timestamp: Date;
}

export interface ConversionLeak {
  user_id: string;
  from_queue: string;
  to_queue: string | null;
  timestamp: Date;
  source: string;
  conversion_logged: boolean;
}

/**
 * Conversion Leak Monitor Service
 * 
 * 🎯 MISSION: Catch missed conversions in real-time
 * 
 * HOW IT WORKS:
 * 1. Every 60 seconds, check recent queue transitions
 * 2. Find transitions that should have logged conversions but didn't
 * 3. Attempt immediate recovery by checking user's real status
 * 4. Alert if recovery fails (unrecoverable leaks)
 * 5. Track metrics for health monitoring
 */
export class ConversionLeakMonitorService {
  private static instance: ConversionLeakMonitorService;
  private isRunning = false;
  
  static getInstance(): ConversionLeakMonitorService {
    if (!ConversionLeakMonitorService.instance) {
      ConversionLeakMonitorService.instance = new ConversionLeakMonitorService();
    }
    return ConversionLeakMonitorService.instance;
  }
  
  /**
   * Main detection method - scans for potential leaks in last 2 minutes
   */
  async detectPotentialLeaks(): Promise<LeakDetectionResult> {
    const startTime = Date.now();
    
    if (this.isRunning) {
      console.log('🔍 Leak detection already running, skipping...');
      return {
        potentialLeaks: 0,
        recovered: 0,
        unrecovered: 0,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date()
      };
    }
    
    this.isRunning = true;
    
    try {
      console.log('🔍 Starting conversion leak detection...');
      
      // Find recent queue transitions without conversions
      const suspiciousTransitions = await this.findSuspiciousTransitions();
      
      console.log(`🔍 Found ${suspiciousTransitions.length} suspicious transitions`);
      
      // Attempt to recover missed conversions
      const recoveredConversions = [];
      for (const transition of suspiciousTransitions) {
        try {
          const recovered = await this.attemptConversionRecovery(transition);
          if (recovered) {
            recoveredConversions.push(recovered);
          }
        } catch (error) {
          console.error(`Failed to recover conversion for user ${transition.user_id}:`, error);
        }
      }
      
      console.log(`✅ Recovered ${recoveredConversions.length}/${suspiciousTransitions.length} conversions`);
      
      // Alert if we find unrecoverable leaks
      const unrecovered = suspiciousTransitions.length - recoveredConversions.length;
      if (unrecovered > 0) {
        await this.alertConversionLeak(suspiciousTransitions, recoveredConversions);
      }
      
      const result = {
        potentialLeaks: suspiciousTransitions.length,
        recovered: recoveredConversions.length,
        unrecovered,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date()
      };
      
      // Log metrics
      await this.logMetrics(result);
      
      return result;
      
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Find queue transitions that may have missed conversion tracking
   */
  private async findSuspiciousTransitions(): Promise<ConversionLeak[]> {
    try {
      // Look for transitions in the last 2 minutes without conversions
      const suspiciousTransitions = await prisma.$queryRaw<ConversionLeak[]>`
        SELECT 
          qta.user_id::text,
          qta.from_queue,
          qta.to_queue,
          qta.timestamp,
          qta.source,
          qta.conversion_logged
        FROM queue_transition_audit qta
        LEFT JOIN conversions c ON c."userId" = qta.user_id::bigint
          AND c."convertedAt" BETWEEN qta.timestamp - INTERVAL '5 minutes' 
                                  AND qta.timestamp + INTERVAL '5 minutes'
        WHERE qta.timestamp > NOW() - INTERVAL '2 minutes'
          AND qta.conversion_logged = false
          AND (
            (qta.from_queue = 'unsigned_users' AND qta.to_queue IN ('outstanding_requests', NULL))
            OR (qta.from_queue = 'outstanding_requests' AND qta.to_queue IS NULL)
          )
          AND c.id IS NULL
        ORDER BY qta.timestamp DESC
      `;
      
      return suspiciousTransitions;
      
    } catch (error) {
      console.error('❌ Failed to find suspicious transitions:', error);
      return [];
    }
  }
  
  /**
   * Attempt to recover a missed conversion
   */
  private async attemptConversionRecovery(transition: ConversionLeak): Promise<any | null> {
    try {
      console.log(`🔧 Attempting recovery for user ${transition.user_id} (${transition.from_queue} → ${transition.to_queue})`);
      
      // Get user's current status from replica
      const userData = await replicaDb.user.findUnique({
        where: { id: BigInt(transition.user_id) },
        include: {
          claims: {
            include: {
              requirements: { 
                where: { status: 'PENDING' } 
              }
            }
          }
        }
      });
      
      if (!userData) {
        console.warn(`⚠️ User ${transition.user_id} not found in replica DB`);
        return null;
      }
      
      const hasSignature = userData.current_signature_file_id !== null;
      const pendingRequirements = this.countValidPendingRequirements(userData.claims);
      
      // Check if this should have been a conversion
      const conversionCheck = ConversionLoggingService.shouldLogConversion(
        transition.from_queue as 'unsigned_users' | 'outstanding_requests',
        transition.to_queue,
        { hasSignature, pendingRequirements }
      );
      
      if (conversionCheck.shouldLog) {
        // Create the missed conversion
        const conversion = await ConversionLoggingService.logConversion({
          userId: BigInt(transition.user_id),
          previousQueueType: transition.from_queue,
          conversionType: conversionCheck.conversionType as any,
          conversionReason: `Recovered missing conversion from ${transition.source}`,
          source: 'leak_recovery_monitor' as any,
          convertedAt: transition.timestamp // Use original transition time
        });
        
        // Update audit trail to mark conversion as recovered
        await prisma.$executeRaw`
          UPDATE queue_transition_audit 
          SET conversion_logged = true, 
              conversion_id = ${conversion.id}::uuid,
              metadata = metadata || '{"recovered_by": "leak_monitor"}'::jsonb
          WHERE user_id = ${BigInt(transition.user_id)}
            AND timestamp = ${transition.timestamp}
        `;
        
        console.log(`🎉 Successfully recovered conversion ${conversion.id} for user ${transition.user_id}`);
        return conversion;
      }
      
      // No conversion needed - mark as verified
      await prisma.$executeRaw`
        UPDATE queue_transition_audit 
        SET metadata = metadata || '{"verified_no_conversion": true, "verified_by": "leak_monitor"}'::jsonb
        WHERE user_id = ${BigInt(transition.user_id)}
          AND timestamp = ${transition.timestamp}
      `;
      
      return null;
      
    } catch (error) {
      console.error(`❌ Recovery failed for user ${transition.user_id}:`, error);
      
      // Mark as recovery failed
      try {
        await prisma.$executeRaw`
          UPDATE queue_transition_audit 
          SET metadata = metadata || '{"recovery_failed": true, "error": ${error instanceof Error ? error.message : String(error)}}'::jsonb
          WHERE user_id = ${BigInt(transition.user_id)}
            AND timestamp = ${transition.timestamp}
        `;
      } catch (updateError) {
        console.error('Failed to update audit trail with recovery failure:', updateError);
      }
      
      return null;
    }
  }
  
  /**
   * Count valid pending requirements (excluding filtered types)
   */
  private countValidPendingRequirements(claims: any[]): number {
    const EXCLUDED_TYPES = [
      'signature',
      'vehicle_registration', 
      'cfa',
      'solicitor_letter_of_authority',
      'letter_of_authority'
    ];
    
    return claims.reduce((acc, claim) => {
      const validRequirements = claim.requirements.filter((req: any) => {
        // Exclude standard excluded types
        if (EXCLUDED_TYPES.includes(req.type || '')) {
          return false;
        }
        // Exclude id_document with specific reason
        if (req.type === 'id_document' && req.claim_requirement_reason === 'base requirement for claim.') {
          return false;
        }
        return true;
      });
      return acc + validRequirements.length;
    }, 0);
  }
  
  /**
   * Alert about unrecoverable conversion leaks
   */
  private async alertConversionLeak(transitions: ConversionLeak[], recovered: any[]): Promise<void> {
    const unrecovered = transitions.length - recovered.length;
    
    if (unrecovered > 0) {
      console.error(`🚨 CONVERSION LEAK ALERT: ${unrecovered} unrecoverable leaks detected!`);
      
      // Log detailed info about each unrecovered leak
      const unrecoveredTransitions = transitions.filter(t => 
        !recovered.some(r => r.userId === BigInt(t.user_id))
      );
      
      for (const leak of unrecoveredTransitions) {
        console.error('🔴 Unrecovered leak:', {
          userId: leak.user_id,
          fromQueue: leak.from_queue,
          toQueue: leak.to_queue,
          source: leak.source,
          timestamp: leak.timestamp
        });
      }
      
      // TODO: Integrate with Slack/email alerting
      // await this.sendSlackAlert(unrecoveredTransitions);
    }
  }
  
  /**
   * Log monitoring metrics for health dashboard
   */
  private async logMetrics(result: LeakDetectionResult): Promise<void> {
    try {
      // Store metrics for health dashboard
      await prisma.$executeRaw`
        INSERT INTO conversion_monitoring_metrics (
          timestamp, 
          potential_leaks, 
          recovered_conversions, 
          unrecovered_leaks,
          execution_time_ms
        ) VALUES (
          ${result.timestamp},
          ${result.potentialLeaks},
          ${result.recovered},
          ${result.unrecovered},
          ${result.executionTimeMs}
        )
        ON CONFLICT (timestamp) DO UPDATE SET
          potential_leaks = EXCLUDED.potential_leaks,
          recovered_conversions = EXCLUDED.recovered_conversions,
          unrecovered_leaks = EXCLUDED.unrecovered_leaks,
          execution_time_ms = EXCLUDED.execution_time_ms
      `;
    } catch (error) {
      // Table might not exist yet - continue without metrics
      console.warn('⚠️ Could not log metrics (table may not exist):', error);
    }
  }
  
  /**
   * Get health metrics for dashboard
   */
  async getHealthMetrics(hoursBack: number = 24): Promise<{
    totalTransitions: number;
    totalLeaks: number;
    totalRecovered: number;
    recoveryRate: number;
    avgExecutionTime: number;
  }> {
    try {
      const metrics = await prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(*) as total_checks,
          SUM(potential_leaks) as total_leaks,
          SUM(recovered_conversions) as total_recovered,
          AVG(execution_time_ms) as avg_execution_time
        FROM conversion_monitoring_metrics
        WHERE timestamp > NOW() - INTERVAL '${hoursBack} hours'
      `;
      
      const result = metrics[0] || {};
      const totalLeaks = Number(result.total_leaks || 0);
      const totalRecovered = Number(result.total_recovered || 0);
      
      return {
        totalTransitions: Number(result.total_checks || 0),
        totalLeaks,
        totalRecovered,
        recoveryRate: totalLeaks > 0 ? (totalRecovered / totalLeaks) * 100 : 100,
        avgExecutionTime: Number(result.avg_execution_time || 0)
      };
    } catch (error) {
      console.error('Failed to get health metrics:', error);
      return {
        totalTransitions: 0,
        totalLeaks: 0,
        totalRecovered: 0,
        recoveryRate: 100,
        avgExecutionTime: 0
      };
    }
  }
  
  /**
   * Start continuous monitoring (runs every 60 seconds)
   */
  startContinuousMonitoring(): void {
    console.log('🔍 Starting continuous conversion leak monitoring...');
    
    // Run immediately
    this.detectPotentialLeaks().catch(error => {
      console.error('❌ Initial leak detection failed:', error);
    });
    
    // Then run every 60 seconds
    setInterval(() => {
      this.detectPotentialLeaks().catch(error => {
        console.error('❌ Scheduled leak detection failed:', error);
      });
    }, 60 * 1000); // 60 seconds
  }
}

// Export singleton instance
export const conversionLeakMonitor = ConversionLeakMonitorService.getInstance();
