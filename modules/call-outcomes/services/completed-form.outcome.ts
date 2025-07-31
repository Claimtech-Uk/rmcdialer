import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class CompletedFormOutcome implements CallOutcomeHandler {
  readonly type = 'completed_form' as const;
  readonly displayName = 'Completed Form';
  readonly description = 'User has completed their form submission';
  readonly category = 'positive' as const;
  
  // Scoring: No score change - user will be removed from queue after signature check
  readonly scoringRules = {
    scoreAdjustment: 0,
    description: 'Form completed - user will be removed from queue if signature validates',
    shouldTriggerConversion: true
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!context.callDurationSeconds || context.callDurationSeconds < 60) {
      warnings.push('Very short call duration for a completed form');
    }
    
    if (!data?.documentsRequested || data.documentsRequested.length === 0) {
      warnings.push('No documents requested - verify form was actually completed');
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
      documentsRequested: data?.documentsRequested || [],
      conversions: [{
        type: 'completed',
        reason: 'Form completed successfully',
        documentsRequested: data?.documentsRequested
      }],
      outcomeNotes: (data?.notes && data.notes.trim()) || 'Customer completed their form submission'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Mark for conversion - highest priority
    actions.push({
      type: 'mark_conversion',
      description: 'Mark user as converted - form completed',
      required: true,
      priority: 'critical'
    });
    
    // Remove from queue
    actions.push({
      type: 'remove_from_queue',
      description: 'Remove from calling queue - requirements met',
      required: true,
      priority: 'critical'
    });
    
    // Send confirmation if magic link was used
    if (data?.magicLinkSent) {
      actions.push({
        type: 'send_sms',
        description: 'Send completion confirmation SMS',
        required: false,
        priority: 'medium',
        parameters: {
          messageType: 'completion_confirmation'
        }
      });
    }
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    // 1 day follow-up to confirm completion
    return 24;
  }
} 