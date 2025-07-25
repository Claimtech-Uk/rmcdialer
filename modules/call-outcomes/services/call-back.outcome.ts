import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class CallBackOutcome implements CallOutcomeHandler {
  readonly type = 'call_back' as const;
  readonly displayName = 'Call Back';
  readonly description = 'User requested a callback at specific time';
  readonly category = 'neutral' as const;
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    
    if (data?.callbackDateTime && new Date(data.callbackDateTime) <= new Date()) {
      errors.push('Callback time must be in the future');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      requiredFields: ['callbackDateTime']
    };
  }
  
  async execute(context: CallOutcomeContext, data?: any): Promise<CallOutcomeResult> {
    return {
      success: true,
      outcomeType: this.type,
      nextActions: await this.getNextActions(context, data),
      scoreAdjustment: this.getScoreAdjustment(context),
      callbackDateTime: data?.callbackDateTime,
      callbackReason: data?.callbackReason || 'User requested callback'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    return [];
  }
  
  getScoreAdjustment(context: CallOutcomeContext): number {
    return -10; // Slightly higher priority
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    return 0; // Scheduled time overrides delay
  }
} 