// AI Voice Agent Service
// Core service for managing AI voice conversations

import { prisma } from '@/lib/db';
import { 
  VoiceAgentConfig, 
  VoiceConversation, 
  VoiceAgentOptions,
  ConversationOutcome,
  TwilioAIAssistantConfig,
  HumeEVIConfig 
} from '../types/ai-voice.types';

export class AIVoiceService {
  private config: VoiceAgentConfig;
  private conversations: Map<string, VoiceConversation> = new Map();

  constructor(config: VoiceAgentConfig) {
    this.config = config;
  }

  /**
   * Start a new voice conversation
   */
  async startConversation(options: {
    callSid: string;
    fromNumber: string;
    toNumber: string;
    userId?: number;
  }): Promise<VoiceConversation> {
    const conversation: VoiceConversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: options.callSid,
      callSid: options.callSid,
      userId: options.userId,
      agentConfig: this.config,
      startedAt: new Date(),
      status: 'active',
      transcript: [],
      metadata: {
        fromNumber: options.fromNumber,
        toNumber: options.toNumber,
        provider: this.config.provider
      }
    };

    // Store conversation in memory and database
    this.conversations.set(conversation.id, conversation);
    
    try {
      // Save to database for persistence
      await this.saveConversationToDB(conversation);
      
      console.log(`🤖 Started AI voice conversation: ${conversation.id} for call ${options.callSid}`);
      return conversation;
    } catch (error) {
      console.error('Failed to start conversation:', error);
      throw new Error('Failed to initialize voice conversation');
    }
  }

  /**
   * Generate TwiML for AI voice agent based on provider
   */
  generateTwiML(conversation: VoiceConversation, callerName?: string): string {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'https://rmcdialer.vercel.app';

    switch (this.config.provider) {
      case 'twilio-ai-assistants':
        return this.generateTwilioAIAssistantTwiML(conversation, baseUrl, callerName);
      
      case 'conversation-relay':
        return this.generateConversationRelayTwiML(conversation, baseUrl, callerName);
      
      case 'hume-evi':
        return this.generateHumeEVITwiML(conversation, callerName);
      
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Generate TwiML for Twilio AI Assistants
   */
  private generateTwilioAIAssistantTwiML(
    conversation: VoiceConversation, 
    baseUrl: string,
    callerName?: string
  ): string {
    const config = this.config as TwilioAIAssistantConfig;
    const greeting = callerName 
      ? `Hello ${callerName}! Welcome to R M C Dialler.`
      : `Hello! Welcome to R M C Dialler.`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">${greeting} Please hold while I connect you to our AI assistant.</Say>
    <Connect>
        <Assistant assistantSid="${config.assistantSid}">
            <Parameter name="conversationId" value="${conversation.id}" />
            <Parameter name="callSid" value="${conversation.callSid}" />
            ${conversation.userId ? `<Parameter name="userId" value="${conversation.userId}" />` : ''}
            ${callerName ? `<Parameter name="callerName" value="${callerName}" />` : ''}
        </Assistant>
    </Connect>
</Response>`;
  }

  /**
   * Generate TwiML for ConversationRelay
   */
  private generateConversationRelayTwiML(
    conversation: VoiceConversation,
    baseUrl: string,
    callerName?: string
  ): string {
    const greeting = callerName 
      ? `Hello ${callerName}! Welcome to R M C Dialler.`
      : `Hello! Welcome to R M C Dialler.`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">${greeting} Please hold while I connect you to our AI assistant.</Say>
    <Connect>
        <ConversationRelay url="wss://${baseUrl}/api/voice-agent/conversation-relay">
            <Parameter name="conversationId" value="${conversation.id}" />
            <Parameter name="callSid" value="${conversation.callSid}" />
            ${conversation.userId ? `<Parameter name="userId" value="${conversation.userId}" />` : ''}
            ${callerName ? `<Parameter name="callerName" value="${callerName}" />` : ''}
        </ConversationRelay>
    </Connect>
</Response>`;
  }

  /**
   * Generate TwiML for Hume EVI - Direct integration via Hume's Twilio endpoint
   */
  private generateHumeEVITwiML(
    conversation: VoiceConversation,
    callerName?: string
  ): string {
    const config = this.config as HumeEVIConfig;
    const humeWebhookUrl = `https://api.hume.ai/v0/evi/twilio?config_id=${config.configId}&api_key=${config.apiKey}`;
    
    // Hume handles the voice interaction directly, so we redirect the call to their endpoint
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Redirect>${humeWebhookUrl}</Redirect>
</Response>`;
  }

  /**
   * End a conversation with outcome
   */
  async endConversation(
    conversationId: string, 
    outcome: ConversationOutcome
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.status = 'completed';
    conversation.endedAt = new Date();
    conversation.outcome = outcome;

    // Update in database
    await this.updateConversationInDB(conversation);
    
    // Remove from memory after some time (cleanup)
    setTimeout(() => {
      this.conversations.delete(conversationId);
    }, 5 * 60 * 1000); // 5 minutes

    console.log(`🏁 Ended conversation ${conversationId} with outcome: ${outcome.type}`);
  }

  /**
   * Get conversation by ID
   */
  getConversation(conversationId: string): VoiceConversation | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Transfer conversation to human agent
   */
  async transferToHuman(
    conversationId: string, 
    reason: string
  ): Promise<{ success: boolean; agentId?: number }> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Find available human agent (reuse existing logic)
    const availableAgent = await prisma.agentSession.findFirst({
      where: {
        status: 'available',
        logoutAt: null,
        agent: {
          isActive: true
        }
      },
      include: {
        agent: true
      },
      orderBy: {
        lastActivity: 'asc'
      }
    });

    if (!availableAgent) {
      console.warn(`⚠️ No available agents for transfer from conversation ${conversationId}`);
      return { success: false };
    }

    // Update conversation status
    conversation.status = 'transferred';
    conversation.outcome = {
      type: 'transferred',
      reason,
      transferredTo: 'human-agent'
    };

    await this.updateConversationInDB(conversation);

    console.log(`📞 Transferred conversation ${conversationId} to agent ${availableAgent.agentId}`);
    
    return { success: true, agentId: availableAgent.agentId };
  }

  /**
   * Save conversation to database
   */
  private async saveConversationToDB(conversation: VoiceConversation): Promise<void> {
    // Since we avoid migrations, we'd extend the existing call_sessions table
    // or create a new voice_conversations table through a safe migration
    
    // For now, log to console and consider using call_sessions table
    console.log(`💾 Saving conversation to DB: ${conversation.id}`);
    
    // This would integrate with your existing call session tracking
    // Possibly extend the call_sessions table or create a junction table
  }

  /**
   * Update conversation in database
   */
  private async updateConversationInDB(conversation: VoiceConversation): Promise<void> {
    console.log(`💾 Updating conversation in DB: ${conversation.id}`);
    // Implementation would update the database record
  }

  /**
   * Get conversation analytics
   */
  async getAnalytics(conversationId: string) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    const duration = conversation.endedAt 
      ? conversation.endedAt.getTime() - conversation.startedAt.getTime()
      : Date.now() - conversation.startedAt.getTime();

    return {
      conversationId,
      totalDuration: duration,
      averageResponseTime: this.calculateAverageResponseTime(conversation),
      userSentiment: this.analyzeSentiment(conversation),
      intentsDetected: this.extractIntents(conversation),
      completionRate: conversation.outcome?.type === 'completed' ? 1 : 0,
      transferRate: conversation.outcome?.type === 'transferred' ? 1 : 0
    };
  }

  private calculateAverageResponseTime(conversation: VoiceConversation): number {
    // Calculate average response time from transcript
    return 2.5; // Placeholder
  }

  private analyzeSentiment(conversation: VoiceConversation): 'positive' | 'neutral' | 'negative' {
    // Analyze sentiment from conversation transcript
    return 'neutral'; // Placeholder
  }

  private extractIntents(conversation: VoiceConversation): string[] {
    // Extract detected intents from conversation
    return ['greeting', 'inquiry']; // Placeholder
  }
} 