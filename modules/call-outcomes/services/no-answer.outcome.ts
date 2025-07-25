import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class NoAnswerOutcome implements CallOutcomeHandler {
  readonly type = 'no_answer' as const;
  readonly displayName = 'No Answer';
  readonly description = 'Call went to voicemail or no pickup';
  readonly category = 'neutral' as const;
  
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
    return 5; // Slight penalty
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    return 4; // Try again in 4 hours
  }
} 