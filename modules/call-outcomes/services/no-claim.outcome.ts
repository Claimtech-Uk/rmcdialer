import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class NoClaimOutcome implements CallOutcomeHandler {
  readonly type = 'no_claim' as const;
  readonly displayName = 'No Claim';
  readonly description = 'User does not have a valid claim';
  readonly category = 'administrative' as const;
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      requiredFields: []
    };
  }
  
  async execute(context: CallOutcomeContext, data?: any): Promise<CallOutcomeResult> {
    return {
      success: true,
      outcomeType: this.type,
      nextActions: await this.getNextActions(context, data),
      scoreAdjustment: this.getScoreAdjustment(context),
      nextCallDelayHours: this.getDelayHours(context)
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    return [];
  }
  
  getScoreAdjustment(context: CallOutcomeContext): number {
    return 200; // Remove from queue
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    return 0; // No future calls needed
  }
} 