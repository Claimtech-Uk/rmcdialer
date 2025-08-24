import type * as Party from "partykit/server";

// Audio conversion tables for mulaw <-> linear16
const ULAW_TABLE = new Int16Array([
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
  -56, -48, -40, -32, -24, -16, -8, -1,
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
  
  constructor(readonly room: Party.Room) {}

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`🎧 New connection from ${ctx.request.headers.get('user-agent')}`);
    
    // This is the Twilio connection
    this.twilioWs = conn;
    
    // Handle Twilio messages
    conn.addEventListener("message", async (evt) => {
      try {
        const msg = JSON.parse(evt.data as string);
        await this.handleTwilioMessage(msg);
      } catch (error) {
        console.error('❌ Error processing Twilio message:', error);
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
        this.streamSid = msg.start?.streamSid;
        this.callSid = msg.start?.customParameters?.callSid || msg.start?.callSid;
        const from = msg.start?.customParameters?.from;
        
        console.log(`🎧 Twilio stream started`, { 
          callSid: this.callSid,
          streamSid: this.streamSid,
          from 
        });
        
        // Connect to Hume EVI
        await this.connectToHume();
        break;
        
      case 'media':
        if (msg.media?.payload && this.humeWs?.readyState === WebSocket.OPEN) {
          // Convert Twilio mulaw to Hume linear16
          const convertedAudio = this.convertMulawToLinear16(msg.media.payload);
          
          // Send to Hume
          this.humeWs.send(JSON.stringify({
            type: 'audio_input',
            data: convertedAudio
          }));
        }
        break;
        
      case 'stop':
        console.log(`🛑 Stream stopped: ${msg.streamSid}`);
        this.cleanup();
        break;
    }
  }

  async connectToHume() {
    const HUME_API_KEY = await this.room.env.HUME_API_KEY as string;
    const HUME_CONFIG_ID = await this.room.env.HUME_CONFIG_ID as string;
    
    console.log('🔑 Hume credentials check:', {
      hasApiKey: !!HUME_API_KEY,
      apiKeyLength: HUME_API_KEY?.length,
      hasConfigId: !!HUME_CONFIG_ID,
      configId: HUME_CONFIG_ID
    });
    
    if (!HUME_API_KEY || !HUME_CONFIG_ID) {
      console.error('❌ Hume credentials not configured', {
        HUME_API_KEY: HUME_API_KEY ? 'SET' : 'MISSING',
        HUME_CONFIG_ID: HUME_CONFIG_ID || 'MISSING'
      });
      return;
    }

    try {
      // Connect to Hume EVI WebSocket
      // Use the /chat endpoint with access_token (which is your API key)
      const humeWsUrl = `wss://api.hume.ai/v0/evi/chat?access_token=${HUME_API_KEY}`;
      console.log('🔗 Connecting to Hume WebSocket at: wss://api.hume.ai/v0/evi/chat');
      console.log('📊 Using config:', HUME_CONFIG_ID);
      
      this.humeWs = new WebSocket(humeWsUrl);

      this.humeWs.addEventListener('open', () => {
        console.log(`🎭 Hume EVI connected for call ${this.callSid}`);
        
        // Send the config_id to initialize the session
        // The config_id contains all voice and behavior settings from Hume dashboard
        const sessionInit = {
          type: 'session_settings',
          config_id: HUME_CONFIG_ID
        };
        
        console.log('📤 Sending Hume session init:', JSON.stringify(sessionInit, null, 2));
        this.humeWs!.send(JSON.stringify(sessionInit));
      });

      this.humeWs.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Hume message received:', message.type);
          this.handleHumeMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse Hume message:', error, event.data);
        }
      });

      this.humeWs.addEventListener('close', (event) => {
        console.log(`🔌 Hume EVI disconnected for call ${this.callSid}`, {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
      });

      this.humeWs.addEventListener('error', (error) => {
        console.error(`❌ Hume WebSocket error for call ${this.callSid}:`, error);
      });
      
    } catch (error) {
      console.error(`❌ Failed to connect to Hume:`, error);
    }
  }

  handleHumeMessage(msg: any) {
    // Handle different Hume message types
    console.log(`📝 Processing Hume message type: ${msg.type}`);
    
    switch (msg.type) {
      case 'audio_output':
        if (this.twilioWs && msg.data) {
          // Convert Hume linear16 to Twilio mulaw
          const mulawAudio = this.convertLinear16ToMulaw(msg.data);
          
          // Send to Twilio
          this.twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: {
              payload: mulawAudio
            }
          }));
        }
        break;
        
      case 'tool_call':
      case 'function_call':
        // Handle voice actions
        console.log(`🔧 Function/tool call received:`, msg);
        this.handleVoiceAction(msg);
        break;
        
      case 'user_message':
        console.log(`💬 User said: ${msg.message?.content || msg.text}`);
        break;
        
      case 'assistant_message':
        console.log(`🤖 Assistant: ${msg.message?.content || msg.text}`);
        break;
        
      case 'session_settings_response':
        console.log(`✅ Session configured successfully`);
        break;
        
      case 'emotion':
        // Log emotional state
        console.log(`😊 Emotion detected:`, msg.emotion);
        break;
        
      case 'error':
        console.error(`❌ Hume error:`, msg.error || msg.message || msg);
        break;
        
      default:
        console.log(`❓ Unknown Hume message type:`, msg);
    }
  }

  async handleVoiceAction(msg: any) {
    console.log(`🔧 Voice action requested: ${msg.name}`);
    
    // For now, return a placeholder response
    // In production, this would call your actual voice actions
    const result = {
      success: true,
      message: `Action ${msg.name} would be processed here`
    };
    
    if (this.humeWs?.readyState === WebSocket.OPEN) {
      this.humeWs.send(JSON.stringify({
        type: 'function_call_result',
        call_id: msg.call_id,
        result
      }));
    }
  }

  convertMulawToLinear16(base64MulawAudio: string): string {
    const mulawBuffer = Buffer.from(base64MulawAudio, 'base64');
    const linear16Buffer = Buffer.alloc(mulawBuffer.length * 2);
    
    for (let i = 0; i < mulawBuffer.length; i++) {
      const linear16Sample = ULAW_TABLE[mulawBuffer[i]];
      linear16Buffer.writeInt16LE(linear16Sample, i * 2);
    }
    
    return linear16Buffer.toString('base64');
  }

  convertLinear16ToMulaw(base64Linear16Audio: string): string {
    const linear16Buffer = Buffer.from(base64Linear16Audio, 'base64');
    const mulawBuffer = Buffer.alloc(linear16Buffer.length / 2);
    
    for (let i = 0; i < linear16Buffer.length; i += 2) {
      const sample = linear16Buffer.readInt16LE(i);
      mulawBuffer[i / 2] = this.linear16ToMulaw(sample);
    }
    
    return mulawBuffer.toString('base64');
  }

  linear16ToMulaw(sample: number): number {
    const MULAW_MAX = 0x1FFF;
    const MULAW_BIAS = 33;
    
    let sign = (sample >> 8) & 0x80;
    if (sign) sample = -sample;
    if (sample > MULAW_MAX) sample = MULAW_MAX;
    
    sample = sample + MULAW_BIAS;
    const exponent = Math.floor(Math.log2(sample)) - 5;
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const companded = ~(sign | (exponent << 4) | mantissa);
    
    return companded & 0xFF;
  }

  cleanup() {
    if (this.humeWs) {
      this.humeWs.close();
      this.humeWs = null;
    }
    
    if (this.twilioWs) {
      this.twilioWs.close();
      this.twilioWs = null;
    }
  }

  async onClose(conn: Party.Connection) {
    this.cleanup();
  }

  async onRequest(request: Party.Request) {
    // Handle HTTP requests (non-WebSocket)
    return new Response(
      JSON.stringify({
        status: 'ready',
        message: 'Voice Party WebSocket bridge is running',
        party: this.room.id,
        wsUrl: `wss://${request.headers.get('host')}/parties/voice/${this.room.id}`,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
