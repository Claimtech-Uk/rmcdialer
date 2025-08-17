// Transcription Module Types
// Call transcription using OpenAI Whisper, status tracking, and summary generation

// Core transcription types matching database schema
export type TranscriptStatus = 'pending' | 'processing' | 'completed' | 'failed' | null;

export interface TranscriptionResult {
  id: string;
  callSessionId: string;
  status: TranscriptStatus;
  transcriptText?: string;
  transcriptSummary?: string;
  transcriptUrl?: string;
  processingStartedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
  audioUrl?: string;
  audioDurationSeconds?: number;
  wordCount?: number;
  confidence?: number; // OpenAI Whisper confidence score
  language?: string; // Detected language
  createdAt: Date;
  updatedAt: Date;
}

// Request/Response types for API operations
export interface TranscriptionTriggerRequest {
  callSessionId: string;
  forceRetranscribe?: boolean; // Allow re-transcription of completed calls
}

export interface TranscriptionTriggerResponse {
  success: boolean;
  callSessionId: string;
  status: TranscriptStatus;
  message: string;
  estimatedWaitTimeSeconds?: number;
}

export interface TranscriptionStatusRequest {
  callSessionId: string;
}

export interface TranscriptionStatusResponse {
  callSessionId: string;
  status: TranscriptStatus;
  transcriptText?: string;
  transcriptSummary?: string;
  transcriptUrl?: string;
  progress?: number; // 0-100 percentage
  failureReason?: string;
  completedAt?: Date;
  wordCount?: number;
  confidence?: number;
  language?: string;
}

export interface TranscriptionDownloadRequest {
  callSessionId: string;
  format?: 'txt' | 'json' | 'srt'; // Different export formats
}

// Service operation types
export interface AudioProcessingOptions {
  callSessionId: string;
  audioUrl: string;
  maxDurationMinutes?: number; // Safety limit
  enhanceAudio?: boolean; // Future: audio enhancement
}

export interface WhisperTranscriptionOptions {
  audioBuffer: ArrayBuffer;
  language?: string; // 'en', 'auto-detect', etc.
  prompt?: string; // Context prompt for better accuracy
  temperature?: number; // 0-1, creativity vs accuracy
  model?: 'whisper-1'; // OpenAI model version
}

export interface WhisperTranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  confidence?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
}

// Summary generation types
export interface SummaryGenerationOptions {
  transcriptText: string;
  callContext?: {
    agentName?: string;
    customerName?: string;
    callDirection: 'inbound' | 'outbound';
    callDurationSeconds?: number;
    callOutcome?: string;
  };
  summaryStyle?: 'brief' | 'detailed' | 'action_items' | 'key_quotes';
}

export interface SummaryGenerationResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  topics: string[];
  confidence: number;
}

// Error types for better error handling
export interface TranscriptionError {
  code: 'AUDIO_NOT_FOUND' | 'AUDIO_TOO_LONG' | 'AUDIO_FORMAT_UNSUPPORTED' | 
        'WHISPER_API_ERROR' | 'PROCESSING_TIMEOUT' | 'INSUFFICIENT_CREDITS' |
        'CALL_SESSION_NOT_FOUND' | 'ALREADY_PROCESSING' | 'NETWORK_ERROR';
  message: string;
  details?: any;
  retryable: boolean;
}

// UI component types
export interface TranscriptionButtonProps {
  callSessionId: string;
  currentStatus?: TranscriptStatus;
  onStatusChange?: (status: TranscriptStatus) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export interface TranscriptionDisplayProps {
  transcriptionResult: TranscriptionResult;
  onDownload?: (format: 'txt' | 'json' | 'srt') => void;
  onRetranscribe?: () => void;
  showSummary?: boolean;
  showSegments?: boolean;
}

// Hook types for React state management
export interface UseTranscriptionOptions {
  callSessionId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  // When true, performs one initial status fetch on mount.
  // Defaults to false to avoid unnecessary requests on large tables.
  initialFetch?: boolean;
  onStatusChange?: (status: TranscriptStatus) => void;
  onComplete?: (result: TranscriptionResult) => void;
  onError?: (error: TranscriptionError) => void;
}

export interface UseTranscriptionReturn {
  // Current state
  status: TranscriptStatus;
  transcriptionResult?: TranscriptionResult;
  isLoading: boolean;
  error?: TranscriptionError;
  progress?: number;
  
  // Actions
  triggerTranscription: (forceRetranscribe?: boolean) => Promise<void>;
  refreshStatus: () => Promise<void>;
  downloadTranscript: (format?: 'txt' | 'json' | 'srt') => Promise<void>;
  clearError: () => void;
  
  // State checks
  canTrigger: boolean;
  isProcessing: boolean;
  isCompleted: boolean;
  hasFailed: boolean;
}

// Configuration types
export interface TranscriptionConfig {
  maxAudioDurationMinutes: number;
  supportedAudioFormats: string[];
  defaultLanguage: string;
  autoSummaryEnabled: boolean;
  cooldownSeconds: number;
  maxRetries: number;
  apiTimeoutSeconds: number;
}

// Analytics and reporting types
export interface TranscriptionAnalytics {
  totalTranscriptions: number;
  successfulTranscriptions: number;
  failedTranscriptions: number;
  averageProcessingTimeSeconds: number;
  totalAudioMinutesProcessed: number;
  popularLanguages: Array<{
    language: string;
    count: number;
  }>;
  errorBreakdown: Array<{
    errorCode: string;
    count: number;
  }>;
}

// Extended call history entry with transcription data
export interface CallHistoryEntryWithTranscription {
  id: string;
  transcriptStatus?: TranscriptStatus;
  transcriptText?: string;
  transcriptSummary?: string;
  transcriptUrl?: string;
  hasTranscription: boolean;
}
