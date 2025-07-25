// Call Outcomes Module - Call Disposition Management & Outcome Processing
// This module handles call outcome selection, processing, and follow-up actions

// Services (main business logic)
export { CallOutcomeManager } from './services/call-outcome-manager.service'
export { CompletedFormOutcome } from './services/completed-form.outcome'
export { GoingToCompleteOutcome } from './services/going-to-complete.outcome'
export { MightCompleteOutcome } from './services/might-complete.outcome'
export { CallBackOutcome } from './services/call-back.outcome'
export { NoAnswerOutcome } from './services/no-answer.outcome'
export { HungUpOutcome } from './services/hung-up.outcome'
export { BadNumberOutcome } from './services/bad-number.outcome'
export { NoClaimOutcome } from './services/no-claim.outcome'
export { NotInterestedOutcome } from './services/not-interested.outcome'

// Types
export type {
  CallOutcomeType,
  CallOutcomeHandler,
  CallOutcomeContext,
  CallOutcomeResult,
  CallOutcomeValidation,
  NextActionType,
  NextAction,
  OutcomeProcessingOptions
} from './types/call-outcome.types'

// Components
export { OutcomeSelectionModal } from './components/OutcomeSelectionModal'
export { OutcomeConfirmationDialog } from './components/OutcomeConfirmationDialog'
export { NextActionsPanel } from './components/NextActionsPanel'

// Hooks
export { useCallOutcomes } from './hooks/useCallOutcomes'
export { useOutcomeValidation } from './hooks/useOutcomeValidation'
export { useNextActions } from './hooks/useNextActions'

// Utils
export { getOutcomeHandler, validateOutcomeData, formatOutcomeDisplay } from './utils' 