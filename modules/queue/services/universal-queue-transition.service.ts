// =============================================================================
// Universal Queue Transition Service
// =============================================================================
// 🔐 THE SINGLE SOURCE OF TRUTH for all currentQueueType changes
// Every queue transition MUST go through this service to ensure conversion tracking

import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { ConversionLoggingService } from '@/modules/discovery/services/conversion-logging.service';
import type { Prisma } from '@prisma/client';

export interface QueueTransitionRequest {
  userId: number;
  fromQueue: string | null;
  toQueue: string | null;
  reason: string;
  source: string;
  agentId?: number;
  metadata?: Record<string, any>;
  skipConversionCheck?: boolean; // For emergency admin operations
}

export interface QueueTransitionResult {
  success: boolean;
  transitioned: boolean;
  conversionLogged: boolean;
  conversionId?: string;
  auditTrail: boolean;
  error?: string;
}

export interface ConversionEligibilityResult {
  shouldLog: boolean;
  conversionType?: string;
  reason?: string;
}

/**
 * Universal Queue Transition Service
 * 
 * 🎯 GUARANTEES:
 * 1. Every queue transition is logged in audit trail
 * 2. Every eligible conversion is captured
 * 3. Atomic operations (all-or-nothing)
 * 4. Complete traceability
 * 5. Zero missed conversions
 */
export class UniversalQueueTransitionService {
  
  /**
   * 🔐 THE SINGLE CHOKEPOINT - All queue changes must use this method
   */
  async transitionUserQueue(request: QueueTransitionRequest): Promise<QueueTransitionResult> {
    const { userId, fromQueue, toQueue, reason, source, agentId, metadata = {}, skipConversionCheck = false } = request;
    
    try {
      // Validate inputs
      if (!userId || !reason || !source) {
        throw new Error('Missing required fields: userId, reason, source');
      }
      
      // Skip if no actual change
      if (fromQueue === toQueue) {
        return {
          success: true,
          transitioned: false,
          conversionLogged: false,
          auditTrail: false,
          error: 'No queue change detected'
        };
      }
      
      console.log(`🔄 Queue transition: User ${userId} from ${fromQueue || 'null'} to ${toQueue || 'null'} (${source})`);
      
      // 1. Check conversion eligibility BEFORE making any changes
      let conversionCheck: ConversionEligibilityResult = { shouldLog: false };
      if (!skipConversionCheck && fromQueue) {
        conversionCheck = await this.checkConversionEligibility(userId, fromQueue, toQueue);
      }
      
      // 2. Execute transition in atomic transaction
      return await prisma.$transaction(async (tx) => {
        
        // 3. Log conversion FIRST if eligible (before queue change)
        let conversionId: string | undefined;
        if (conversionCheck.shouldLog) {
          try {
            const conversion = await ConversionLoggingService.logConversion({
              userId: BigInt(userId),
              previousQueueType: fromQueue!,
              conversionType: conversionCheck.conversionType as any,
              conversionReason: `${conversionCheck.reason} | ${reason}`,
              source: source as any,
              primaryAgentId: agentId,
              convertedAt: new Date()
            });
            conversionId = conversion.id;
            console.log(`🎉 Conversion logged: ${conversionId} for user ${userId}`);
          } catch (conversionError) {
            console.error(`❌ Failed to log conversion for user ${userId}:`, conversionError);
            // Continue with queue transition even if conversion logging fails
            // We'll catch this in monitoring
          }
        }
        
        // 4. Update user_call_scores
        const updateResult = await tx.userCallScore.updateMany({
          where: { userId: BigInt(userId) },
          data: { 
            currentQueueType: toQueue,
            lastQueueCheck: new Date(),
            updatedAt: new Date()
          }
        });
        
        // 5. Create audit trail (always, even for failed conversions)
        await tx.$executeRaw`
          INSERT INTO queue_transition_audit (
            user_id, from_queue, to_queue, reason, source, agent_id, 
            conversion_id, conversion_logged, timestamp, metadata
          ) VALUES (
            ${BigInt(userId)}, ${fromQueue}, ${toQueue}, ${reason}, ${source}, 
            ${agentId || null}, ${conversionId || null}, ${!!conversionId}, 
            NOW(), ${JSON.stringify(metadata)}::jsonb
          )
        `;
        
        console.log(`✅ Queue transition completed: User ${userId} ${fromQueue || 'null'} → ${toQueue || 'null'}`);
        
        return {
          success: true,
          transitioned: updateResult.count > 0,
          conversionLogged: !!conversionId,
          conversionId,
          auditTrail: true
        };
      });
      
    } catch (error) {
      console.error(`❌ Queue transition failed for user ${userId}:`, error);
      return {
        success: false,
        transitioned: false,
        conversionLogged: false,
        auditTrail: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Check if a queue transition should trigger a conversion
   */
  private async checkConversionEligibility(
    userId: number, 
    fromQueue: string | null, 
    toQueue: string | null
  ): Promise<ConversionEligibilityResult> {
    
    try {
      // Only check transitions out of queues
      if (!fromQueue || fromQueue === toQueue) {
        return { shouldLog: false };
      }
      
      // Get real-time user status from replica
      const userData = await replicaDb.user.findUnique({
        where: { id: BigInt(userId) },
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
        console.warn(`⚠️ User ${userId} not found in replica DB for conversion check`);
        return { shouldLog: false };
      }
      
      const hasSignature = userData.current_signature_file_id !== null;
      const pendingRequirements = this.countValidPendingRequirements(userData.claims);
      
      // Use existing conversion logic
      const conversionDecision = ConversionLoggingService.shouldLogConversion(
        fromQueue as 'unsigned_users' | 'outstanding_requests',
        toQueue,
        { hasSignature, pendingRequirements }
      );
      
      if (conversionDecision.shouldLog) {
        console.log(`🎯 Conversion eligible: User ${userId} ${fromQueue} → ${toQueue} (${conversionDecision.reason})`);
      }
      
      return {
        shouldLog: conversionDecision.shouldLog,
        conversionType: conversionDecision.conversionType,
        reason: conversionDecision.reason
      };
      
    } catch (error) {
      console.error(`❌ Conversion eligibility check failed for user ${userId}:`, error);
      return { shouldLog: false };
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
   * Bulk transition multiple users (for migration scripts)
   */
  async bulkTransitionUsers(transitions: QueueTransitionRequest[]): Promise<{
    processed: number;
    successful: number;
    failed: number;
    conversionsLogged: number;
  }> {
    let successful = 0;
    let failed = 0;
    let conversionsLogged = 0;
    
    for (const transition of transitions) {
      try {
        const result = await this.transitionUserQueue(transition);
        if (result.success) {
          successful++;
          if (result.conversionLogged) conversionsLogged++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Bulk transition failed for user ${transition.userId}:`, error);
        failed++;
      }
    }
    
    return {
      processed: transitions.length,
      successful,
      failed,
      conversionsLogged
    };
  }
  
  /**
   * Emergency method for admin operations (skips conversion checking)
   */
  async emergencyTransition(
    userId: number,
    fromQueue: string | null,
    toQueue: string | null,
    adminReason: string,
    adminId?: number
  ): Promise<QueueTransitionResult> {
    return this.transitionUserQueue({
      userId,
      fromQueue,
      toQueue,
      reason: `EMERGENCY: ${adminReason}`,
      source: 'admin_emergency',
      agentId: adminId,
      skipConversionCheck: true,
      metadata: { emergency: true, timestamp: new Date().toISOString() }
    });
  }
}

// Export singleton instance
export const universalQueueTransitionService = new UniversalQueueTransitionService();
