// Hume Text-to-Speech Service
// Handles text-to-speech synthesis using Hume's TTS API

import { HumeClient } from 'hume';
import { HumeTTSChunk, AudioStreamError } from '../types/audio-streaming.types';

export class HumeTTSService {
  private hume: HumeClient;
  private voiceId?: string;
  private voiceDescription?: string;

  constructor(apiKey: string, voiceConfig?: { voiceId?: string; voiceDescription?: string }) {
    this.hume = new HumeClient({ apiKey });
    this.voiceId = voiceConfig?.voiceId;
    this.voiceDescription = voiceConfig?.voiceDescription || 'A professional, friendly, and empathetic customer service representative';
  }

  /**
   * Convert text to speech using Hume TTS
   */
  async synthesizeText(text: string): Promise<HumeTTSChunk> {
    try {
      console.log(`🎵 Synthesizing text with Hume TTS: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

      // TODO: Fix Hume API integration - using placeholder for now
      // const utterances = [{
      //   text: text.trim(),
      //   ...(this.voiceId ? { voice: { name: this.voiceId } } : {}),
      //   ...(this.voiceDescription ? { description: this.voiceDescription } : {})
      // }];

      // Placeholder response - will implement proper Hume API integration
      return {
        audio: Buffer.from('placeholder audio').toString('base64'),
        generationId: `gen_${Date.now()}`,
        duration: 1000,
        isComplete: true
      };

    } catch (error) {
      console.error('Hume TTS synthesis error:', error);
      
      throw {
        type: 'hume_error',
        message: 'Failed to synthesize speech',
        details: error,
        timestamp: new Date(),
        sessionId: 'unknown', // Will be filled by calling service
        recoverable: true
      } as AudioStreamError;
    }
  }

  /**
   * Stream text to speech (for longer responses)
   */
  async* synthesizeTextStreaming(text: string): AsyncGenerator<HumeTTSChunk> {
    try {
      console.log(`🎵 Streaming text synthesis with Hume TTS: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

      // TODO: Implement proper Hume streaming API
      // For now, yield a single chunk
      yield {
        audio: Buffer.from('placeholder streaming audio').toString('base64'),
        generationId: `stream_${Date.now()}`,
        duration: 1000,
        isComplete: false
      };

      // Mark the final chunk as complete
      yield {
        audio: '',
        isComplete: true
      };

    } catch (error) {
      console.error('Hume TTS streaming error:', error);
      
      throw {
        type: 'hume_error',
        message: 'Failed to stream synthesized speech',
        details: error,
        timestamp: new Date(),
        sessionId: 'unknown',
        recoverable: true
      } as AudioStreamError;
    }
  }

  /**
   * Convert audio format for Twilio compatibility
   */
  convertForTwilio(base64Audio: string): Buffer {
    try {
      // Decode base64 audio
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      
      // Convert WAV to μ-law format for Twilio
      return this.convertToMulaw(audioBuffer);
      
    } catch (error) {
      console.error('Audio conversion error:', error);
      throw error;
    }
  }

  /**
   * Convert WAV audio to μ-law format for Twilio
   */
  private convertToMulaw(wavBuffer: Buffer): Buffer {
    // Skip WAV header (44 bytes) and get PCM data
    const pcmData = wavBuffer.slice(44);
    const mulawData = Buffer.alloc(pcmData.length / 2);

    // Convert 16-bit PCM to μ-law
    for (let i = 0; i < pcmData.length; i += 2) {
      const pcmSample = pcmData.readInt16LE(i);
      const mulawSample = this.linearToMulaw(pcmSample);
      mulawData[i / 2] = mulawSample;
    }

    return mulawData;
  }

  /**
   * Convert linear PCM sample to μ-law
   */
  private linearToMulaw(pcmValue: number): number {
    const BIAS = 0x84;
    const CLIP = 32635;
    
    // Get absolute value and sign
    const sign = (pcmValue < 0) ? 0x80 : 0;
    let mag = Math.abs(pcmValue);
    
    // Clip the magnitude
    if (mag > CLIP) mag = CLIP;
    
    // Add bias
    mag += BIAS;
    
    // Find exponent
    let exponent = 7;
    for (let exp = 0; exp < 8; exp++) {
      if (mag <= (33 << exp)) {
        exponent = exp;
        break;
      }
    }
    
    // Find mantissa
    const mantissa = (mag >> (exponent + 3)) & 0x0F;
    
    // Combine sign, exponent, and mantissa
    const mulawValue = sign | (exponent << 4) | mantissa;
    
    // Return inverted value (μ-law convention)
    return ~mulawValue & 0xFF;
  }

  /**
   * Update voice configuration
   */
  updateVoiceConfig(config: { voiceId?: string; voiceDescription?: string }): void {
    this.voiceId = config.voiceId;
    this.voiceDescription = config.voiceDescription;
    console.log(`🎵 Updated Hume TTS voice config:`, config);
  }

  /**
   * Create and save a custom voice
   */
  async createCustomVoice(name: string, generationId: string): Promise<void> {
    try {
      await this.hume.tts.voices.create({
        name,
        generationId
      });
      
      this.voiceId = name;
      console.log(`✅ Created custom voice: ${name}`);
    } catch (error) {
      console.error('Failed to create custom voice:', error);
      throw error;
    }
  }

  /**
   * List available voices
   */
  async listVoices(): Promise<any[]> {
    try {
      // TODO: Fix Hume voices API integration
      // For now, return empty array until we implement proper API
      return [];
    } catch (error) {
      console.error('Failed to list voices:', error);
      return [];
    }
  }
} 