// Audio Storage Service
// Handles saving and serving Hume-generated audio files

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

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
      
      // Import the storeAudio function and store the audio
      const { storeAudio } = await import('@/app/api/audio/[generationId]/route');
      const audioUrl = storeAudio(generationId, base64Audio, 'audio/wav');
      
      console.log(`💾 Stored Hume audio: ${audioUrl} (${Math.round(base64Audio.length / 1024)}KB)`);
      
      return audioUrl;
      
    } catch (error) {
      console.error('Failed to store audio:', error);
      throw new Error('Audio storage failed');
    }
  }

  /**
   * Cleanup function - handled automatically by the audio API endpoint
   */
  async cleanupOldFiles(olderThanMinutes: number = 60): Promise<void> {
    // Cleanup is handled automatically by the audio endpoint
    console.log('🧹 Audio cleanup handled automatically by API endpoint');
  }
} 