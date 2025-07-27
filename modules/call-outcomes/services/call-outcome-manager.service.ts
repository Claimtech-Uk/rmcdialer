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