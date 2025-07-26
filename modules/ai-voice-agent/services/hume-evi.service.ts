// Hume EVI (Empathic Voice Interface) Service
// Handles real-time voice conversations using Hume's EVI WebSocket API

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface EVIConfig {
  apiKey: string;
  voice?: {
    name?: string;
    description?: string;
  };
  systemPrompt?: string;
  maxDuration?: number;
  inactivityTimeout?: number;
}

export interface EVIMessage {
  type: 'user_message' | 'assistant_message' | 'audio_output' | 'assistant_end' | 'error';
  message?: {
    role: 'user' | 'assistant';
    content: string;
  };
  data?: string; // base64 audio data
  timestamp: number;
}

export interface BusinessContext {
  callSid: string;
  userId?: number;
  callerName?: string;
  callerPhone: string;
  claimsCount?: number;
  priorityScore?: number;
}

export class HumeEVIService extends EventEmitter {
  private apiKey: string;
  private ws: WebSocket | null = null;
  private configId: string | null = null;
  private isConnected = false;
  private businessContext: BusinessContext | null = null;

  constructor(config: EVIConfig) {
    super();
    this.apiKey = config.apiKey;
  }

  /**
   * Create EVI configuration for the conversation
   */
  async createConfiguration(context: BusinessContext): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      
      const configData = {
        name: `RMC-Call-${context.callSid}`,
        description: "RMC Dialler customer service AI agent",
        prompt: {
          text: systemPrompt
        },
        voice: {
          provider: "HUME_AI",
          name: "British Customer Service Representative"
        },
        language_model: {
          model_provider: "OPEN_AI",
          model_resource: "gpt-4",
          temperature: 0.7
        },
        max_duration: 1800, // 30 minutes
        inactivity_timeout: 120 // 2 minutes
      };

      console.log('🔧 Creating EVI configuration...');
      
      const response = await fetch('https://api.hume.ai/v0/evi/configs', {
        method: 'POST',
        headers: {
          'X-HUME-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create EVI config: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      this.configId = result.id;
      
      console.log(`✅ EVI configuration created: ${this.configId}`);
      return result.id;

    } catch (error) {
      console.error('❌ Failed to create EVI configuration:', error);
      throw error;
    }
  }

  /**
   * Build system prompt with business context
   */
  private buildSystemPrompt(context: BusinessContext): string {
    const basePrompt = `You are a professional, empathetic customer service AI for RMC Dialler, a claims management company. You help customers with their insurance claims and queries.

Key guidelines:
- Be warm, professional, and empathetic
- Listen carefully to understand the customer's needs
- Ask clarifying questions when needed
- Provide helpful information about claims processes
- If you need to transfer to a human agent, explain why
- Keep responses concise but thorough`;

    let contextualPrompt = basePrompt;

    if (context.callerName) {
      contextualPrompt += `\n\nCaller Information:
- Name: ${context.callerName}
- Phone: ${context.callerPhone}`;
    }

    if (context.claimsCount) {
      contextualPrompt += `\n- Active Claims: ${context.claimsCount}`;
    }

    if (context.priorityScore) {
      contextualPrompt += `\n- Priority Score: ${context.priorityScore}/100`;
    }

    contextualPrompt += `\n\nStart the conversation with a personalized greeting using their name if available.`;

    return contextualPrompt;
  }

  /**
   * Connect to EVI WebSocket
   */
  async connect(context: BusinessContext): Promise<void> {
    try {
      this.businessContext = context;
      
      // Create configuration first
      const configId = await this.createConfiguration(context);
      
      // Connect to EVI WebSocket
      const wsUrl = `wss://api.hume.ai/v0/evi/chat?api_key=${this.apiKey}&config_id=${configId}`;
      
      console.log('🔗 Connecting to Hume EVI...');
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('✅ Connected to Hume EVI');
        this.isConnected = true;
        this.emit('connected');
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleEVIMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse EVI message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('🔌 EVI connection closed');
        this.isConnected = false;
        this.emit('disconnected');
      });

      this.ws.on('error', (error) => {
        console.error('❌ EVI WebSocket error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('❌ Failed to connect to EVI:', error);
      throw error;
    }
  }

  /**
   * Handle incoming EVI messages
   */
  private handleEVIMessage(message: any): void {
    const eviMessage: EVIMessage = {
      type: message.type,
      message: message.message,
      data: message.data,
      timestamp: Date.now()
    };

    console.log(`📨 EVI message: ${message.type}`);
    
    switch (message.type) {
      case 'user_message':
        console.log(`👤 User said: ${message.message?.content}`);
        this.emit('user_message', eviMessage);
        break;
        
      case 'assistant_message':
        console.log(`🤖 Assistant responding: ${message.message?.content}`);
        this.emit('assistant_message', eviMessage);
        break;
        
      case 'audio_output':
        console.log(`🎵 Audio output received (${message.data?.length || 0} bytes)`);
        this.emit('audio_output', eviMessage);
        break;
        
      case 'assistant_end':
        console.log('✅ Assistant finished speaking');
        this.emit('assistant_end', eviMessage);
        break;
        
      default:
        console.log(`📝 Unknown EVI message type: ${message.type}`);
        this.emit('message', eviMessage);
    }
  }

  /**
   * Send audio input to EVI
   */
  sendAudio(audioData: string): void {
    if (!this.isConnected || !this.ws) {
      console.warn('⚠️ Cannot send audio: not connected to EVI');
      return;
    }

    const message = {
      type: 'audio_input',
      data: audioData
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Disconnect from EVI
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    
    // Clean up configuration if needed
    if (this.configId) {
      try {
        await this.cleanupConfiguration(this.configId);
      } catch (error) {
        console.warn('⚠️ Failed to cleanup EVI configuration:', error);
      }
    }
  }

  /**
   * Clean up EVI configuration after call
   */
  private async cleanupConfiguration(configId: string): Promise<void> {
    try {
      await fetch(`https://api.hume.ai/v0/evi/configs/${configId}`, {
        method: 'DELETE',
        headers: {
          'X-HUME-API-KEY': this.apiKey
        }
      });
      console.log(`🗑️ Cleaned up EVI configuration: ${configId}`);
    } catch (error) {
      console.error('❌ Failed to cleanup EVI configuration:', error);
    }
  }

  /**
   * Check if connected
   */
  isConnectionActive(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
} 