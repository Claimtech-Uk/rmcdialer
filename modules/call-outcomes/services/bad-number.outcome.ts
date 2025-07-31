import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class BadNumberOutcome implements CallOutcomeHandler {
  readonly type = 'bad_number' as const;
  readonly displayName = 'Bad Number';
  readonly description = 'Phone number is incorrect or disconnected';
  readonly category = 'administrative' as const;
  
  // Scoring: Significant problem, major priority decrease
  readonly scoringRules = {
    scoreAdjustment: 50,
    description: 'Bad number - 4 week delay until contact info updated',
    shouldTriggerConversion: false
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!context.callDurationSeconds || context.callDurationSeconds > 10) {
      warnings.push('Call duration seems long for a bad number');
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
      outcomeNotes: data?.notes || 'Phone number is incorrect or disconnected'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Update user data with bad number flag
    actions.push({
      type: 'update_user_data',
      description: 'Flag phone number as invalid',
      required: true,
      priority: 'high',
      parameters: {
        phoneNumberStatus: 'invalid',
        invalidReason: data?.invalidReason || 'disconnected_or_wrong'
      }
    });
    
    // Flag for review to find alternative contact
    actions.push({
      type: 'flag_for_review',
      description: 'Find alternative contact information',
      required: true,
      priority: 'medium'
    });
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    // 4 week delay until contact info is updated
    return 672; // 4 weeks = 28 days * 24 hours
  }
} 