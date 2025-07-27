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
  
  // Scoring: Reset to 0 to jump the queue (customer tried to reach us!)
  readonly scoringRules = {
    scoreAdjustment: -999, // Large negative to ensure score hits 0 (bounded by system)
    description: 'Customer called us - reset to highest priority',
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
    
    return {
      success: true,
      outcomeType: this.type,
      nextActions,
      scoreAdjustment: this.scoringRules.scoreAdjustment,
      nextCallDelayHours: this.getDelayHours(context, data),
      callbackDateTime: data?.missedCallTime ? new Date(data.missedCallTime) : undefined,
      callbackReason: 'Return missed call - customer tried to reach us',
      outcomeNotes: data?.notes || `Customer called at ${data?.missedCallTime ? new Date(data.missedCallTime).toLocaleString() : 'unknown time'} but we missed it`
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Schedule immediate callback for the missed call
    if (data?.missedCallTime) {
      actions.push({
        type: 'schedule_callback',
        description: `Return missed call from ${new Date(data.missedCallTime).toLocaleString()}`,
        required: true,
        priority: 'critical',
        dueDate: new Date(data.missedCallTime), // Past date = immediate priority
        parameters: {
          callbackReason: 'Return missed call - customer tried to reach us',
          originalCallTime: data.missedCallTime,
          priority: 'urgent'
        }
      });
    }
    
    // Send acknowledgment SMS if customer left voicemail or we have their number
    actions.push({
      type: 'send_sms',
      description: 'Send acknowledgment SMS about missed call',
      required: false,
      priority: 'high',
      parameters: {
        messageType: 'missed_call_acknowledgment',
        originalCallTime: data?.missedCallTime
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
        originalCallTime: data?.missedCallTime
      }
    });
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext, data?: any): number {
    // Immediate callback - customer tried to reach us
    if (data?.missedCallTime) {
      const missedTime = new Date(data.missedCallTime);
      const now = new Date();
      
      // If the missed call was in the past, return 0 for immediate priority
      // The callback system should recognize past dates as immediate priority
      return 0;
    }
    
    // Fallback - very short delay
    return 0.5; // 30 minutes
  }
} 