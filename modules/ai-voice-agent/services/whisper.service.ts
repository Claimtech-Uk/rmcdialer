// Whisper Transcription Service
// Handles real-time speech-to-text using OpenAI Whisper

import OpenAI from 'openai';
import { WhisperTranscriptionChunk, AudioStreamError } from '../types/audio-streaming.types';

export class WhisperService {
  private openai: OpenAI;
  private audioBuffer: Buffer[] = [];
  private isProcessing: boolean = false;
  private readonly BUFFER_SIZE = 16000; // 1 second at 16kHz
  private readonly MIN_AUDIO_LENGTH = 8000; // 0.5 seconds minimum

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Add audio chunk to buffer for processing
   */
  addAudioChunk(audioChunk: Buffer, speaker: 'caller' | 'agent'): void {
    this.audioBuffer.push(audioChunk);
    
    // Process when we have enough audio data
    if (this.getTotalBufferSize() >= this.BUFFER_SIZE && !this.isProcessing) {
      this.processBufferedAudio(speaker);
    }
  }

  /**
   * Process accumulated audio buffer through Whisper
   */
  private async processBufferedAudio(speaker: 'caller' | 'agent'): Promise<WhisperTranscriptionChunk | null> {
    if (this.isProcessing || this.audioBuffer.length === 0) {
      return null;
    }

    this.isProcessing = true;

    try {
      // Combine audio chunks
      const combinedAudio = Buffer.concat(this.audioBuffer);
      
      // Clear the buffer
      this.audioBuffer = [];

      // Skip if audio is too short
      if (combinedAudio.length < this.MIN_AUDIO_LENGTH) {
        this.isProcessing = false;
        return null;
      }

      // Convert to WAV format for Whisper
      const wavAudio = this.convertToWav(combinedAudio);

      // Create form data for Whisper API
      const formData = new FormData();
      formData.append('file', new Blob([wavAudio], { type: 'audio/wav' }), 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('language', 'en'); // Default to English, could be configurable

      // Call Whisper API
      const response = await this.openai.audio.transcriptions.create({
        file: new File([wavAudio], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-1',
        response_format: 'verbose_json',
        language: 'en'
      });

      this.isProcessing = false;

      // Return transcription chunk
      if (response.text && response.text.trim().length > 0) {
        return {
          text: response.text.trim(),
          confidence: this.calculateConfidence(response.segments || []),
          timestamp: Date.now(),
          isPartial: false,
          speaker
        };
      }

      return null;

    } catch (error) {
      this.isProcessing = false;
      console.error('Whisper transcription error:', error);
      
      throw {
        type: 'whisper_error',
        message: 'Failed to transcribe audio',
        details: error,
        timestamp: new Date(),
        sessionId: 'unknown', // Will be filled by calling service
        recoverable: true
      } as AudioStreamError;
    }
  }

  /**
   * Force process remaining buffer (e.g., at end of call)
   */
  async flushBuffer(speaker: 'caller' | 'agent'): Promise<WhisperTranscriptionChunk | null> {
    if (this.audioBuffer.length === 0) {
      return null;
    }

    return this.processBufferedAudio(speaker);
  }

  /**
   * Convert μ-law audio from Twilio to WAV format for Whisper
   */
  private convertToWav(mulawAudio: Buffer): Buffer {
    // Convert μ-law to linear PCM
    const pcmData = this.mulawToPcm(mulawAudio);
    
    // Create WAV header
    const wavHeader = this.createWavHeader(pcmData.length);
    
    // Combine header and data
    return Buffer.concat([wavHeader, pcmData]);
  }

  /**
   * Convert μ-law encoded audio to linear PCM
   */
  private mulawToPcm(mulawData: Buffer): Buffer {
    const pcmData = Buffer.alloc(mulawData.length * 2); // 16-bit PCM
    
    for (let i = 0; i < mulawData.length; i++) {
      const mulawValue = mulawData[i];
      const pcmValue = this.mulawToLinear(mulawValue);
      pcmData.writeInt16LE(pcmValue, i * 2);
    }
    
    return pcmData;
  }

  /**
   * Convert single μ-law sample to linear PCM
   */
  private mulawToLinear(mulawValue: number): number {
    const BIAS = 0x84;
    const CLIP = 32635;
    
    mulawValue = ~mulawValue;
    const sign = mulawValue & 0x80;
    const exponent = (mulawValue >> 4) & 0x07;
    const mantissa = mulawValue & 0x0F;
    
    let sample = mantissa << (exponent + 3);
    sample += BIAS;
    if (exponent !== 0) {
      sample += (1 << (exponent + 2));
    }
    
    return sign ? -sample : sample;
  }

  /**
   * Create WAV file header
   */
  private createWavHeader(dataLength: number): Buffer {
    const buffer = Buffer.alloc(44);
    
    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(dataLength + 36, 4);
    buffer.write('WAVE', 8);
    
    // Format chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Chunk size
    buffer.writeUInt16LE(1, 20);  // Audio format (PCM)
    buffer.writeUInt16LE(1, 22);  // Number of channels
    buffer.writeUInt32LE(8000, 24); // Sample rate (Twilio uses 8kHz)
    buffer.writeUInt32LE(16000, 28); // Byte rate
    buffer.writeUInt16LE(2, 32);  // Block align
    buffer.writeUInt16LE(16, 34); // Bits per sample
    
    // Data chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);
    
    return buffer;
  }

  /**
   * Calculate confidence score from Whisper segments
   */
  private calculateConfidence(segments: any[]): number {
    if (segments.length === 0) return 0.8; // Default confidence
    
    const avgConfidence = segments.reduce((sum, segment) => {
      return sum + (segment.avg_logprob || 0);
    }, 0) / segments.length;
    
    // Convert log probability to confidence (rough approximation)
    return Math.max(0, Math.min(1, Math.exp(avgConfidence)));
  }

  /**
   * Get total size of audio buffer
   */
  private getTotalBufferSize(): number {
    return this.audioBuffer.reduce((total, chunk) => total + chunk.length, 0);
  }

  /**
   * Clear audio buffer
   */
  clearBuffer(): void {
    this.audioBuffer = [];
    this.isProcessing = false;
  }
} 