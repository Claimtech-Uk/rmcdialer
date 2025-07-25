// Audio Streaming Types
// Types for Twilio Media Streams, Whisper transcription, and Hume TTS

export interface TwilioMediaStreamEvent {
  event: 'connected' | 'start' | 'media' | 'stop' | 'closed';
  sequenceNumber?: string;
  media?: {
    track: 'inbound' | 'outbound';
    chunk: string; // Base64 encoded audio
    timestamp: string;
    payload: string; // Base64 μ-law audio data
  };
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: 'audio/x-mulaw';
      sampleRate: number;
      channels: number;
    };
    customParameters: Record<string, string>;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
}

export interface WhisperTranscriptionChunk {
  text: string;
  confidence: number;
  timestamp: number;
  isPartial: boolean;
  speaker: 'caller' | 'agent';
}

export interface HumeTTSChunk {
  audio: string; // Base64 encoded audio
  generationId?: string;
  duration?: number;
  isComplete: boolean;
}

export interface AudioStreamSession {
  sessionId: string;
  callSid: string;
  streamSid: string;
  status: 'initializing' | 'active' | 'ended' | 'error';
  startedAt: Date;
  endedAt?: Date;
  
  // Audio processing state
  audioBuffer: Buffer[];
  lastTranscription?: WhisperTranscriptionChunk;
  conversationHistory: ConversationTurn[];
  
  // Caller context
  callerInfo?: {
    userId?: number;
    name?: string;
    phoneNumber: string;
    claims?: any[];
    requirements?: any[];
  };
}

export interface ConversationTurn {
  id: string;
  speaker: 'caller' | 'agent';
  text: string;
  timestamp: Date;
  confidence?: number;
  audioGenerationId?: string;
  
  // Business context
  functionCalls?: FunctionCall[];
  intent?: ConversationIntent;
}

export interface FunctionCall {
  name: string;
  parameters: Record<string, any>;
  result?: any;
  executedAt: Date;
  success: boolean;
  error?: string;
}

export interface ConversationIntent {
  category: 'greeting' | 'claim_inquiry' | 'scheduling' | 'complaint' | 'transfer' | 'goodbye' | 'other';
  confidence: number;
  requiresAction: boolean;
  suggestedActions?: string[];
}

// Configuration types
export interface AudioPipelineConfig {
  whisper: {
    model: 'whisper-1';
    language?: string;
    temperature?: number;
    responseFormat: 'json' | 'text' | 'verbose_json';
  };
  hume: {
    voiceId?: string;
    voiceDescription?: string;
    speed?: number;
    format: 'mp3' | 'wav' | 'pcm';
    instantMode: boolean;
  };
  conversation: {
    systemPrompt: string;
    maxTurns: number;
    responseTimeout: number; // milliseconds
    silenceTimeout: number; // milliseconds
  };
}

// Error types
export interface AudioStreamError {
  type: 'whisper_error' | 'hume_error' | 'twilio_error' | 'conversation_error' | 'function_error';
  message: string;
  details?: any;
  timestamp: Date;
  sessionId: string;
  recoverable: boolean;
}

// Function registry types
export interface BusinessFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required: string[];
  };
  handler: (params: Record<string, any>, context: FunctionContext) => Promise<any>;
}

export interface FunctionContext {
  sessionId: string;
  callSid: string;
  callerInfo?: AudioStreamSession['callerInfo'];
  conversationHistory: ConversationTurn[];
} 