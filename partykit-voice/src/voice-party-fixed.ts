import type * as Party from "partykit/server";

// Version: Sequential Queue Fix - Deploy: 2025-08-24-v17
// FIXED: Process audio chunks sequentially to prevent race conditions

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
  callerContext: any = null;
  isSessionReady: boolean = false;
  sessionReadyLogged: boolean = false;
  audioChunkCounter: number = 0;
  outputChunkCounter: number = 0;
  outputsSent: number = 0;
  hasSentClear: boolean = false;
  
  // CRITICAL FIX: Sequential audio queue to prevent race conditions
  audioQueue: string[] = [];
  isProcessingQueue: boolean = false;
  isTwilioConnected: boolean = false;
  
  constructor(public room: Party.Room) {}
  
  /**
   * Generate a test tone to verify μ-law conversion
   */
  generateTestTone(): string {
    const sampleRate = 8000;
    const frequency = 440; // A4 note (440Hz)
    const duration = 0.5; // 0.5 second
    const samples = sampleRate * duration;
    
    const mulawData = new Uint8Array(samples);
    for (let i = 0; i < samples; i++) {
      // Generate sine wave
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * frequency * t) * 16384; // Half volume
      
      // Convert to μ-law
      mulawData[i] = this.linear16ToMulawSample(Math.floor(sample));
    }
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < mulawData.length; i++) {
      binary += String.fromCharCode(mulawData[i]);
    }
    
    const result = btoa(binary);
    console.log(`🎵 Generated test tone: 440Hz, 0.5s, ${result.length} chars`);
    return result;
  }
  
  /**
   * Process audio queue sequentially - NO RACE CONDITIONS!
   */
  async processAudioQueue() {
    // Prevent multiple queue processors
    if (this.isProcessingQueue) {
      console.log('⚠️ Queue processor already running, skipping');
      return;
    }
    
    this.isProcessingQueue = true;
    console.log(`🔄 Starting queue processing (${this.audioQueue.length} items)`);
    
    while (this.audioQueue.length > 0 && this.isTwilioConnected) {
      const audioData = this.audioQueue.shift();
      if (audioData) {
        console.log(`📤 Processing audio chunk ${this.outputsSent + 1} from queue`);
        await this.sendAudioToTwilio(audioData);  // AWAIT is critical!
      }
    }
    
    this.isProcessingQueue = false;
    console.log('✅ Queue processing complete');
  }
  
  async sendAudioToTwilio(audioData: string) {
    try {
      // Always increment counter first for consistent logging
      this.outputsSent++;
      console.log(`🎯 Processing Audio #${this.outputsSent} (input: ${audioData.length} chars)`);
      
      // Check connection state first
      // Note: This requires BIDIRECTIONAL streams (<Connect><Stream> in TwiML)
      if (!this.streamSid) {
        console.log(`⚠️ Audio #${this.outputsSent}: No streamSid yet, cannot send audio`);
        return;
      }
      if (!this.isTwilioConnected || !this.twilioWs) {
        console.log(`⚠️ Audio #${this.outputsSent}: Twilio disconnected, aborting`);
        return;
      }
      
      // Send clear event first (REQUIRED by Twilio!)
      if (!this.hasSentClear) {
        console.log(`📤 Sending clear event to Twilio for stream ${this.streamSid}`);
        this.twilioWs.send(JSON.stringify({
          event: 'clear',
          streamSid: this.streamSid
        }));
        this.hasSentClear = true;
      }
      
      // Convert Hume's WAV to μ-law
      const convertedAudio = this.convertLinear16ToMulaw(audioData);
      console.log(`🔄 Audio #${this.outputsSent}: Conversion result = ${convertedAudio ? convertedAudio.length : 0} chars`);
      
      // Check if conversion succeeded
      if (!convertedAudio || convertedAudio.length === 0) {
        console.error(`❌ Audio #${this.outputsSent}: Conversion failed or empty result`);
        return;
      }
      
      // According to Twilio docs, we can send the entire payload at once
      // Twilio handles buffering internally
      console.log(`📤 Audio #${this.outputsSent}: Sending ${convertedAudio.length} chars of μ-law to Twilio`);
      
      const mediaMessage = JSON.stringify({
        event: 'media',
        streamSid: this.streamSid,
        media: {
          payload: convertedAudio // Send all μ-law audio at once
        }
      });
      
      this.twilioWs?.send(mediaMessage);
      console.log(`✅ Audio #${this.outputsSent}: Sent to Twilio successfully`);
      
    } catch (error) {
      console.error(`❌ Audio #${this.outputsSent}: Error sending to Twilio:`, error);
      console.error('Error details:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Convert μ-law audio from Twilio to linear16 PCM for Hume
   * μ-law is NOT supported by Hume EVI, so conversion is mandatory
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

      // Convert μ-law to linear16 PCM using lookup table
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
      console.error('❌ μ-law → linear16 conversion error:', error);
      return ""; // NEVER send wrong format to Hume - return empty!
    }
  }

  /**
   * Convert WAV file from Hume back to μ-law for Twilio
   * CRITICAL: Must downsample from Hume's rate to Twilio's 8000 Hz!
   * @param base64WavAudio - Base64 encoded WAV file from Hume
   * @returns Base64 encoded μ-law audio for Twilio
   */
  convertLinear16ToMulaw(base64WavAudio: string): string {
    try {
      console.log(`🔧 Audio #${this.outputsSent}: Converting WAV (${base64WavAudio.length} chars)`);
      
      // Decode base64 to binary
      const binaryString = atob(base64WavAudio);
      const wavBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wavBytes[i] = binaryString.charCodeAt(i);
      }
      
      // Check if this is actually a WAV file
      const isWav = wavBytes[0] === 0x52 && wavBytes[1] === 0x49 && 
                    wavBytes[2] === 0x46 && wavBytes[3] === 0x46; // "RIFF"
      
      if (!isWav) {
        console.error(`❌ Audio #${this.outputsSent}: Not a WAV file! First 4 bytes: [${wavBytes[0]},${wavBytes[1]},${wavBytes[2]},${wavBytes[3]}]`);
        console.error(`First 20 chars of base64: ${base64WavAudio.substring(0, 20)}`);
        return "";
      }
      
      // Additional WAV validation
      const wavSize = wavBytes.length;
      if (wavSize < 44) {
        console.error(`❌ Audio #${this.outputsSent}: WAV too small (${wavSize} bytes) - needs at least 44 for header`);
        return "";
      }

      // CRITICAL: Parse WAV header to get actual sample rate!
      const dataView = new DataView(wavBytes.buffer);
      
      // WAV format check (offset 20-22: 1 = PCM)
      const audioFormat = dataView.getUint16(20, true);
      
      // Number of channels (offset 22-24)
      const channels = dataView.getUint16(22, true);
      
      // Sample rate (offset 24-28) - THIS IS KEY!
      const sampleRate = dataView.getUint32(24, true);
      
      // Bits per sample (offset 34-36)
      const bitsPerSample = dataView.getUint16(34, true);
      
      // Always log WAV format for debugging
      console.log(`📊 Audio #${this.outputsSent}: WAV Header: ${sampleRate}Hz, ${channels}ch, ${bitsPerSample}bit, format=${audioFormat}`);
      if (sampleRate !== 8000) {
        console.log(`⚠️ Audio #${this.outputsSent}: DOWNSAMPLING: ${sampleRate}Hz → 8000Hz for Twilio`);
      }

      // Find the 'data' chunk
      let dataOffset = 44; // Default for standard PCM WAV
      
      // Look for 'data' chunk (safer approach)
      for (let i = 36; i < wavBytes.length - 4; i++) {
        if (wavBytes[i] === 0x64 && wavBytes[i+1] === 0x61 && 
            wavBytes[i+2] === 0x74 && wavBytes[i+3] === 0x61) { // 'data'
          dataOffset = i + 8; // Skip 'data' marker and size field
          break;
        }
      }

      // Extract PCM data (skip WAV header)
      const pcmBytes = wavBytes.slice(dataOffset);
      
      // Create a new buffer from the sliced bytes
      const pcmBuffer = new ArrayBuffer(pcmBytes.length);
      new Uint8Array(pcmBuffer).set(pcmBytes);
      
      // Convert byte array to Int16Array (little-endian)
      let pcmData = new Int16Array(pcmBuffer);
      
      // Validate PCM data
      let maxValue = 0;
      let minValue = 0;
      for (let i = 0; i < Math.min(100, pcmData.length); i++) {
        if (pcmData[i] > maxValue) maxValue = pcmData[i];
        if (pcmData[i] < minValue) minValue = pcmData[i];
      }
      console.log(`📊 Audio #${this.outputsSent}: PCM range: [${minValue} to ${maxValue}] (first 100 samples)`);
      
      // CRITICAL: Downsample if needed!
      if (sampleRate !== 8000) {
        const ratio = sampleRate / 8000;
        const downsampledLength = Math.floor(pcmData.length / ratio);
        const downsampled = new Int16Array(downsampledLength);
        
        // Simple downsampling (picks nearest sample)
        for (let i = 0; i < downsampledLength; i++) {
          const sourceIndex = Math.floor(i * ratio);
          downsampled[i] = pcmData[sourceIndex];
        }
        
        pcmData = downsampled;
        console.log(`🔄 Audio #${this.outputsSent}: Downsampled: ${pcmBuffer.byteLength / 2} samples → ${pcmData.length} samples`);
      }
      
      // Convert each linear16 sample to μ-law
      const mulawData = new Uint8Array(pcmData.length);
      let nonZeroSamples = 0;
      for (let i = 0; i < pcmData.length; i++) {
        mulawData[i] = this.linear16ToMulawSample(pcmData[i]);
        if (mulawData[i] !== 0 && mulawData[i] !== 0xFF) nonZeroSamples++;
      }
      
      // Validate we have actual audio (not silence)
      if (nonZeroSamples < 10) {
        console.warn(`⚠️ Audio #${this.outputsSent}: Possible silence detected! Only ${nonZeroSamples} non-zero samples out of ${mulawData.length}`);
      }

      // Convert μ-law data to base64
      let binaryMulaw = '';
      for (let i = 0; i < mulawData.length; i++) {
        binaryMulaw += String.fromCharCode(mulawData[i]);
      }
      
      // Always log conversion details
      console.log(`🔊 Audio #${this.outputsSent}: WAV→μ-law: ${wavBytes.length} bytes → ${mulawData.length} μ-law samples`);
      
      const result = btoa(binaryMulaw);
      console.log(`✅ Audio #${this.outputsSent}: Converted to μ-law: ${result.length} chars`);
      return result;
    } catch (error) {
      console.error(`❌ Audio #${this.outputsSent}: WAV → μ-law conversion error:`, error);
      return ""; // Return empty on conversion failure
    }
  }

  /**
   * Convert a single linear16 PCM sample to μ-law
   * Using ITU-T G.711 standard algorithm
   */
  linear16ToMulawSample(sample: number): number {
    const MULAW_BIAS = 0x84;
    const MULAW_CLIP = 32635;
    
    // Ensure sample is in 16-bit range
    sample = Math.max(-32768, Math.min(32767, sample));
    
    // FIXED: Properly handle sign for 16-bit signed integers
    let sign = 0;
    if (sample < 0) {
      sign = 0x80;
      sample = -sample; // Get absolute value
    }
    
    // Clip magnitude
    if (sample > MULAW_CLIP) sample = MULAW_CLIP;
    
    // Add bias
    sample = sample + MULAW_BIAS;
    
    // Find exponent
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
    
    // Extract mantissa
    let mantissa = (sample >> (exponent + 3)) & 0x0F;
    
    // Combine and invert (ITU-T G.711 standard)
    let mulawByte = ~(sign | (exponent << 4) | mantissa);
    
    // Ensure result is valid 8-bit value
    const result = mulawByte & 0xFF;
    
    // Validate result is in valid μ-law range
    if (result < 0 || result > 255) {
      console.error(`❌ Invalid μ-law value: ${result} from sample: ${sample}`);
      return 0x7F; // Return silence
    }
    
    return result;
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`🔌 New connection: ${conn.id}`);
    
    // Store Twilio WebSocket connection
    this.twilioWs = conn;
    this.isTwilioConnected = true;
    
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
      this.isTwilioConnected = false;
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
        console.log(`🎵 Audio conversion: μ-law → linear16 PCM (REQUIRED)`);
        this.streamSid = msg.start.streamSid;
        this.callSid = msg.start.callSid;
        
        // Extract caller context from Twilio parameters
        if (msg.start.customParameters?.callerContext) {
          try {
            const callerContextEncoded = msg.start.customParameters.callerContext;
            const callerContextJson = Buffer.from(callerContextEncoded, 'base64').toString('utf-8');
            this.callerContext = JSON.parse(callerContextJson);
            
            console.log(`👤 [VOICE-CONTEXT] Caller Context Received:`, {
              found: this.callerContext.found,
              name: this.callerContext.fullName || 'Unknown',
              claimsCount: this.callerContext.claimsCount || 0,
              status: this.callerContext.status || 'unknown'
            });
          } catch (error) {
            console.error(`❌ [VOICE-CONTEXT] Error parsing caller context:`, error);
            this.callerContext = { found: false, phone: msg.start.customParameters?.from || 'unknown' };
          }
        } else {
          console.log(`❓ [VOICE-CONTEXT] No caller context provided`);
          this.callerContext = { found: false, phone: msg.start.customParameters?.from || 'unknown' };
        }
        
        // TEST: Send a test tone first to verify μ-law is working
        if (this.room.env.ENABLE_TEST_TONE === 'true') {
          console.log('🧪 TEST MODE: Sending test tone to verify μ-law');
          setTimeout(() => {
            const testTone = this.generateTestTone();
            if (this.twilioWs && this.streamSid) {
              this.twilioWs.send(JSON.stringify({
                event: 'media',
                streamSid: this.streamSid,
                media: {
                  payload: testTone
                }
              }));
              console.log('🎶 Test tone sent to Twilio');
            }
          }, 1000);
        }
        
        // Connect to Hume EVI using WebSocket API
        await this.connectToHume();
        break;
        
      case 'media':
        if (msg.media?.payload && this.humeWs && this.humeWs.readyState === WebSocket.OPEN) {
          if (this.isSessionReady) {
            try {
              // Convert μ-law to linear16 PCM (REQUIRED - μ-law not supported by Hume)
              const convertedAudio = this.convertMulawToLinear16(msg.media.payload);
              
              // Check conversion succeeded
              if (!convertedAudio || convertedAudio.length === 0) {
                console.error('⚠️ Skipping audio to Hume - conversion to linear16 failed');
                return;
              }
              
              // Send audio_input message - ONLY type and data fields per Hume spec
              const audioMessage = {
                type: 'audio_input',
                data: convertedAudio // Base64 encoded linear16 PCM
                // NO metadata field - not in Hume specification
              };
              
              // Send ALL chunks for continuous stream (Hume requirement)
              this.humeWs.send(JSON.stringify(audioMessage));
              
              // Log occasionally to avoid spam
              if (Math.random() > 0.98) {
                console.log(`🎤 Streaming: linear16 PCM (converted from μ-law)`);
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
        this.isTwilioConnected = false;
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
      console.log('🎵 Audio: Converting μ-law → linear16 PCM (telephony source)');
      
      // Build WebSocket URL with authentication - ONLY api_key and config_id
      const wsUrl = new URL('wss://api.hume.ai/v0/evi/chat');
      wsUrl.searchParams.append('api_key', HUME_API_KEY);
      if (HUME_CONFIG_ID) {
        wsUrl.searchParams.append('config_id', HUME_CONFIG_ID);
      }
      // NO custom parameters - not in Hume specification
      
      console.log('🔐 Using API key authentication');
      
      // Create WebSocket connection
      this.humeWs = new WebSocket(wsUrl.toString());
      
      // Set up event handlers
      this.humeWs.addEventListener('open', () => {
        console.log('✅ Hume EVI WebSocket opened successfully!');
        console.log('⏳ Sending session_settings for telephony audio...');
        
        // Send initial configuration per Hume documentation
        // https://dev.hume.ai/docs/speech-to-speech-evi/guides/audio#linear-pcm
        const initMessage = {
          type: 'session_settings',
          // NO nesting under 'session_settings' - direct under root
          audio: {
            encoding: 'linear16',   // API expects 'encoding' not 'format'
            sample_rate: 8000,      // Twilio telephony is 8kHz
            channels: 1             // Mono audio (REQUIRED field)
          }
        };
        
        console.log('📤 Sending session_settings (Hume spec compliant):', JSON.stringify(initMessage));
        if (this.humeWs) {
          this.humeWs.send(JSON.stringify(initMessage));
        }
        
        // Send caller context to Hume for personalized conversation
        if (this.callerContext && this.humeWs) {
          console.log('👤 [VOICE-CONTEXT] Sending caller context to Hume...');
          
          const contextMessage = this.callerContext.found ? 
            `Hello, I'm speaking with ${this.callerContext.fullName}. They have ${this.callerContext.claimsCount} claims with us and their current status is ${this.callerContext.status}. Their phone number is ${this.callerContext.phone}.` :
            `Hello, I'm speaking with someone calling from ${this.callerContext.phone}. I don't have their details in our system yet.`;
          
          // Send as a system message to set context
          const systemContextMessage = {
            type: 'user_input',
            text: `SYSTEM CONTEXT: ${contextMessage}. Please greet the caller appropriately and help them with their motor finance claim inquiry.`
          };
          
          console.log('📤 [VOICE-CONTEXT] Context message:', systemContextMessage.text);
          this.humeWs.send(JSON.stringify(systemContextMessage));
        }
        
        // Note about telephony limitations
        console.log('⚠️  NOTE: Telephony lacks browser audio features:');
        console.log('   - No echo cancellation');
        console.log('   - No noise suppression');
        console.log('   - No auto gain control');
        console.log('   This may affect Hume\'s emotion detection accuracy');
      });
      
      this.humeWs.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Hume message:', message.type || 'unknown');
          
          // Log full message for debugging (except audio)
          if (message.type !== 'audio_output') {
            const logMsg = JSON.stringify(message);
            if (logMsg.length > 200) {
              console.log('Full message:', logMsg.substring(0, 200) + '...');
            } else {
              console.log('Full message:', logMsg);
            }
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
      
      this.humeWs.addEventListener('close', (event) => {
        console.log('🔌 Hume EVI disconnected');
        console.log('Close code:', event.code);
        console.log('Close reason:', event.reason);
        this.isSessionReady = false;
      });
      
    } catch (error) {
      console.error('❌ Failed to connect to Hume:', error);
    }
  }

  handleHumeMessage(message: any) {
    switch (message.type) {
      case 'audio_output':
        // CRITICAL FIX: Queue audio instead of processing in parallel!
        if (this.twilioWs && message.data) {
          console.log(`📦 Received audio_output chunk #${this.audioQueue.length + 1} (${message.data.length} base64 chars)`);
          
          // Add to queue
          this.audioQueue.push(message.data);
          console.log(`📨 Queued audio chunk (${this.audioQueue.length} in queue)`);
          
          // Process queue sequentially (won't start new processor if one is running)
          this.processAudioQueue().catch(error => {
            console.error('❌ Error processing audio queue:', error);
          });
        } else {
          console.log('⚠️ No Twilio connection or data for audio_output');
        }
        break;
        
      case 'user_interruption':
        console.log('🎙️ User interrupted - clearing audio queue');
        this.audioQueue = [];  // Clear pending audio
        break;
        
      case 'user_message':
        if (message.message?.content) {
          console.log('💬 User said:', message.message.content);
        }
        this.audioQueue = [];  // Clear pending audio on new user message
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
        console.log('🎵 Format: linear16 PCM @ 8kHz mono');
        this.isSessionReady = true;
        break;
        
      case 'tool_call':
        console.log('🔧 Tool call:', message);
        this.handleToolCall(message);
        break;
        
      case 'error':
        console.error('❌ Hume error:', message);
        if (message.error) {
          console.error('Error details:', message.error);
        }
        if (message.message) {
          console.error('Error message:', message.message);
        }
        if (message.code === 'I0100') {
          console.error('🔴 I0100 is a HUME INTERNAL ERROR');
          console.error('📞 Contact Hume support: support@hume.ai');
          console.error('💬 Discord: https://discord.gg/hume');
        }
        break;
        
      case 'status':
        console.log('📊 Status:', message);
        break;
        
      default:
        console.log(`❓ Unknown message type: ${message.type}`);
    }
  }

  async handleToolCall(message: any) {
    console.log(`🔧 Tool requested: ${message.name || 'unknown'}`);
    
    // TODO: Implement actual tool responses
    if (this.humeWs && message.tool_call_id) {
      try {
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
    
    // Clear audio queue and stop processing
    this.audioQueue = [];
    this.isProcessingQueue = false;
    this.isTwilioConnected = false;
    
    if (this.humeWs) {
      this.humeWs.close();
      this.humeWs = null;
    }
    
    // Clear caller context
    this.callerContext = null;
    
    this.isSessionReady = false;
    this.sessionReadyLogged = false;
    this.audioChunkCounter = 0;
    this.outputChunkCounter = 0;
    this.outputsSent = 0;
    this.hasSentClear = false;
  }
  
  async onRequest(req: Party.Request) {
    return new Response("Voice Party - Sequential Queue v17", { status: 200 });
  }
}
