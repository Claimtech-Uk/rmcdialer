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
    
    if (data?.callbackDateTime && new Date(data.callbackDateTime) <= new Date()) {
      errors.push('Callback date/time must be in the future');
    }
    
    if (!data?.callbackDateTime) {
      warnings.push('Consider scheduling a callback to follow up on interest');
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
      nextCallDelayHours: this.getDelayHours(context, data),
      callbackDateTime: data?.callbackDateTime,
      callbackReason: data?.callbackReason || 'Follow up on customer interest',
      magicLinkSent: data?.magicLinkSent || false,
      outcomeNotes: data?.notes || 'Customer showed some interest but no commitment'
    };
  }

  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Schedule callback if time was provided
    if (data?.callbackDateTime) {
      actions.push({
        type: 'schedule_callback',
        description: `Schedule follow-up callback for ${data.callbackDateTime}`,
        required: true,
        priority: 'high',
        dueDate: new Date(data.callbackDateTime),
        parameters: {
          callbackReason: data?.callbackReason || 'Follow up on customer interest',
          preferredTime: data.callbackDateTime
        }
      });
    } else {
      // Prompt agent to schedule callback
      actions.push({
        type: 'flag_for_review',
        description: 'Agent should schedule callback to follow up on interest',
        required: true,
        priority: 'medium',
        parameters: {
          reviewType: 'schedule_callback',
          reason: 'Customer showed interest - needs follow-up'
        }
      });
    }
    
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

  getDelayHours(context: CallOutcomeContext, data?: any): number {
    // Use callback time if provided, otherwise default to 24 hours
    if (data?.callbackDateTime) {
      const callbackTime = new Date(data.callbackDateTime);
      const now = new Date();
      const hoursUntilCallback = Math.max(0, (callbackTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      return Math.round(hoursUntilCallback);
    }
    
    // Default follow-up if no callback scheduled
    return 24;
  }
} 