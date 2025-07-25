// Audio Pipeline Service
// Orchestrates the complete Twilio → Whisper → Conversation → Hume → Twilio flow

import { WebSocket } from 'ws';
import { WhisperService } from './whisper.service';
import { HumeTTSService } from './hume-tts.service';
import { ConversationEngineService } from './conversation-engine.service';
import { 
  TwilioMediaStreamEvent, 
  AudioStreamSession, 
  WhisperTranscriptionChunk,
  ConversationTurn,
  AudioStreamError,
  AudioPipelineConfig
} from '../types/audio-streaming.types';

export class AudioPipelineService {
  private sessions: Map<string, AudioStreamSession> = new Map();
  private whisperService: WhisperService;
  private humeService: HumeTTSService;
  private conversationEngine: ConversationEngineService;
  private config: AudioPipelineConfig;

  constructor(
    openaiApiKey: string,
    humeApiKey: string,
    config?: Partial<AudioPipelineConfig>
  ) {
    this.whisperService = new WhisperService(openaiApiKey);
    this.humeService = new HumeTTSService(humeApiKey, config?.hume);
    this.conversationEngine = new ConversationEngineService(openaiApiKey, config?.conversation?.systemPrompt);
    
    this.config = {
      whisper: {
        model: 'whisper-1',
        language: 'en',
        responseFormat: 'verbose_json',
        ...config?.whisper
      },
      hume: {
        voiceDescription: 'A professional, friendly, and empathetic customer service representative',
        format: 'wav',
        instantMode: true,
        ...config?.hume
      },
      conversation: {
        systemPrompt: '',
        maxTurns: 50,
        responseTimeout: 10000,
        silenceTimeout: 3000,
        ...config?.conversation
      }
    };
  }

  /**
   * Handle new WebSocket connection from Twilio
   */
  async handleTwilioConnection(ws: WebSocket, callSid: string, callerInfo?: any): Promise<void> {
    console.log(`🔗 New Twilio WebSocket connection for call: ${callSid}`);

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create new session
    const session: AudioStreamSession = {
      sessionId,
      callSid,
      streamSid: '', // Will be set when stream starts
      status: 'initializing',
      startedAt: new Date(),
      audioBuffer: [],
      conversationHistory: [],
      callerInfo
    };

    this.sessions.set(sessionId, session);

    // Set up WebSocket event handlers
    ws.on('message', async (data) => {
      try {
        await this.handleTwilioMessage(ws, sessionId, data);
      } catch (error) {
        console.error(`❌ Error handling Twilio message for session ${sessionId}:`, error);
        await this.handleError(ws, sessionId, error as AudioStreamError);
      }
    });

    ws.on('close', () => {
      console.log(`🔌 WebSocket closed for session: ${sessionId}`);
      this.endSession(sessionId);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for session ${sessionId}:`, error);
      this.handleError(ws, sessionId, {
        type: 'twilio_error',
        message: 'WebSocket connection error',
        details: error,
        timestamp: new Date(),
        sessionId,
        recoverable: false
      });
    });

    // Send initial connection acknowledgment
    this.sendTwilioMessage(ws, { event: 'connected', protocol: 'Call' });
  }

  /**
   * Handle individual message from Twilio Media Stream
   */
  private async handleTwilioMessage(ws: WebSocket, sessionId: string, data: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      return;
    }

    let event: TwilioMediaStreamEvent;
    try {
      event = JSON.parse(data.toString());
    } catch (error) {
      console.error(`❌ Failed to parse Twilio message:`, error);
      return;
    }

    switch (event.event) {
      case 'start':
        await this.handleStreamStart(ws, sessionId, event);
        break;
      
      case 'media':
        await this.handleMediaChunk(ws, sessionId, event);
        break;
      
      case 'stop':
        await this.handleStreamStop(ws, sessionId, event);
        break;
      
      default:
        console.log(`📝 Unhandled Twilio event: ${event.event}`);
    }
  }

  /**
   * Handle stream start event
   */
  private async handleStreamStart(ws: WebSocket, sessionId: string, event: TwilioMediaStreamEvent): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !event.start) return;

    console.log(`🎬 Stream started for session: ${sessionId}`);
    
    session.streamSid = event.start.streamSid;
    session.status = 'active';
    
    // Send initial greeting
    await this.generateAndSendResponse(ws, sessionId, "Hello! I'm here to help you with your claims and any questions you might have. How can I assist you today?");
  }

  /**
   * Handle incoming audio chunk
   */
  private async handleMediaChunk(ws: WebSocket, sessionId: string, event: TwilioMediaStreamEvent): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !event.media) return;

    // Convert base64 audio to buffer
    const audioChunk = Buffer.from(event.media.payload, 'base64');
    
    // Add to Whisper for transcription
    this.whisperService.addAudioChunk(audioChunk, 'caller');
    
    // Check for transcription results
    try {
      const transcription = await this.whisperService.flushBuffer('caller');
      if (transcription && transcription.text.trim().length > 3) {
        await this.processTranscription(ws, sessionId, transcription);
      }
    } catch (error) {
      // Transcription errors are logged but don't stop the pipeline
      console.warn(`⚠️ Transcription error for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle stream stop event
   */
  private async handleStreamStop(ws: WebSocket, sessionId: string, event: TwilioMediaStreamEvent): Promise<void> {
    console.log(`🛑 Stream stopped for session: ${sessionId}`);
    
    // Process any remaining audio
    try {
      const finalTranscription = await this.whisperService.flushBuffer('caller');
      if (finalTranscription && finalTranscription.text.trim().length > 3) {
        await this.processTranscription(ws, sessionId, finalTranscription);
      }
    } catch (error) {
      console.warn(`⚠️ Final transcription error:`, error);
    }
    
    this.endSession(sessionId);
  }

  /**
   * Process transcription and generate response
   */
  private async processTranscription(ws: WebSocket, sessionId: string, transcription: WhisperTranscriptionChunk): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`🎤 Transcribed: "${transcription.text}"`);

    // Add user turn to conversation history
    const userTurn: ConversationTurn = {
      id: `turn_${Date.now()}`,
      speaker: 'caller',
      text: transcription.text,
      timestamp: new Date(),
      confidence: transcription.confidence
    };
    
    session.conversationHistory.push(userTurn);

    try {
      // Process through conversation engine
      const { response, functionCalls, intent } = await this.conversationEngine.processMessage(
        transcription.text,
        session
      );

      // Add assistant turn to conversation history
      const assistantTurn: ConversationTurn = {
        id: `turn_${Date.now()}_assistant`,
        speaker: 'agent',
        text: response,
        timestamp: new Date(),
        functionCalls,
        intent
      };
      
      session.conversationHistory.push(assistantTurn);

      // Generate and send audio response
      await this.generateAndSendResponse(ws, sessionId, response);

    } catch (error) {
      console.error(`❌ Error processing transcription:`, error);
      await this.generateAndSendResponse(
        ws, 
        sessionId, 
        "I'm sorry, I'm having trouble processing that. Could you please repeat your question?"
      );
    }
  }

  /**
   * Generate TTS and send audio back to Twilio
   */
  private async generateAndSendResponse(ws: WebSocket, sessionId: string, text: string): Promise<void> {
    try {
      console.log(`🗣️ Generating response: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      
      // Generate speech with Hume
      const ttsChunk = await this.humeService.synthesizeText(text);
      
      // Convert to Twilio format
      const twilioAudio = this.humeService.convertForTwilio(ttsChunk.audio);
      
      // Send audio to Twilio
      const mediaMessage = {
        event: 'media',
        streamSid: this.sessions.get(sessionId)?.streamSid,
        media: {
          payload: twilioAudio.toString('base64')
        }
      };
      
      this.sendTwilioMessage(ws, mediaMessage);
      
      console.log(`✅ Sent audio response for session: ${sessionId}`);

    } catch (error) {
      console.error(`❌ Error generating TTS response:`, error);
      
      // Send fallback message
      const fallbackMessage = {
        event: 'media',
        streamSid: this.sessions.get(sessionId)?.streamSid,
        media: {
          payload: Buffer.from('Audio generation failed').toString('base64')
        }
      };
      
      this.sendTwilioMessage(ws, fallbackMessage);
    }
  }

  /**
   * Send message to Twilio WebSocket
   */
  private sendTwilioMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Handle errors in the pipeline
   */
  private async handleError(ws: WebSocket, sessionId: string, error: AudioStreamError): Promise<void> {
    console.error(`❌ Pipeline error for session ${sessionId}:`, error);
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'error';
    }

    if (error.recoverable) {
      // Try to send an error message to the user
      await this.generateAndSendResponse(
        ws,
        sessionId,
        "I'm sorry, I'm experiencing some technical difficulties. Please hold on while I try to resolve this."
      );
    } else {
      // Non-recoverable error - end the session
      this.endSession(sessionId);
      ws.close();
    }
  }

  /**
   * End a session and cleanup resources
   */
  private endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      session.endedAt = new Date();
      
      // Clear Whisper buffer for this session
      this.whisperService.clearBuffer();
      
      // Log session summary
      console.log(`📊 Session ${sessionId} ended:`, {
        duration: session.endedAt.getTime() - session.startedAt.getTime(),
        turns: session.conversationHistory.length,
        callerName: session.callerInfo?.name || 'Unknown'
      });
    }
    
    this.sessions.delete(sessionId);
  }

  /**
   * Register business functions with the conversation engine
   */
  registerBusinessFunctions(functions: any[]): void {
    this.conversationEngine.registerFunctions(functions);
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): AudioStreamSession[] {
    return Array.from(this.sessions.values()).filter(session => 
      session.status === 'active' || session.status === 'initializing'
    );
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): AudioStreamSession | undefined {
    return this.sessions.get(sessionId);
  }
} 