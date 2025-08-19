// Ultra-lightweight types for client-side transcription
// No server dependencies - only what the UI needs

export type TranscriptStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed'

export interface TranscriptionButtonProps {
  callId: string
  disabled?: boolean
  size?: 'sm' | 'md'
  showText?: boolean
  onStatusChange?: (status: TranscriptStatus) => void
}

export interface TranscriptionState {
  status: TranscriptStatus
  progress?: number
  error?: string
  downloadUrl?: string
}

export interface QueueResponse {
  success: boolean
  message: string
  jobId?: string
}

export interface StatusResponse {
  status: TranscriptStatus
  progress?: number
  downloadUrl?: string
  error?: string
}
