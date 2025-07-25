// AI Voice Agent Types
// Core types for voice agent conversations and configuration

export interface VoiceAgentConfig {
  id: string;
  name: string;
  provider: 'twilio-ai-assistants' | 'conversation-relay' | 'gemini-live' | 'hume-evi';
  personality: {
    name: string;
    voice: string;
    tone: 'professional' | 'friendly' | 'casual';
    language: string;
  };
  capabilities: {
    canTransferToHuman: boolean;
    canAccessCustomerData: boolean;
    canScheduleAppointments: boolean;
    canProcessPayments: boolean;
  };
  fallbackBehavior: 'transfer' | 'escalate' | 'end-call';
}

export interface VoiceConversation {
  id: string;
  sessionId: string;
  callSid: string;
  userId?: number;
  agentConfig: VoiceAgentConfig;
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'completed' | 'transferred' | 'failed';
  transcript: ConversationTurn[];
  outcome?: ConversationOutcome;
  metadata: Record<string, any>;
}

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  speaker: 'user' | 'agent';
  content: string;
  audioUrl?: string;
  intent?: string;
  confidence?: number;
  duration?: number;
}

export interface ConversationOutcome {
  type: 'completed' | 'transferred' | 'escalated' | 'hung-up';
  reason?: string;
  transferredTo?: 'human-agent' | 'department';
  customerSatisfaction?: number;
  followUpRequired?: boolean;
}

export interface VoiceAgentAnalytics {
  conversationId: string;
  totalDuration: number;
  averageResponseTime: number;
  userSentiment: 'positive' | 'neutral' | 'negative';
  intentsDetected: string[];
  completionRate: number;
  transferRate: number;
}

export interface VoiceAgentOptions {
  config: VoiceAgentConfig;
  onConversationStart?: (conversation: VoiceConversation) => void;
  onConversationEnd?: (conversation: VoiceConversation) => void;
  onTransferRequired?: (reason: string) => void;
  onError?: (error: Error) => void;
}

// Provider-specific types
export interface TwilioAIAssistantConfig extends VoiceAgentConfig {
  assistantSid: string;
  knowledgeBaseSids?: string[];
  toolsSids?: string[];
}

export interface ConversationRelayConfig extends VoiceAgentConfig {
  webhookUrl: string;
  llmConfig: {
    provider: 'openai' | 'anthropic' | 'custom';
    model: string;
    systemPrompt: string;
  };
}

export interface GeminiLiveConfig extends VoiceAgentConfig {
  projectId: string;
  location: string;
  modelId: string;
  systemInstructions?: string;
}

export interface HumeEVIConfig extends VoiceAgentConfig {
  configId: string;
  apiKey: string;
} 