import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class GoingToCompleteOutcome implements CallOutcomeHandler {
  readonly type = 'going_to_complete' as const;
  readonly displayName = 'Going to Complete';
  readonly description = 'Customer committed to completing their form soon';
  readonly category = 'positive' as const;
  
  // Scoring: Very good outcome, high priority boost
  readonly scoringRules = {
    scoreAdjustment: -25,
    description: 'Customer committed to completing form - high priority',
    shouldTriggerConversion: false
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!context.callDurationSeconds || context.callDurationSeconds < 60) {
      warnings.push('Short call for a commitment - verify customer understanding');
    }
    
    if (!data?.timeframe) {
      warnings.push('Consider capturing expected completion timeframe');
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
      outcomeNotes: data?.notes || 'Customer committed to completing their form'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Send magic link if not already sent
    if (!data?.magicLinkSent) {
      actions.push({
        type: 'send_magic_link',
        description: 'Send magic link to help customer complete form',
        required: true,
        priority: 'high'
      });
    }
    
    // Send follow-up SMS
    actions.push({
      type: 'send_sms',
      description: 'Send reminder SMS about form completion',
      required: false,
      priority: 'medium',
      parameters: {
        messageType: 'completion_reminder',
        timeframe: data?.timeframe
      }
    });
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    // Follow up relatively quickly to maintain momentum
    return 12; // 12 hours to check on progress
  }
} 