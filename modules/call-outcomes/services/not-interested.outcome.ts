import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class NotInterestedOutcome implements CallOutcomeHandler {
  readonly type = 'not_interested' as const;
  readonly displayName = 'Not Interested';
  readonly description = 'User explicitly stated they are not interested';
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
    return 100; // Significant penalty
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    return 720; // Wait 30 days
  }
} 