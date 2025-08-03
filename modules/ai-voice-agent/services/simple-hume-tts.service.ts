import { HumeClient } from "hume";
import { R2AudioHostingService } from './r2-audio-hosting.service';

export class SimpleHumeTTSService {
  private hume: HumeClient;
  private r2Service?: R2AudioHostingService;

  constructor() {
    const apiKey = process.env.HUME_API_KEY;
    if (!apiKey) {
      throw new Error('HUME_API_KEY environment variable is required');
    }

    this.hume = new HumeClient({
      apiKey: apiKey
    });

    // Initialize R2 service if configured
    try {
      this.r2Service = new R2AudioHostingService();
      console.log('🎵 Hume TTS Service initialized with R2 hosting');
    } catch (error) {
      console.warn('⚠️ R2 not configured, falling back to data URIs:', error instanceof Error ? error.message : String(error));
      this.r2Service = undefined;
    }
  }

  /**
   * Generate greeting for out-of-hours calls (outside business hours)
   * Returns either R2 URL or data URI depending on configuration
   */
  async generateOutOfHoursGreeting(callerName?: string): Promise<string> {
    try {
      console.log('🎵 Generating Hume TTS out-of-hours greeting...');
      
              const greeting = callerName 
          ? `Hello ${callerName}, welcome to Resolve My Claim.

Unfortunately, you've caught us outside of our normal working hours.

I've made a note in the system for one of our agents to give you a call back as soon as possible.

Have a great day!`
          : `Hi there, welcome to Resolve My Claim.

Unfortunately, you've caught us outside of our normal working hours.

I've made a note in the system for one of our agents to give you a call back as soon as possible.

Have a great day!`;

      const audioBase64 = await this.synthesizeText(greeting);

      // If R2 is configured, upload and return URL
      if (this.r2Service) {
        try {
          const audioUrl = await this.r2Service.uploadAudioFile(audioBase64, 'out-of-hours', callerName);
          console.log('✅ Out-of-hours greeting uploaded to R2:', audioUrl);
          return audioUrl;
        } catch (r2Error) {
          console.warn('⚠️ R2 upload failed, falling back to data URI:', r2Error);
          return this.convertToDataUri(audioBase64);
        }
      }

      // Fallback to data URI
      return this.convertToDataUri(audioBase64);
    } catch (error) {
      console.error('❌ Hume TTS out-of-hours greeting failed:', error);
      throw error;
    }
  }

  /**
   * Generate greeting for busy periods (during hours but no agents available)
   * Returns either R2 URL or data URI depending on configuration
   */
  async generateBusyGreeting(callerName?: string): Promise<string> {
    try {
      console.log('🎵 Generating Hume TTS busy greeting...');
      
              const greeting = callerName 
          ? `Hello ${callerName}, welcome to Resolve My Claim.

All of our agents are currently busy helping other customers.

Your call is important to us, and we'll have someone call you back shortly.

Thank you for your patience!`
          : `Hi there, welcome to Resolve My Claim.

All of our agents are currently busy helping other customers.

Your call is important to us, and we'll have someone call you back shortly.

Thank you for your patience!`;

      const audioBase64 = await this.synthesizeText(greeting);

      // If R2 is configured, upload and return URL
      if (this.r2Service) {
        try {
          const audioUrl = await this.r2Service.uploadAudioFile(audioBase64, 'busy', callerName);
          console.log('✅ Busy greeting uploaded to R2:', audioUrl);
          return audioUrl;
        } catch (r2Error) {
          console.warn('⚠️ R2 upload failed, falling back to data URI:', r2Error);
          return this.convertToDataUri(audioBase64);
        }
      }

      // Fallback to data URI
      return this.convertToDataUri(audioBase64);
    } catch (error) {
      console.error('❌ Hume TTS busy greeting failed:', error);
      throw error;
    }
  }

  /**
   * Generate greeting for when connecting to agents (during hours with agents available)
   * Returns either R2 URL or data URI depending on configuration
   */
  async generateConnectingGreeting(callerName?: string): Promise<string> {
    try {
      console.log('🎵 Generating Hume TTS connecting greeting...');
      
      const greeting = callerName 
        ? `Hello ${callerName}, welcome to Resolve My Claim.

Please hold for just a moment while I connect you to one of our available agents.

Thank you for calling!`
        : `Hi there, welcome to Resolve My Claim.

Please hold for just a moment while I connect you to one of our available agents.

Thank you for calling!`;

      const audioBase64 = await this.synthesizeText(greeting);

      // If R2 is configured, upload and return URL
      if (this.r2Service) {
        try {
          const audioUrl = await this.r2Service.uploadAudioFile(audioBase64, 'connecting', callerName);
          console.log('✅ Connecting greeting uploaded to R2:', audioUrl);
          return audioUrl;
        } catch (r2Error) {
          console.warn('⚠️ R2 upload failed, falling back to data URI:', r2Error);
          return this.convertToDataUri(audioBase64);
        }
      }

      // Fallback to data URI
      return this.convertToDataUri(audioBase64);
    } catch (error) {
      console.error('❌ Hume TTS connecting greeting failed:', error);
      throw error;
    }
  }

  /**
   * Generate emergency fallback message for technical difficulties
   * Returns either R2 URL or data URI depending on configuration
   */
  async generateEmergencyMessage(): Promise<string> {
    try {
      console.log('🎵 Generating Hume TTS emergency message...');
      
      const message = `Thank you for calling Resolve My Claim. We're experiencing technical difficulties. We'll have someone call you back as soon as possible.`;

      const audioBase64 = await this.synthesizeText(message);

      // If R2 is configured, upload and return URL
      if (this.r2Service) {
        try {
          const audioUrl = await this.r2Service.uploadAudioFile(audioBase64, 'busy', 'emergency');
          console.log('✅ Emergency message uploaded to R2:', audioUrl);
          return audioUrl;
        } catch (r2Error) {
          console.warn('⚠️ R2 upload failed, falling back to data URI:', r2Error);
          return this.convertToDataUri(audioBase64);
        }
      }

      // Fallback to data URI
      return this.convertToDataUri(audioBase64);
    } catch (error) {
      console.error('❌ Hume TTS emergency message failed:', error);
      throw error;
    }
  }

  /**
   * Generate custom message with provided text
   * Returns either R2 URL or data URI depending on configuration
   */
  async generateCustomMessage(text: string): Promise<string> {
    try {
      console.log('🎵 Generating Hume TTS custom message...');
      
      const audioBase64 = await this.synthesizeText(text);

      // If R2 is configured, upload and return URL
      if (this.r2Service) {
        try {
          const audioUrl = await this.r2Service.uploadAudioFile(audioBase64, 'connecting', 'message');
          console.log('✅ Custom message uploaded to R2:', audioUrl);
          return audioUrl;
        } catch (r2Error) {
          console.warn('⚠️ R2 upload failed, falling back to data URI:', r2Error);
          return this.convertToDataUri(audioBase64);
        }
      }

      // Fallback to data URI
      return this.convertToDataUri(audioBase64);
    } catch (error) {
      console.error('❌ Hume TTS custom message failed:', error);
      throw error;
    }
  }

  /**
   * Generate callback offer message
   * Returns either R2 URL or data URI depending on configuration
   */
  async generateCallbackOffer(): Promise<string> {
    try {
      console.log('🎵 Generating Hume TTS callback offer...');
      
      const message = `Due to high call volume, we can arrange for one of our agents to call you back. 
      
This way, you won't have to wait on hold. 

Press 1 if you'd like us to call you back, or stay on the line to continue holding.`;

      const audioBase64 = await this.synthesizeText(message);

      // If R2 is configured, upload and return URL
      if (this.r2Service) {
        try {
          const audioUrl = await this.r2Service.uploadAudioFile(audioBase64, 'connecting', 'offer');
          console.log('✅ Callback offer uploaded to R2:', audioUrl);
          return audioUrl;
        } catch (r2Error) {
          console.warn('⚠️ R2 upload failed, falling back to data URI:', r2Error);
          return this.convertToDataUri(audioBase64);
        }
      }

      // Fallback to data URI
      return this.convertToDataUri(audioBase64);
    } catch (error) {
      console.error('❌ Hume TTS callback offer failed:', error);
      throw error;
    }
  }

  /**
   * Generate apology message for long waits
   * Returns either R2 URL or data URI depending on configuration
   */
  async generateApologyMessage(): Promise<string> {
    try {
      console.log('🎵 Generating Hume TTS apology message...');
      
      const message = `We sincerely apologize for the wait. 

All of our agents are currently assisting other customers, and we're experiencing higher than normal call volume.

We'll have someone call you back as soon as an agent becomes available. 

Thank you for your patience and for choosing Resolve My Claim.`;

      const audioBase64 = await this.synthesizeText(message);

      // If R2 is configured, upload and return URL
      if (this.r2Service) {
        try {
          const audioUrl = await this.r2Service.uploadAudioFile(audioBase64, 'busy', 'message');
          console.log('✅ Apology message uploaded to R2:', audioUrl);
          return audioUrl;
        } catch (r2Error) {
          console.warn('⚠️ R2 upload failed, falling back to data URI:', r2Error);
          return this.convertToDataUri(audioBase64);
        }
      }

      // Fallback to data URI
      return this.convertToDataUri(audioBase64);
    } catch (error) {
      console.error('❌ Hume TTS apology message failed:', error);
      throw error;
    }
  }

  /**
   * Safe Hume TTS generation with multiple fallback attempts
   * Returns null if all attempts fail
   */
  async generateSafeMessage(
    messageType: 'out_of_hours' | 'busy' | 'connecting' | 'emergency',
    callerName?: string
  ): Promise<string | null> {
    try {
      console.log(`🎵 Generating safe Hume TTS for: ${messageType}`);
      
      switch (messageType) {
        case 'out_of_hours':
          return await this.generateOutOfHoursGreeting(callerName);
        case 'busy':
          return await this.generateBusyGreeting(callerName);
        case 'connecting':
          return await this.generateConnectingGreeting(callerName);
        case 'emergency':
          return await this.generateEmergencyMessage();
        default:
          throw new Error(`Unknown message type: ${messageType}`);
      }
    } catch (error) {
      console.warn(`⚠️ First attempt failed for ${messageType}, trying without personalization:`, error);
      
      // Second attempt without personalization
      try {
        switch (messageType) {
          case 'out_of_hours':
            return await this.generateOutOfHoursGreeting();
          case 'busy':
            return await this.generateBusyGreeting();
          case 'connecting':
            return await this.generateConnectingGreeting();
          case 'emergency':
            return await this.generateEmergencyMessage();
          default:
            return null;
        }
      } catch (fallbackError) {
        console.error(`❌ All Hume TTS attempts failed for ${messageType}:`, fallbackError);
        return null;
      }
    }
  }

  /**
   * Core text synthesis method using your exact working format
   */
  private async synthesizeText(text: string): Promise<string> {
    try {
      console.log('🎵 Generating Hume TTS using SDK method...');
      
      // BYPASS SDK - Use direct REST API call with exact Hume docs format
      console.log('🌐 Making direct REST API call to Hume TTS...');
      
      const requestBody = {
        utterances: [{
          description: "A polished, professional British voice speaking clearly with a calm and sophisticated tone, authoritative yet warm and approachable, perfect for customer service",
          text: text
        }]
      };

      console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

      const apiResponse = await fetch('https://api.hume.ai/v0/tts', {
        method: 'POST',
        headers: {
          'X-Hume-Api-Key': process.env.HUME_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 API Response status:', apiResponse.status);
      console.log('📡 API Response headers:', Object.fromEntries(apiResponse.headers.entries()));

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('❌ Hume API HTTP error:', {
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          errorBody: errorText
        });
        throw new Error(`Hume API HTTP error: ${apiResponse.status} - ${errorText}`);
      }

      const response = await apiResponse.json();
      
      console.log('📥 Hume TTS raw response:', {
        responseType: typeof response,
        isNull: response === null,
        isUndefined: response === undefined,
        responseKeys: response ? Object.keys(response) : 'No keys - response is falsy'
      });

      if (!response) {
        throw new Error('Hume API returned null/undefined response');
      }

      console.log('📥 Hume TTS response received:', {
        hasGenerations: !!response.generations,
        generationsLength: response.generations?.length || 0,
        firstGeneration: response.generations?.[0] ? 'exists' : 'missing'
      });

      // Extract audio using your exact format
      const audio = response.generations[0].audio;
      
      if (!audio) {
        throw new Error('No audio returned in response');
      }

      console.log('✅ Hume TTS generation successful:', {
        audioLength: audio.length,
        audioPreview: audio.substring(0, 50) + '...'
      });
      
      return audio;
    } catch (error) {
      console.error('❌ Hume TTS error:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Helper method to convert audio to data URI for TwiML embedding
  convertToDataUri(audioBase64: string): string {
    return `data:audio/wav;base64,${audioBase64}`;
  }

  // Helper method to check if data URI is too large for TwiML
  isDataUriTooLarge(dataUri: string, maxSizeKB: number = 100): boolean {
    const sizeKB = dataUri.length / 1024; // Data URI size in KB
    console.log('📊 Data URI size check:', {
      dataUriLength: dataUri.length,
      sizeKB: Math.round(sizeKB * 100) / 100,
      maxSizeKB,
      tooLarge: sizeKB > maxSizeKB
    });
    return sizeKB > maxSizeKB;
  }
} 