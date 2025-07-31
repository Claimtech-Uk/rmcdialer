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
  readonly description = 'Phone rang but customer did not answer';
  readonly category = 'neutral' as const;
  
  // Scoring: Neutral outcome, small priority decrease
  readonly scoringRules = {
    scoreAdjustment: 10,
    description: 'No answer - slightly harder to reach',
    shouldTriggerConversion: false
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!context.callDurationSeconds || context.callDurationSeconds > 30) {
      warnings.push('Call duration seems long for a no-answer call');
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
      outcomeNotes: (data?.notes && data.notes.trim()) || 'Customer did not answer the phone'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Consider leaving voicemail on subsequent attempts
    if (context.previousOutcomes && 
        context.previousOutcomes.filter(o => o === 'no_answer').length >= 2) {
      actions.push({
        type: 'flag_for_review',
        description: 'Multiple no-answer attempts - consider voicemail strategy',
        required: false,
        priority: 'low'
      });
    }
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    // Fixed 4 hour delay for no answer calls
    return 4;
  }
} 