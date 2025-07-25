// AI Voice Agent Module Exports
// Services, types, and utilities for the new AI voice agent architecture (Twilio → Whisper → Hume)

// Core Services
export { AudioPipelineService } from './services/audio-pipeline.service';
export { WhisperService } from './services/whisper.service';
export { HumeTTSService } from './services/hume-tts.service';
export { ConversationEngineService } from './services/conversation-engine.service';
export { AudioStorageService } from './services/audio-storage.service';
export { AudioMemoryStorageService } from './services/audio-memory-storage.service';

// Legacy Service (for compatibility during migration)
export { AIVoiceService } from './services/ai-voice.service';

// New Architecture Types
export type {
  TwilioMediaStreamEvent,
  WhisperTranscriptionChunk,
  HumeTTSChunk,
  AudioStreamSession,
  ConversationTurn,
  FunctionCall,
  ConversationIntent,
  AudioPipelineConfig,
  AudioStreamError,
  BusinessFunction,
  FunctionContext
} from './types/audio-streaming.types';

// Legacy Types (for compatibility during migration)
export type {
  VoiceAgentConfig,
  VoiceConversation,
  ConversationOutcome,
  VoiceAgentAnalytics,
  VoiceAgentOptions,
  TwilioAIAssistantConfig,
  ConversationRelayConfig,
  GeminiLiveConfig,
  HumeEVIConfig
} from './types/ai-voice.types';

// Business Functions
export { businessFunctions } from './functions/business-functions';
export type { 
  callerLookupFunction,
  checkRequirementsFunction,
  transferToHumanFunction,
  scheduleAppointmentFunction,
  getHelpFunction
} from './functions/business-functions';

// Legacy Configuration (for compatibility during migration)
export { defaultHumeConfig } from './config/default-hume-config';

// Default Configuration for New Architecture
export const defaultAudioPipelineConfig = {
  whisper: {
    model: 'whisper-1' as const,
    language: 'en',
    responseFormat: 'verbose_json' as const
  },
  hume: {
    voiceId: 'd1248151-8613-41c1-b524-4ce242b02090',
    format: 'wav' as const,
    instantMode: true
  },
  conversation: {
    systemPrompt: `You are a professional and empathetic customer service representative for RMC Dialler, a claims management company. 

Your role is to:
1. Assist customers with their claims and requirements
2. Provide helpful information about their cases
3. Schedule appointments when needed
4. Escalate complex issues to human agents
5. Maintain a friendly, professional tone at all times

Guidelines:
- Be concise but thorough in your responses
- Always acknowledge the customer's concerns
- Use the available functions to look up specific information
- If you cannot help with something, offer to transfer to a human agent
- Keep responses under 50 words when possible for natural conversation flow
- Use empathetic language and show understanding

Remember: You are speaking, not writing, so use natural conversational language.`,
    maxTurns: 50,
    responseTimeout: 10000,
    silenceTimeout: 3000
  }
};

// Predefined Voice Configurations
export const voiceProfiles = {
  // Primary Voice (using specific voice ID)
  default: {
    voiceId: 'd1248151-8613-41c1-b524-4ce242b02090',
    format: 'wav' as const,
    instantMode: true
  },
  
  // Acting instructions for the primary voice (different emotional tones)
  calm: {
    voiceId: 'd1248151-8613-41c1-b524-4ce242b02090',
    voiceDescription: 'speaking in a calm, reassuring tone with deliberate pauses',
    format: 'wav' as const,
    instantMode: true
  },
  
  urgent: {
    voiceId: 'd1248151-8613-41c1-b524-4ce242b02090',
    voiceDescription: 'speaking with controlled urgency and slightly faster pace',
    format: 'wav' as const,
    instantMode: true
  },
  
  empathetic: {
    voiceId: 'd1248151-8613-41c1-b524-4ce242b02090',
    voiceDescription: 'speaking with extra warmth and empathy, very understanding tone',
    format: 'wav' as const,
    instantMode: true
  },
  
  // Alternative voices (using voice descriptions for variety)
  professionalBritish: {
    voiceDescription: 'A sophisticated British customer service representative with a warm, professional tone. Think BBC presenter meets friendly bank manager - articulate, empathetic, and naturally authoritative.',
    format: 'wav' as const,
    instantMode: true
  },
  
  friendlyAmerican: {
    voiceDescription: 'A warm, approachable American customer service representative with a slight Midwestern accent. Friendly but professional, like a helpful neighbor who works in customer care.',
    format: 'wav' as const,
    instantMode: true
  },
  
  // Specialized Voices
  claimsSpecialist: {
    voiceDescription: 'An experienced claims specialist with a calm, reassuring voice. Speaks with authority about insurance matters while maintaining warmth and empathy for difficult situations.',
    format: 'wav' as const,
    instantMode: true
  },
  
  // Different Emotional Tones
  urgentAssistant: {
    voiceDescription: 'A professional assistant speaking with controlled urgency. Clear, direct, and slightly faster pace while maintaining professionalism.',
    format: 'wav' as const,
    instantMode: true
  },
  
  calmingCounselor: {
    voiceDescription: 'A therapeutic, calming voice like a counselor. Speaks slowly with deliberate pauses, very soothing and empathetic tone.',
    format: 'wav' as const,
    instantMode: true
  }
};

// Components and Hooks (disabled for now)
// Note: React components have been removed as they are not needed for the core voice agent functionality
// export { VoiceAgentInterface } from './components/VoiceAgentInterface';
// export { ConversationViewer } from './components/ConversationViewer';
// export { VoiceAgentSettings } from './components/VoiceAgentSettings';
// export { useVoiceAgent } from './hooks/useVoiceAgent'; 