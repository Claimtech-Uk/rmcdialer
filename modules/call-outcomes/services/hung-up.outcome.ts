import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class HungUpOutcome implements CallOutcomeHandler {
  readonly type = 'hung_up' as const;
  readonly displayName = 'Hung Up';
  readonly description = 'User hung up during call';
  readonly category = 'negative' as const;
  
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
    return 25; // Higher penalty
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    return 168; // Wait a week
  }
} 