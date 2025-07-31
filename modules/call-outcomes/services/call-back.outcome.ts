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
  readonly description = 'Customer requested a callback at a specific time';
  readonly category = 'positive' as const;
  
  // Scoring: Excellent outcome, customer wants to engage
  readonly scoringRules = {
    scoreAdjustment: -15,
    description: 'Customer requested callback - high priority',
    shouldTriggerConversion: false
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (data?.callbackDateTime && new Date(data.callbackDateTime) <= new Date()) {
      errors.push('Callback date/time must be in the future');
    }
    
    if (!data?.callbackReason) {
      warnings.push('Consider adding a callback reason for better context');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredFields: ['callbackDateTime']
    };
  }
  
  async execute(context: CallOutcomeContext, data?: any): Promise<CallOutcomeResult> {
    const nextActions = await this.getNextActions(context, data);
    
    return {
      success: true,
      outcomeType: this.type,
      nextActions,
      scoreAdjustment: this.scoringRules.scoreAdjustment,
      nextCallDelayHours: this.getDelayHours(context, data),
      callbackDateTime: data?.callbackDateTime,
      callbackReason: data?.callbackReason || 'Customer requested callback',
      outcomeNotes: data?.notes || 'Customer requested a callback'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Schedule the callback
    actions.push({
      type: 'schedule_callback',
      description: `Schedule callback for ${data?.callbackDateTime || 'requested time'}`,
      required: true,
      priority: 'critical',
      dueDate: data?.callbackDateTime ? new Date(data.callbackDateTime) : undefined,
      parameters: {
        callbackReason: data?.callbackReason,
        preferredTime: data?.callbackDateTime
      }
    });
    
    // Send confirmation SMS
    actions.push({
      type: 'send_sms',
      description: 'Send callback confirmation SMS',
      required: false,
      priority: 'medium',
      parameters: {
        messageType: 'callback_confirmation',
        callbackTime: data?.callbackDateTime
      }
    });
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext, data?: any): number {
    // Use callback time set by the agent if provided
    if (data?.callbackDateTime) {
      const callbackTime = new Date(data.callbackDateTime);
      const now = new Date();
      const hoursUntilCallback = Math.max(0, (callbackTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      return Math.round(hoursUntilCallback);
    }
    
    // No delay if no callback time specified
    return 0;
  }
} 