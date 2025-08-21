// =============================================================================
// SMS Follow-ups Module
// =============================================================================

// Types
export * from './types';

// Services
export { ScheduledSmsService } from './services/scheduled-sms.service';
export { OutcomeFollowupScheduler } from './services/outcome-followup-scheduler.service';
export { ReviewRequestScheduler } from './services/review-request-scheduler.service';
export { scheduledSmsPolicies, isEligibleToSend, getCancelEvents } from './services/scheduled-sms.policy';
export { smsTemplates, generateMessage, getAvailableTemplates } from './services/scheduled-sms.templates';

// Re-export for convenience
export type {
  FollowUpType,
  ScheduledSmsStatus,
  ScheduledSmsOrigin,
  CancelEvent,
  EnqueueSmsInput,
  ProcessDueOptions,
  ProcessDueResult,
  CancelByEventOptions,
  CancelByEventResult,
  OutcomeFollowupContext
} from './types';
