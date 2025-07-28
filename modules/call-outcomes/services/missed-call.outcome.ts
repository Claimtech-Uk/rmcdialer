import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class MissedCallOutcome implements CallOutcomeHandler {
  readonly type = 'missed_call' as const;
  readonly displayName = 'Missed Call';
  readonly description = 'Customer called us but we missed it - reset to high priority';
  readonly category = 'positive' as const;
  
  // Scoring: Reset score to baseline - immediate callback scheduled instead
  readonly scoringRules = {
    scoreAdjustment: 0,
    description: 'Customer called us - reset score, immediate callback scheduled',
    shouldTriggerConversion: false
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!data?.missedCallTime) {
      errors.push('Missed call time is required - when did the customer call?');
    }
    
    if (data?.missedCallTime && new Date(data.missedCallTime) > new Date()) {
      errors.push('Missed call time cannot be in the future');
    }
    
    // Check if the missed call time is too old (optional warning)
    if (data?.missedCallTime) {
      const missedTime = new Date(data.missedCallTime);
      const now = new Date();
      const hoursSinceMissed = (now.getTime() - missedTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceMissed > 24) {
        warnings.push('Missed call is over 24 hours old - customer may have found alternative solution');
      }
    }
    
    if (context.callDurationSeconds && context.callDurationSeconds > 5) {
      warnings.push('Call duration seems long for a missed call - verify this was an inbound call we missed');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredFields: ['missedCallTime']
    };
  }

  async execute(context: CallOutcomeContext, data?: any): Promise<CallOutcomeResult> {
    const nextActions = await this.getNextActions(context, data);
    
    // Calculate dynamic callback time based on when the call was received
    const callbackTime = data?.missedCallTime ? new Date(data.missedCallTime) : new Date();
    
    return {
      success: true,
      outcomeType: this.type,
      nextActions,
      scoreAdjustment: this.scoringRules.scoreAdjustment,
      nextCallDelayHours: this.getDelayHours(context, data),
      callbackDateTime: callbackTime,
      callbackReason: 'Return missed call - customer tried to reach us',
      outcomeNotes: data?.notes || `Customer called at ${callbackTime.toLocaleString()} but we missed it`
    };
  }

  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Calculate dynamic callback time
    const callbackTime = data?.missedCallTime ? new Date(data.missedCallTime) : new Date();
    
    // Schedule immediate callback for the missed call
    actions.push({
      type: 'schedule_callback',
      description: `Return missed call from ${callbackTime.toLocaleString()}`,
      required: true,
      priority: 'critical',
      dueDate: callbackTime, // Dynamic time based on when user called
      parameters: {
        callbackReason: 'Return missed call - customer tried to reach us',
        originalCallTime: data?.missedCallTime || new Date().toISOString(),
        priority: 'urgent',
        callbackType: 'missed_call_return'
      }
    });
    
    // Send specific acknowledgment SMS with requested format
    actions.push({
      type: 'send_sms',
      description: 'Send acknowledgment SMS about missed call',
      required: false,
      priority: 'high',
      parameters: {
        messageType: 'missed_call_acknowledgment',
        messageTemplate: 'Hey {name},\n\nSorry we missed your call, we\'ll call you back ASAP!\n\nRMC team',
        originalCallTime: data?.missedCallTime || new Date().toISOString(),
        personalizeWithName: true
      }
    });
    
    // Flag for immediate attention
    actions.push({
      type: 'flag_for_review',
      description: 'Customer attempted to call - prioritize immediate callback',
      required: true,
      priority: 'critical',
      parameters: {
        reviewType: 'missed_inbound_call',
        urgency: 'immediate',
        originalCallTime: data?.missedCallTime || new Date().toISOString(),
        callbackTime: callbackTime.toISOString()
      }
    });
    
    return actions;
  }

  getDelayHours(context: CallOutcomeContext, data?: any): number {
    // Dynamic callback timing - immediate if recent, calculated if older
    if (data?.missedCallTime) {
      const missedTime = new Date(data.missedCallTime);
      const now = new Date();
      const hoursSinceMissed = (now.getTime() - missedTime.getTime()) / (1000 * 60 * 60);
      
      // If missed call was very recent (< 1 hour), immediate callback
      if (hoursSinceMissed < 1) {
        return 0;
      }
      
      // If missed call was recent (< 4 hours), call back ASAP
      if (hoursSinceMissed < 4) {
        return 0.25; // 15 minutes
      }
      
      // If missed call was older, still prioritize but allow brief prep time
      return 0.5; // 30 minutes
    }
    
    // Fallback - immediate
    return 0;
  }
} 