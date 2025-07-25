// Audio Storage Service
// Handles saving and serving Hume-generated audio files

import { AudioMemoryStorageService } from './audio-memory-storage.service';

export class AudioStorageService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Store audio in memory and return API endpoint URL for Twilio
   */
  async saveAudioFile(base64Audio: string, generationId: string): Promise<string> {
    try {
      // Validate base64 audio
      if (!base64Audio || typeof base64Audio !== 'string') {
        throw new Error('Invalid base64 audio data');
      }
      
      // Store the audio and get the URL
      const audioUrl = AudioMemoryStorageService.storeAudio(generationId, base64Audio, 'audio/wav');
      
      console.log(`💾 Stored Hume audio: ${audioUrl} (${Math.round(base64Audio.length / 1024)}KB)`);
      
      return audioUrl;
      
    } catch (error) {
      console.error('Failed to store audio:', error);
      throw new Error('Audio storage failed');
    }
  }

  /**
   * Cleanup function - handled automatically by the audio memory storage service
   */
  async cleanupOldFiles(olderThanMinutes: number = 60): Promise<void> {
    // Cleanup is handled automatically by the audio memory storage service
    AudioMemoryStorageService.cleanup();
    console.log('🧹 Audio cleanup completed');
  }
} 