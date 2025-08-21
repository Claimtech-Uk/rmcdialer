// =============================================================================
// SMS Follow-ups Types
// =============================================================================

export type FollowUpType =
  | 'no_answer_checkin'
  | 'callback_confirmation'
  | 'completion_reminder_evening'
  | 'completion_reminder_plus_3d'
  | 'maybe_completion_evening'
  | 'maybe_completion_plus_5d'
  | 'review_request';

export type ScheduledSmsStatus = 'pending' | 'processing' | 'sent' | 'canceled' | 'failed';

export type ScheduledSmsOrigin = 'ai' | 'agent' | 'system';

export type CancelEvent = 
  | 'inbound_sms'
  | 'user_signed'
  | 'callback_canceled'
  | 'callback_completed'
  | 'manual_cancel';

// -----------------------------------------------------------------------------
// Service Interfaces
// -----------------------------------------------------------------------------

export interface EnqueueSmsInput {
  userId: number;
  phoneNumber: string;
  followUpType: FollowUpType;
  messageType: string;
  templateKey?: string;
  message?: string;
  scheduledFor: Date;
  origin?: ScheduledSmsOrigin;
  createdByAgentId?: number;
  dedupKey?: string;
  meta?: Record<string, any>;
}

export interface ProcessDueOptions {
  limit?: number;
  dryRun?: boolean;
}

export interface ProcessDueResult {
  processed: number;
  sent: number;
  canceled: number;
  failed: number;
  errors: string[];
}

export interface CancelByEventOptions {
  userId: number;
  eventType: CancelEvent;
  followUpTypes?: FollowUpType[];
  reason?: string;
  meta?: Record<string, any>;
}

export interface CancelByEventResult {
  canceled: number;
  items: Array<{
    id: string;
    followUpType: FollowUpType;
    scheduledFor: Date;
  }>;
}

// -----------------------------------------------------------------------------
// Policy Types
// -----------------------------------------------------------------------------

export interface EligibilityContext {
  userId: number;
  phoneNumber: string;
  scheduledFor: Date;
  followUpType: FollowUpType;
  meta?: Record<string, any>;
}

export interface FollowUpPolicy {
  isEligible: (ctx: EligibilityContext) => Promise<boolean>;
  cancelOnEvents?: CancelEvent[];
  description?: string;
}

export type FollowUpPolicyMap = Record<FollowUpType, FollowUpPolicy>;

// -----------------------------------------------------------------------------
// Template Types
// -----------------------------------------------------------------------------

export interface TemplateContext {
  userId: number;
  firstName?: string;
  lastName?: string;
  phoneNumber: string;
  meta?: Record<string, any>;
}

export interface SmsTemplate {
  key: string;
  generate: (ctx: TemplateContext) => Promise<string>;
  messageType: string;
  requiresConsent?: boolean;
}

export type TemplateMap = Record<string, SmsTemplate>;

// -----------------------------------------------------------------------------
// Outcome Follow-up Types
// -----------------------------------------------------------------------------

export interface OutcomeFollowupContext {
  userId: number;
  phoneNumber: string;
  sessionId: string;
  agentId: number;
  outcomeType: string;
  outcomeResult: any;
  userScore?: {
    totalAttempts: number;
  };
}
