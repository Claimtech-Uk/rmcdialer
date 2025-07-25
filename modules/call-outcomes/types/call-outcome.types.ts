// Call Outcome Types - Shared interfaces for call disposition handling

export type CallOutcomeType = 
  | 'completed_form'
  | 'going_to_complete'
  | 'might_complete'
  | 'call_back'
  | 'no_answer'
  | 'hung_up'
  | 'bad_number'
  | 'no_claim'
  | 'not_interested';

export type NextActionType = 
  | 'schedule_callback'
  | 'send_magic_link'
  | 'send_sms'
  | 'update_user_data'
  | 'flag_for_review'
  | 'remove_from_queue'
  | 'escalate_to_supervisor'
  | 'mark_conversion'
  | 'none';

export interface CallOutcomeContext {
  sessionId: string;
  userId: number;
  agentId: number;
  callDurationSeconds?: number;
  callStartedAt: Date;
  userContext?: any;
  previousOutcomes?: string[];
  queueType?: string;
}

export interface CallOutcomeResult {
  success: boolean;
  outcomeType: CallOutcomeType;
  outcomeNotes?: string;
  nextActions: NextAction[];
  scoreAdjustment?: number;
  nextCallDelayHours?: number;
  callbackDateTime?: Date;
  callbackReason?: string;
  magicLinkSent?: boolean;
  smsSent?: boolean;
  documentsRequested?: string[];
  conversions?: ConversionAction[];
  errors?: string[];
}

export interface NextAction {
  type: NextActionType;
  description: string;
  required: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: Date;
  parameters?: Record<string, any>;
}

export interface CallOutcomeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
}

export interface ConversionAction {
  type: 'completed' | 'opted_out' | 'no_longer_eligible';
  reason: string;
  documentsRequested?: string[];
}

export interface OutcomeProcessingOptions {
  validateBeforeProcessing?: boolean;
  skipNextActions?: boolean;
  suppressNotifications?: boolean;
  bypassBusinessRules?: boolean;
}

export interface CallOutcomeHandler {
  readonly type: CallOutcomeType;
  readonly displayName: string;
  readonly description: string;
  readonly category: 'positive' | 'neutral' | 'negative' | 'administrative';
  
  validate(context: CallOutcomeContext, data?: any): Promise<CallOutcomeValidation>;
  execute(context: CallOutcomeContext, data?: any): Promise<CallOutcomeResult>;
  getNextActions(context: CallOutcomeContext, data?: any): Promise<NextAction[]>;
  getScoreAdjustment(context: CallOutcomeContext): number;
  getDelayHours(context: CallOutcomeContext): number;
} 