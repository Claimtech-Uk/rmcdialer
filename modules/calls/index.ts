// Calls Module Exports
// Services, types, components, and hooks for call management

// Services
export { CallService } from './services/call.service';

// Types
export type {
  CallSession,
  CallSessionOptions,
  CallUpdateOptions,
  CallOutcome,
  CallOutcomeOptions,
  UserCallContext,
  CallSessionWithContext,
  GetCallHistoryOptions,
  CallHistoryResult,
  CallAnalytics,
  CallAnalyticsFilters,
  Callback,
  CreateCallbackRequest,
  GetCallbacksOptions,
  CallbacksResult,
  TwilioWebhookData,
  InitiateCallRequest,
  InitiateCallResponse,
  LiveCallStatus,
  CallError
} from './types/call.types';

// Components
export { CallInterface } from './components/CallInterface';
export { CallOutcomeModal } from './components/CallOutcomeModal';

// Hooks
export { useTwilioVoice } from './hooks/useTwilioVoice';

// Utils
// (Add utils exports here when created)
