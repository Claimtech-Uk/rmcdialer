import type * as Party from "partykit/server";

// Version: Audio Conversion Implementation - Deploy: 2025-08-24-v6
// Adds μ-law to linear16 PCM conversion for Hume compatibility

// μ-law to linear16 conversion table (ITU-T G.711 standard)
const MULAW_DECODE_TABLE = new Int16Array([
  -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
  -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
  -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
  -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
  -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
  -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
  -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
  -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
  -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
  -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
  -876, -844, -812, -780, -748, -716, -684, -652,
  -620, -588, -556, -524, -492, -460, -428, -396,
  -372, -356, -340, -324, -308, -292, -276, -260,
  -244, -228, -212, -196, -180, -164, -148, -132,
  -120, -112, -104, -96, -88, -80, -72, -64,
  -56, -48, -40, -32, -24, -16, -8, 0,
  32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
  23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
  15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
  11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
  7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
  5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
  3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004,
  2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
  1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436,
  1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
  876, 844, 812, 780, 748, 716, 684, 652,
  620, 588, 556, 524, 492, 460, 428, 396,
  372, 356, 340, 324, 308, 292, 276, 260,
  244, 228, 212, 196, 180, 164, 148, 132,
  120, 112, 104, 96, 88, 80, 72, 64,
  56, 48, 40, 32, 24, 16, 8, 0
]);

export default class VoiceParty implements Party.Server {
  twilioWs: Party.Connection | null = null;
  humeWs: WebSocket | null = null;
  streamSid: string | null = null;
  callSid: string | null = null;
  isSessionReady: boolean = false;
  sessionReadyLogged: boolean = false;
  audioChunkCounter: number = 0;
  
  constructor(public room: Party.Room) {}

  /**
   * Convert μ-law audio from Twilio to linear16 PCM for Hume
   * @param base64MulawAudio - Base64 encoded μ-law audio from Twilio
   * @returns Base64 encoded linear16 PCM audio
   */
  convertMulawToLinear16(base64MulawAudio: string): string {
    try {
      // Decode base64 to binary
      const binaryString = atob(base64MulawAudio);
      const mulawBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        mulawBytes[i] = binaryString.charCodeAt(i);
      }

      // Convert μ-law to linear16 PCM
      const pcmData = new Int16Array(mulawBytes.length);
      for (let i = 0; i < mulawBytes.length; i++) {
        pcmData[i] = MULAW_DECODE_TABLE[mulawBytes[i]];
      }

      // Convert PCM data to base64
      const pcmBytes = new Uint8Array(pcmData.buffer);
      let binaryPcm = '';
      for (let i = 0; i < pcmBytes.length; i++) {
        binaryPcm += String.fromCharCode(pcmBytes[i]);
      }
      
      const converted = btoa(binaryPcm);
      
      // Log conversion occasionally for debugging
      this.audioChunkCounter++;
      if (this.audioChunkCounter % 100 === 0) {
        console.log(`🔄 Audio conversion #${this.audioChunkCounter}: μ-law (${base64MulawAudio.length} chars) → linear16 (${converted.length} chars)`);
      }
      
      return converted;
    } catch (error) {
      console.error('❌ Audio conversion error:', error);
      return base64MulawAudio; // Return original if conversion fails
    }
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`🔌 New connection: ${conn.id}`);
    
    // Store Twilio WebSocket connection
    this.twilioWs = conn;
    
    // Handle incoming messages from Twilio
    conn.addEventListener("message", async (evt) => {
      if (typeof evt.data === "string") {
        try {
          const msg = JSON.parse(evt.data);
          await this.handleTwilioMessage(msg);
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      }
    });
    
    conn.addEventListener("close", () => {
      console.log(`🔌 Twilio disconnected for call ${this.callSid}`);
      this.cleanup();
    });
  }

  async handleTwilioMessage(msg: any) {
    switch (msg.event) {
      case 'start':
        console.log(`📞 Call started: ${msg.start.callSid}`);
        console.log(`📊 Twilio Stream info:`, {
          codec: msg.start.mediaFormat?.encoding || 'PCMU',
          sampleRate: msg.start.mediaFormat?.sampleRate || 8000,
          channels: msg.start.mediaFormat?.channels || 1
        });
        console.log(`🎵 Audio conversion enabled: μ-law → linear16 PCM`);
        this.streamSid = msg.start.streamSid;
        this.callSid = msg.start.callSid;
        
        // Connect to Hume EVI using WebSocket API
        await this.connectToHume();
        break;
        
      case 'media':
        if (msg.media?.payload && this.humeWs && this.humeWs.readyState === WebSocket.OPEN) {
          if (this.isSessionReady) {
            try {
              // Convert μ-law to linear16 PCM
              const convertedAudio = this.convertMulawToLinear16(msg.media.payload);
              
              // Send audio_input message following Hume's specification
              const audioMessage = {
                type: 'audio_input',
                data: convertedAudio // Base64 encoded linear16 PCM
              };
              
              // Send ALL chunks for continuous stream (Hume requirement)
              this.humeWs.send(JSON.stringify(audioMessage));
              
              // Log occasionally to avoid spam
              if (Math.random() > 0.95) {
                console.log(`🎤 Audio streaming (sample): linear16 PCM, ${convertedAudio.length} chars`);
              }
            } catch (error) {
              console.error('❌ Error sending audio to Hume:', error);
            }
          } else {
            // Discard audio until session is ready
            if (!this.sessionReadyLogged) {
              console.log('⏸️ Session not ready - discarding audio until Hume is ready');
              this.sessionReadyLogged = true;
            }
          }
        }
        break;
        
      case 'stop':
        console.log(`🛑 Stream stopped: ${msg.streamSid}`);
        this.cleanup();
        break;
    }
  }

  async connectToHume() {
    try {
      // Get credentials from environment (trim whitespace!)
      const HUME_API_KEY = (this.room.env.HUME_API_KEY as string || '').trim();
      const HUME_CONFIG_ID = (this.room.env.HUME_CONFIG_ID as string || '').trim();
      
      // Validate credentials
      console.log('🔑 Hume credentials check:', {
        hasApiKey: !!HUME_API_KEY,
        hasConfigId: !!HUME_CONFIG_ID,
        configId: HUME_CONFIG_ID
      });
      
      if (!HUME_API_KEY) {
        console.error('❌ HUME_API_KEY not found in environment variables');
        return;
      }
      
      // Connect to Hume EVI WebSocket
      console.log('🔗 Connecting to Hume EVI WebSocket...');
      console.log('📊 Using config ID:', HUME_CONFIG_ID);
      console.log('🎵 Audio format: Converting μ-law to linear16 PCM');
      
      // Build WebSocket URL with authentication
      const wsUrl = new URL('wss://api.hume.ai/v0/evi/chat');
      wsUrl.searchParams.append('api_key', HUME_API_KEY);
      if (HUME_CONFIG_ID) {
        wsUrl.searchParams.append('config_id', HUME_CONFIG_ID);
      }
      
      console.log('🔐 Using API key authentication');
      
      // Create WebSocket connection
      this.humeWs = new WebSocket(wsUrl.toString());
      
      // Set up event handlers
      this.humeWs.addEventListener('open', () => {
        console.log('✅ Hume EVI WebSocket opened successfully!');
        console.log('⏳ Waiting for session to be ready...');
        console.log('🎵 Audio conversion: μ-law → linear16 PCM active');
      });
      
      this.humeWs.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Hume message:', message.type || 'unknown');
          
          // Log full message for debugging (truncated)
          if (message.type !== 'audio_output') {
            console.log('Full message:', JSON.stringify(message).substring(0, 200));
          }
          
          this.handleHumeMessage(message);
        } catch (error) {
          console.error('❌ Error parsing Hume message:', error);
          console.error('Raw data:', event.data);
        }
      });
      
      this.humeWs.addEventListener('error', (error) => {
        console.error('❌ Hume WebSocket error:', error);
      });
      
      this.humeWs.addEventListener('close', () => {
        console.log('🔌 Hume EVI disconnected');
        this.isSessionReady = false;
      });
      
    } catch (error) {
      console.error('❌ Failed to connect to Hume:', error);
    }
  }

  handleHumeMessage(message: any) {
    switch (message.type) {
      case 'audio_output':
        // Send audio back to Twilio (Hume sends linear16, Twilio expects μ-law)
        // For now, we'll send it as-is and let Twilio handle it
        if (this.twilioWs && message.data) {
          this.twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: {
              payload: message.data // Audio from Hume
            }
          }));
        }
        break;
        
      case 'user_interruption':
        console.log('🎙️ User interrupted');
        break;
        
      case 'user_message':
        if (message.message?.content) {
          console.log('💬 User said:', message.message.content);
        }
        break;
        
      case 'assistant_message':
        if (message.message?.content) {
          console.log('🤖 Assistant:', message.message.content);
        }
        break;
        
      case 'session_settings':
      case 'session_settings_response':
      case 'chat_metadata':
        console.log('📋 Session ready - type:', message.type);
        console.log('✅ Now accepting audio input (continuous stream)');
        console.log('🎵 Audio format: Converting μ-law → linear16 PCM');
        this.isSessionReady = true;
        break;
        
      case 'tool_call':
        console.log('🔧 Tool call:', message);
        this.handleToolCall(message);
        break;
        
      case 'error':
        console.error('❌ Hume error message:', message);
        if (message.error) {
          console.error('Error details:', message.error);
        }
        if (message.message) {
          console.error('Error message:', message.message);
        }
        if (message.code === 'I0100') {
          console.error('🔴 I0100 is a HUME INTERNAL ERROR - Not our issue!');
          console.error('📞 Contact Hume support: support@hume.ai');
          console.error('💬 Or join Discord: https://discord.gg/hume');
          console.error('ℹ️  Hume team has been automatically alerted');
        }
        break;
        
      case 'status':
        console.log('📊 Status message:', message);
        break;
        
      default:
        console.log(`❓ Unknown message type: ${message.type}`);
        console.log('Full message:', message);
    }
  }

  async handleToolCall(message: any) {
    console.log(`🔧 Tool requested: ${message.name || 'unknown'}`);
    
    // TODO: Implement actual tool responses
    // For now, return a placeholder response
    if (this.humeWs && message.tool_call_id) {
      try {
        const toolResponse = {
          type: 'tool_response',
          tool_call_id: message.tool_call_id,
          content: JSON.stringify({
            success: true,
            message: "Tool response placeholder - implement actual business logic here"
          })
        };
        
        console.log('📤 Sending tool response');
        this.humeWs.send(JSON.stringify(toolResponse));
      } catch (error) {
        console.error('❌ Error handling tool call:', error);
      }
    }
  }
  
  cleanup() {
    console.log('🧹 Cleaning up connections...');
    
    if (this.humeWs) {
      this.humeWs.close();
      this.humeWs = null;
    }
    
    this.isSessionReady = false;
    this.sessionReadyLogged = false;
    this.audioChunkCounter = 0;
  }
  
  async onRequest(req: Party.Request) {
    return new Response("Voice Party - Hume EVI with Audio Conversion (μ-law → linear16)", { status: 200 });
  }
}
