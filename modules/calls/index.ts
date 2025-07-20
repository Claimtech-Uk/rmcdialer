// Calls Module Exports
// Services, types, components, and hooks for call management

// Services (server-side only - do not import in client components)
// export { CallService } from './services/call.service';

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
  CallHistoryEntry,
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
export { CallHistoryTable } from './components/CallHistoryTable';

// Hooks
export { useTwilioVoice } from './hooks/useTwilioVoice';
export { useCallHistory } from './hooks/useCallHistory';

// Utils
// (Add utils exports here when created)
