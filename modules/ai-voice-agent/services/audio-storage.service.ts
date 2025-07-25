// Audio Storage Service
// Handles saving and serving Hume-generated audio files

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export class AudioStorageService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Remove file system operations for Vercel compatibility
  }

  /**
   * Save audio file to memory and return data URL for Vercel compatibility
   * Instead of writing to disk, we'll return a data URL that can be used directly
   */
  async saveAudioFile(base64Audio: string, generationId: string): Promise<string> {
    try {
      // Validate base64 audio
      if (!base64Audio || typeof base64Audio !== 'string') {
        throw new Error('Invalid base64 audio data');
      }
      
      // For Vercel serverless, return data URL directly
      // This works with Twilio's <Play> verb
      const dataUrl = `data:audio/wav;base64,${base64Audio}`;
      
      console.log(`💾 Created data URL for Hume audio: ${generationId} (${Math.round(base64Audio.length / 1024)}KB)`);
      
      return dataUrl;
      
    } catch (error) {
      console.error('Failed to process audio data:', error);
      throw new Error('Audio processing failed');
    }
  }

  /**
   * Cleanup function - no-op for data URLs
   */
  async cleanupOldFiles(olderThanMinutes: number = 60): Promise<void> {
    // No cleanup needed for data URLs
    console.log('🧹 No cleanup needed for data URLs');
  }
} 