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
  
  // Scoring: Reset score to baseline - callback time set by agent
  readonly scoringRules = {
    scoreAdjustment: 0,
    description: 'Customer committed to completing form - callback time set by agent',
    shouldTriggerConversion: false
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!context.callDurationSeconds || context.callDurationSeconds < 60) {
      warnings.push('Short call for a commitment - verify customer understanding');
    }
    
    if (data?.callbackDateTime && new Date(data.callbackDateTime) <= new Date()) {
      errors.push('Callback date/time must be in the future');
    }
    
    if (!data?.callbackDateTime) {
      warnings.push('Consider scheduling a callback to follow up on commitment');
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
      callbackReason: data?.callbackReason || 'Follow up on commitment to complete form',
      magicLinkSent: data?.magicLinkSent || false,
      outcomeNotes: data?.notes || 'Customer committed to completing their form'
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
        priority: 'critical',
        dueDate: new Date(data.callbackDateTime),
        parameters: {
          callbackReason: data?.callbackReason || 'Follow up on commitment to complete form',
          preferredTime: data.callbackDateTime
        }
      });
    } else {
      // Prompt agent to schedule callback
      actions.push({
        type: 'flag_for_review',
        description: 'Agent should schedule callback to follow up on commitment',
        required: true,
        priority: 'high',
        parameters: {
          reviewType: 'schedule_callback',
          reason: 'Customer committed to completing form - needs follow-up'
        }
      });
    }
    
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

  getDelayHours(context: CallOutcomeContext, data?: any): number {
    // Use callback time if provided, otherwise default to 12 hours
    if (data?.callbackDateTime) {
      const callbackTime = new Date(data.callbackDateTime);
      const now = new Date();
      const hoursUntilCallback = Math.max(0, (callbackTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      return Math.round(hoursUntilCallback);
    }
    
    // Default follow-up if no callback scheduled
    return 12;
  }
} 