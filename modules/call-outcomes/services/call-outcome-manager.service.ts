import type { 
  CallOutcomeType, 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult,
  OutcomeProcessingOptions 
} from '../types/call-outcome.types';

// Import all outcome handlers
import { CompletedFormOutcome } from './completed-form.outcome';
import { GoingToCompleteOutcome } from './going-to-complete.outcome';
import { MightCompleteOutcome } from './might-complete.outcome';
import { CallBackOutcome } from './call-back.outcome';
import { NoAnswerOutcome } from './no-answer.outcome';
import { MissedCallOutcome } from './missed-call.outcome';
import { HungUpOutcome } from './hung-up.outcome';
import { BadNumberOutcome } from './bad-number.outcome';
import { NoClaimOutcome } from './no-claim.outcome';
import { NotInterestedOutcome } from './not-interested.outcome';
import { DoNotContactOutcome } from './do-not-contact.outcome';

// Main service to coordinate all call outcome processing
export class CallOutcomeManager {
  private handlers: Map<CallOutcomeType, CallOutcomeHandler> = new Map();
  private prisma: any = null; // Cached Prisma instance
  
  constructor() {
    this.registerAllHandlers();
  }
  
  private registerAllHandlers(): void {
    // Register all outcome handlers
    const handlers = [
      new CompletedFormOutcome(),
      new GoingToCompleteOutcome(),
      new MightCompleteOutcome(),
      new CallBackOutcome(),
      new NoAnswerOutcome(),
      new MissedCallOutcome(),
      new HungUpOutcome(),
      new BadNumberOutcome(),
      new NoClaimOutcome(),
      new NotInterestedOutcome(),
      new DoNotContactOutcome()
    ];
    
    handlers.forEach(handler => {
      this.registerHandler(handler);
    });
  }
  
  registerHandler(handler: CallOutcomeHandler): void {
    this.handlers.set(handler.type, handler);
  }
  
  async processOutcome(
    outcomeType: CallOutcomeType,
    context: CallOutcomeContext,
    data?: any,
    options?: OutcomeProcessingOptions
  ): Promise<CallOutcomeResult> {
    const handler = this.handlers.get(outcomeType);
    
    if (!handler) {
      throw new Error(`No handler registered for outcome type: ${outcomeType}`);
    }
    
    // Validate before processing if requested
    if (options?.validateBeforeProcessing !== false) {
      const validation = await handler.validate(context, data);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    // Execute the outcome
    const result = await handler.execute(context, data);
    
    if (!result.success) {
      throw new Error(`Outcome processing failed for type: ${outcomeType}`);
    }

    // ✅ UPDATE CALL SESSION WITH OUTCOME DATA
    if (context.sessionId && options?.updateCallSession !== false) {
      try {
        // Create and cache Prisma client instance to avoid connection pool issues
        if (!this.prisma) {
          const { PrismaClient } = await import('@prisma/client');
          this.prisma = new PrismaClient();
        }
        
        await this.prisma.callSession.update({
          where: { id: context.sessionId },
          data: {
            lastOutcomeType: outcomeType,
            lastOutcomeNotes: result.outcomeNotes || data?.notes || `Processed ${outcomeType} outcome`,
            lastOutcomeAt: new Date(),
            lastOutcomeAgentId: context.agentId,
            // Update status for missed calls specifically
            ...(outcomeType === 'missed_call' && {
              status: 'missed_call',
              endedAt: new Date()
            })
          }
        });
        
        console.log(`✅ Updated call session ${context.sessionId} with outcome: ${outcomeType}`);
      } catch (updateError) {
        console.error(`⚠️ Failed to update call session ${context.sessionId} with outcome:`, updateError);
        // Don't throw - the outcome processing succeeded, this is just a data consistency issue
      }
    }
    
    return result;
  }
  
  getHandler(outcomeType: CallOutcomeType): CallOutcomeHandler | undefined {
    return this.handlers.get(outcomeType);
  }
  
  getAllHandlers(): CallOutcomeHandler[] {
    return Array.from(this.handlers.values());
  }
  
  /**
   * Get scoring adjustment for a specific outcome type
   * Used by the scoring service to get outcome-specific score changes
   */
  getScoreAdjustment(outcomeType: CallOutcomeType): number {
    const handler = this.handlers.get(outcomeType);
    return handler?.scoringRules.scoreAdjustment || 0;
  }
  
  /**
   * Get all outcome types and their scoring rules
   * Useful for debugging and documentation
   */
  getScoringRules(): Record<CallOutcomeType, { scoreAdjustment: number; description: string }> {
    const rules: Record<string, { scoreAdjustment: number; description: string }> = {};
    
    this.handlers.forEach((handler, type) => {
      rules[type] = {
        scoreAdjustment: handler.scoringRules.scoreAdjustment,
        description: handler.scoringRules.description
      };
    });
    
    return rules as Record<CallOutcomeType, { scoreAdjustment: number; description: string }>;
  }
} 