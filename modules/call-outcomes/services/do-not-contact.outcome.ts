import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class DoNotContactOutcome implements CallOutcomeHandler {
  readonly type = 'do_not_contact' as const;
  readonly displayName = 'Do Not Contact';
  readonly description = 'Customer explicitly requested not to be contacted (opt-out)';
  readonly category = 'administrative' as const;
  
  // Scoring: Maximum penalty, should trigger immediate conversion/removal
  readonly scoringRules = {
    scoreAdjustment: 200,
    description: 'Customer opted out - remove from all queues immediately',
    shouldTriggerConversion: true
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!context.callDurationSeconds || context.callDurationSeconds < 30) {
      warnings.push('Very short call for an opt-out request - verify customer explicitly requested this');
    }
    
    if (!data?.reason) {
      warnings.push('Consider capturing specific reason for do-not-contact request');
    }
    
    if (!data?.notes) {
      errors.push('Notes are required for do-not-contact outcomes to document the customer request');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredFields: ['notes']
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
      conversions: [{
        type: 'opted_out',
        reason: data?.reason || 'Customer requested not to be contacted'
      }],
      outcomeNotes: (data?.notes && data.notes.trim()) || 'Customer explicitly requested not to be contacted'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Immediately remove from all queues
    actions.push({
      type: 'remove_from_queue',
      description: 'Remove from all calling queues - customer opted out',
      required: true,
      priority: 'critical'
    });
    
    // Removed mark_conversion action - opted out users are not conversions
    // They should be tracked as disqualifications, not conversions
    
    // Update user data to reflect opt-out status
    actions.push({
      type: 'update_user_data',
      description: 'Update contact preferences to opted-out',
      required: true,
      priority: 'critical',
      parameters: {
        contactPreference: 'opted_out',
        optOutReason: data?.reason,
        optOutDate: new Date(),
        optOutSource: 'call_outcome'
      }
    });
    
    // Send confirmation if customer requested it
    if (data?.sendConfirmation) {
      actions.push({
        type: 'send_sms',
        description: 'Send opt-out confirmation SMS',
        required: false,
        priority: 'medium',
        parameters: {
          messageType: 'opt_out_confirmation'
        }
      });
    }
    
    // Flag for legal/compliance review if needed
    if (data?.legalReview) {
      actions.push({
        type: 'flag_for_review',
        description: 'Flag for legal/compliance review',
        required: true,
        priority: 'high',
        parameters: {
          reviewType: 'compliance',
          reason: 'Explicit opt-out request'
        }
      });
    }
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    // No future calls - customer has opted out
    return 0;
  }
} 