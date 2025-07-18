// Calls Module - Call Sessions, Outcomes, Twilio Integration & Analytics
// This module handles call sessions, outcomes, Twilio integration, callbacks, and call analytics

// Services (main business logic)
export { CallService } from './services/call.service'
export { TwilioVoiceService } from './services/twilio-voice.service'

// Types (for other modules and tRPC)
export type {
  CallSession,
  CallSessionOptions,
  CallUpdateOptions,
  CallOutcomeOptions,
  CallOutcome,
  CallSessionWithContext,
  UserCallContext,
  GetCallHistoryOptions,
  CallHistoryResult,
  CallAnalytics,
  CallAnalyticsFilters,
  Callback,
  CreateCallbackRequest,
  GetCallbacksOptions,
  CallbacksResult,
  TwilioWebhookData,
  TwilioCallStatus,
  InitiateCallRequest,
  InitiateCallResponse,
  LiveCallStatus,
  CallError,
  CallOutcomeWithDetails,
  AgentCallStats,
  DailyCallMetrics
} from './types/call.types'

// Twilio Voice Service types
export type {
  TwilioVoiceConfig,
  CallStatus,
  OutgoingCallParams
} from './services/twilio-voice.service'

// Components (will be added later)
// export { CallInterface } from './components/CallInterface'
// export { CallControls } from './components/CallControls'
// export { CallTimer } from './components/CallTimer'
// export { OutcomeForm } from './components/OutcomeForm'
// export { CallHistory } from './components/CallHistory'

// Hooks
// export { useCallSession } from './hooks/useCallSession'
export { useTwilioVoice } from './hooks/useTwilioVoice'
export type { UseTwilioVoiceOptions, UseTwilioVoiceReturn } from './hooks/useTwilioVoice'
// export { useCallTimer } from './hooks/useCallTimer'
// export { useCallHistory } from './hooks/useCallHistory'

// Utils (will be added later)
// export { formatCallDuration } from './utils/call.utils'
// export { getOutcomeColor } from './utils/outcome.utils'
