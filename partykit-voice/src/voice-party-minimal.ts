import type * as Party from "partykit/server";

// Version: Continuous Stream Implementation - Deploy: 2025-08-24-v5
// Following Hume's audio_input specification for continuous streaming
export default class VoiceParty implements Party.Server {
  twilioWs: Party.Connection | null = null;
  humeWs: WebSocket | null = null;
  streamSid: string | null = null;
  callSid: string | null = null;
  isSessionReady: boolean = false;
  sessionReadyLogged: boolean = false;
  
  constructor(public room: Party.Room) {}

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
        this.streamSid = msg.start.streamSid;
        this.callSid = msg.start.callSid;
        
        // Connect to Hume EVI using WebSocket API (SDK-compatible approach)
        await this.connectToHume();
        break;
        
      case 'media':
        if (msg.media?.payload && this.humeWs && this.humeWs.readyState === WebSocket.OPEN) {
          if (this.isSessionReady) {
            try {
              // Send audio_input message following Hume's specification
              const audioMessage = {
                type: 'audio_input',
                data: msg.media.payload // Base64 encoded audio (currently μ-law from Twilio)
              };
              
              // Send ALL chunks for continuous stream (Hume requirement)
              // Note: Twilio sends chunks continuously, which matches Hume's needs
              this.humeWs.send(JSON.stringify(audioMessage));
              
              // Log occasionally to avoid spam
              if (Math.random() > 0.95) {
                console.log(`🎤 Audio streaming (sample log): ${msg.media.payload.length} chars`);
              }
            } catch (error) {
              console.error('❌ Error sending audio to Hume:', error);
            }
          } else {
            // Discard audio until session is ready
            // Log once to avoid spam
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
      // Following the SDK's connection pattern but using native WebSocket
      console.log('🔗 Connecting to Hume EVI WebSocket...');
      console.log('📊 Using config ID:', HUME_CONFIG_ID);
      
      // Build WebSocket URL with authentication
      // As per Hume docs: can use api_key directly
      const wsUrl = new URL('wss://api.hume.ai/v0/evi/chat');
      wsUrl.searchParams.append('api_key', HUME_API_KEY);
      if (HUME_CONFIG_ID) {
        wsUrl.searchParams.append('config_id', HUME_CONFIG_ID);
      }
      
      console.log('🔐 Using API key authentication (SDK-compatible)');
      
      // Create WebSocket connection
      this.humeWs = new WebSocket(wsUrl.toString());
      
      // Set up event handlers (matching SDK event patterns)
      this.humeWs.addEventListener('open', () => {
        console.log('✅ Hume EVI WebSocket opened successfully!');
        // Don't buffer audio until session is ready - discard it
        console.log('⏳ Waiting for session to be ready...');
        console.log('⚠️ Note: Audio received before session ready will be discarded');
      });
      
      this.humeWs.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Hume message:', message.type || 'unknown');
          console.log('Full message:', JSON.stringify(message).substring(0, 200));
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
        // Send audio back to Twilio (following SDK pattern)
        if (this.twilioWs && message.data) {
          // Hume sends base64 encoded audio
          console.log(`🔊 Sending audio back to Twilio: ${message.data.length} chars`);
          this.twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: {
              payload: message.data // Already base64 from Hume
            }
          }));
        }
        break;
        
      case 'user_interruption':
        console.log('🎙️ User interrupted');
        // Handle interruption if needed
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
        console.log('📊 Audio format: Base64 μ-law 8kHz from Twilio');
        this.isSessionReady = true;
        break;
        
      case 'tool_call':
        console.log('🔧 Tool call:', message);
        // Handle tool calls if configured
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
          console.error('💡 I0100 often indicates audio format issues or overload');
          console.error('💡 Consider: μ-law may not be supported, need WAV/PCM conversion');
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
  
  // Audio buffering removed - we stream continuously as required by Hume

  async handleToolCall(message: any) {
    console.log(`🔧 Tool requested: ${message.name || 'unknown'}`);
    
    // For now, return a placeholder response
    if (this.humeWs && message.tool_call_id) {
      try {
        // Send tool response back to Hume (following SDK pattern)
        const toolResponse = {
          type: 'tool_response',
          tool_call_id: message.tool_call_id,
          content: JSON.stringify({
            success: true,
            message: "Tool response placeholder"
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
  }
  
  async onRequest(req: Party.Request) {
    return new Response("Voice Party - Hume SDK Pattern (Worker-Compatible)", { status: 200 });
  }
}
