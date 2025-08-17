// Transcription Module - Call Recording Transcription with OpenAI Whisper
// This module handles audio transcription, AI summary generation, and transcript management

// Services (main business logic)
export { transcriptionService, TranscriptionService } from './services/transcription.service'

// Types (for other modules and tRPC)
export type {
  TranscriptStatus,
  TranscriptionResult,
  TranscriptionTriggerRequest,
  TranscriptionTriggerResponse,
  TranscriptionStatusRequest,
  TranscriptionStatusResponse,
  TranscriptionDownloadRequest,
  AudioProcessingOptions,
  WhisperTranscriptionOptions,
  WhisperTranscriptionResult,
  SummaryGenerationOptions,
  SummaryGenerationResult,
  TranscriptionError,
  TranscriptionButtonProps,
  TranscriptionDisplayProps,
  UseTranscriptionOptions,
  UseTranscriptionReturn,
  TranscriptionConfig,
  TranscriptionAnalytics,
  CallHistoryEntryWithTranscription
} from './types/transcription.types'

// Components (UI components)
export { TranscriptionButton, TranscriptDisplay } from './components/TranscriptionButton'

// Hooks (React state management)
export { useTranscription } from './hooks/useTranscription'

// Utils (helper functions)
// export { formatTranscriptTime, parseTranscriptSegments } from './utils/transcript.utils'
