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
  readonly description = 'Customer explicitly stated they are not interested';
  readonly category = 'negative' as const;
  
  // Scoring: Bad outcome, significantly lower priority
  readonly scoringRules = {
    scoreAdjustment: 100,
    description: 'Customer not interested - 4 week delay',
    shouldTriggerConversion: false
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!context.callDurationSeconds || context.callDurationSeconds < 30) {
      warnings.push('Very short call for expressing disinterest - verify customer actually spoke');
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
      outcomeNotes: (data?.notes && data.notes.trim()) || 'Customer expressed they are not interested'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Flag for review after multiple not interested responses
    if (context.previousOutcomes && 
        context.previousOutcomes.filter(o => o === 'not_interested').length >= 1) {
      actions.push({
        type: 'flag_for_review',
        description: 'Multiple "not interested" responses - consider removing from queue',
        required: true,
        priority: 'medium'
      });
    }
    
    // Consider opt-out if customer is adamant
    if (data?.adamantRefusal) {
      actions.push({
        type: 'remove_from_queue',
        description: 'Customer adamantly refused - consider permanent removal',
        required: false,
        priority: 'high'
      });
    }
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    // Fixed 4 week delay for not interested customers
    return 672; // 4 weeks = 28 days * 24 hours
  }
} 