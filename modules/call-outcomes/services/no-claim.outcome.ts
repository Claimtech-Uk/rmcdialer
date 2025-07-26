import type { 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult, 
  CallOutcomeValidation, 
  NextAction 
} from '../types/call-outcome.types';

export class NoClaimOutcome implements CallOutcomeHandler {
  readonly type = 'no_claim' as const;
  readonly displayName = 'No Claim';
  readonly description = 'Customer has no valid claim or requirements';
  readonly category = 'administrative' as const;
  
  // Scoring: Should trigger conversion/removal
  readonly scoringRules = {
    scoreAdjustment: 200,
    description: 'No valid claim - should be removed from queue',
    shouldTriggerConversion: true
  };
  
  async validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!context.callDurationSeconds || context.callDurationSeconds < 60) {
      warnings.push('Short call for determining no claim - verify thoroughly investigated');
    }
    
    if (!data?.reason) {
      warnings.push('Consider capturing specific reason for no claim');
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
      conversions: [{
        type: 'no_longer_eligible',
        reason: data?.reason || 'No valid claim or requirements found'
      }],
      outcomeNotes: data?.notes || 'Customer has no valid claim or requirements'
    };
  }
  
  async getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]> {
    const actions: NextAction[] = [];
    
    // Remove from queue immediately
    actions.push({
      type: 'remove_from_queue',
      description: 'Remove from calling queue - no valid claim',
      required: true,
      priority: 'critical'
    });
    
    // Mark conversion as "no longer eligible"
    actions.push({
      type: 'mark_conversion',
      description: 'Mark as converted - no longer eligible',
      required: true,
      priority: 'critical',
      parameters: {
        conversionType: 'no_longer_eligible',
        reason: data?.reason
      }
    });
    
    // Update user data
    actions.push({
      type: 'update_user_data',
      description: 'Update eligibility status',
      required: true,
      priority: 'high',
      parameters: {
        eligibilityStatus: 'ineligible',
        ineligibilityReason: data?.reason
      }
    });
    
    return actions;
  }
  
  getDelayHours(context: CallOutcomeContext): number {
    // No further calls needed
    return 0;
  }
} 