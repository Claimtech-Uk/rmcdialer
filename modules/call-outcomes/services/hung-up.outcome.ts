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
  readonly description = 'Customer answered but hung up during conversation';
  readonly category = 'negative' as const;
  
  // Scoring: Negative outcome, priority decrease
  readonly scoringRules = {
    scoreAdjustment: 25,
    description: 'Customer hung up - 24 hour delay',
    shouldTriggerConversion: false
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!context.callDurationSeconds || context.callDurationSeconds < 5) {
      warnings.push('Very short call duration - verify this was actually a hang-up');
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
      outcomeNotes: (data?.notes && data.notes.trim()) || 'Customer hung up during conversation'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Flag for review after multiple hang-ups
    if (context.previousOutcomes && 
        context.previousOutcomes.filter(o => o === 'hung_up').length >= 2) {
      actions.push({
        type: 'flag_for_review',
        description: 'Multiple hang-ups - consider approach adjustment',
        required: true,
        priority: 'medium'
      });
    }
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    // Fixed 1 day delay after hang-ups
    return 24;
  }
} 