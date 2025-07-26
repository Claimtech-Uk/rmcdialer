// Twilio-EVI Bridge Service
// Bridges Twilio media streams with Hume EVI WebSocket connections

import { HumeEVIService, BusinessContext, EVIMessage } from './hume-evi.service';
import { EventEmitter } from 'events';

export interface TwilioMediaMessage {
  event: 'connected' | 'start' | 'media' | 'stop';
  sequenceNumber?: string;
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
}

export interface CallSession {
  callSid: string;
  streamSid: string;
  eviService: HumeEVIService;
  isActive: boolean;
  startTime: Date;
}

export class TwilioEVIBridge extends EventEmitter {
  private sessions: Map<string, CallSession> = new Map();
  private humeApiKey: string;

  constructor(humeApiKey: string) {
    super();
    this.humeApiKey = humeApiKey;
  }

  /**
   * Start a new EVI session for an incoming call
   */
  async startSession(
    callSid: string, 
    context: BusinessContext,
    ws: any // WebSocket connection from Twilio
  ): Promise<void> {
    try {
      console.log(`🚀 Starting EVI session for call ${callSid}`);

      // Create new EVI service instance
      const eviService = new HumeEVIService({ apiKey: this.humeApiKey });

      // Set up EVI event handlers
      this.setupEVIEventHandlers(eviService, ws, callSid);

      // Connect to EVI
      await eviService.connect(context);

      // Store session
      const session: CallSession = {
        callSid,
        streamSid: '', // Will be set when Twilio sends start event
        eviService,
        isActive: true,
        startTime: new Date()
      };

      this.sessions.set(callSid, session);

      console.log(`✅ EVI session started for call ${callSid}`);

    } catch (error) {
      console.error(`❌ Failed to start EVI session for call ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Handle incoming Twilio media messages
   */
  handleTwilioMessage(callSid: string, message: TwilioMediaMessage): void {
    const session = this.sessions.get(callSid);
    if (!session) {
      console.warn(`⚠️ No session found for call ${callSid}`);
      return;
    }

    try {
      switch (message.event) {
        case 'connected':
          console.log(`🔗 Twilio media stream connected for call ${callSid}`);
          break;

        case 'start':
          console.log(`▶️ Twilio media stream started for call ${callSid}`);
          if (message.start) {
            session.streamSid = message.start.streamSid;
            console.log(`📊 Media format: ${JSON.stringify(message.start.mediaFormat)}`);
          }
          break;

        case 'media':
          // Forward audio to EVI
          if (message.media && session.eviService.isConnectionActive()) {
            session.eviService.sendAudio(message.media.payload);
          }
          break;

        case 'stop':
          console.log(`⏹️ Twilio media stream stopped for call ${callSid}`);
          this.endSession(callSid);
          break;

        default:
          console.log(`📝 Unknown Twilio event: ${message.event}`);
      }

    } catch (error) {
      console.error(`❌ Error handling Twilio message for call ${callSid}:`, error);
    }
  }

  /**
   * Set up EVI event handlers to bridge back to Twilio
   */
  private setupEVIEventHandlers(eviService: HumeEVIService, twilioWs: any, callSid: string): void {
    
    eviService.on('connected', () => {
      console.log(`✅ EVI connected for call ${callSid}`);
    });

    eviService.on('audio_output', (message: EVIMessage) => {
      // Send EVI audio back to Twilio
      if (message.data && twilioWs.readyState === 1) { // WebSocket.OPEN
        const twilioMediaMessage = {
          event: 'media',
          streamSid: callSid, // Use callSid as streamSid for now
          media: {
            payload: message.data
          }
        };
        
        twilioWs.send(JSON.stringify(twilioMediaMessage));
        console.log(`🎵 Sent EVI audio to Twilio for call ${callSid}`);
      }
    });

    eviService.on('user_message', (message: EVIMessage) => {
      console.log(`👤 [${callSid}] User: ${message.message?.content}`);
      this.emit('user_message', { callSid, message });
    });

    eviService.on('assistant_message', (message: EVIMessage) => {
      console.log(`🤖 [${callSid}] Assistant: ${message.message?.content}`);
      this.emit('assistant_message', { callSid, message });
    });

    eviService.on('assistant_end', (message: EVIMessage) => {
      console.log(`✅ [${callSid}] Assistant finished`);
      this.emit('assistant_end', { callSid, message });
    });

    eviService.on('error', (error: any) => {
      console.error(`❌ EVI error for call ${callSid}:`, error);
      this.emit('error', { callSid, error });
    });

    eviService.on('disconnected', () => {
      console.log(`🔌 EVI disconnected for call ${callSid}`);
      this.endSession(callSid);
    });
  }

  /**
   * End EVI session
   */
  async endSession(callSid: string): Promise<void> {
    const session = this.sessions.get(callSid);
    if (!session) {
      return;
    }

    try {
      console.log(`🔚 Ending EVI session for call ${callSid}`);
      
      session.isActive = false;
      await session.eviService.disconnect();
      
      this.sessions.delete(callSid);
      
      const duration = Date.now() - session.startTime.getTime();
      console.log(`✅ EVI session ended for call ${callSid} (duration: ${Math.round(duration/1000)}s)`);
      
      this.emit('session_ended', { callSid, duration });

    } catch (error) {
      console.error(`❌ Error ending EVI session for call ${callSid}:`, error);
    }
  }

  /**
   * Get active session info
   */
  getSession(callSid: string): CallSession | undefined {
    return this.sessions.get(callSid);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): CallSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  /**
   * Get session statistics
   */
  getStats(): { activeSessions: number; totalSessions: number } {
    const activeSessions = this.getActiveSessions().length;
    const totalSessions = this.sessions.size;
    
    return { activeSessions, totalSessions };
  }
} 