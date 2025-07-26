import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class MightCompleteOutcome implements CallOutcomeHandler {
  readonly type = 'might_complete' as const;
  readonly displayName = 'Might Complete';
  readonly description = 'Customer showed interest but made no firm commitment';
  readonly category = 'neutral' as const;
  
  // Scoring: Cautiously optimistic, small priority boost
  readonly scoringRules = {
    scoreAdjustment: -5,
    description: 'Customer showed interest - slight priority boost',
    shouldTriggerConversion: false
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!context.callDurationSeconds || context.callDurationSeconds < 30) {
      warnings.push('Very short call for gauging interest');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredFields: []
    };
  }
  
  async execute(context: CallOutcomeContext, data?: any): Promise<CallOutcomeResult> {
    const nextActions = await this.getNextActions(context, data);
    
    return {
      success: true,
      outcomeType: this.type,
      nextActions,
      scoreAdjustment: this.scoringRules.scoreAdjustment,
      nextCallDelayHours: this.getDelayHours(context),
      magicLinkSent: data?.magicLinkSent || false,
      outcomeNotes: data?.notes || 'Customer showed some interest but no commitment'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Send magic link to make it easy
    if (!data?.magicLinkSent) {
      actions.push({
        type: 'send_magic_link',
        description: 'Send magic link to facilitate completion',
        required: false,
        priority: 'medium'
      });
    }
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    // Give them some time to think, but not too long
    return 24; // 1 day follow-up
  }
} 