// Audio Storage Service
// Handles saving and serving Hume-generated audio files

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export class AudioStorageService {
  private baseUrl: string;
  private audioDir: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.audioDir = join(process.cwd(), 'public', 'audio');
    this.ensureAudioDirectory();
  }

  private async ensureAudioDirectory(): Promise<void> {
    try {
      await mkdir(this.audioDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create audio directory:', error);
    }
  }

  /**
   * Save base64 audio data to a publicly accessible file
   */
  async saveAudioFile(base64Audio: string, generationId: string): Promise<string> {
    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      
      // Generate filename
      const filename = `hume_${generationId}_${Date.now()}.wav`;
      const filePath = join(this.audioDir, filename);
      
      // Save file
      await writeFile(filePath, audioBuffer);
      
      // Return public URL
      const publicUrl = `${this.baseUrl}/audio/${filename}`;
      
      console.log(`💾 Saved Hume audio: ${publicUrl}`);
      return publicUrl;
      
    } catch (error) {
      console.error('Failed to save audio file:', error);
      throw new Error('Audio storage failed');
    }
  }

  /**
   * Clean up old audio files (optional - could be run periodically)
   */
  async cleanupOldFiles(olderThanMinutes: number = 60): Promise<void> {
    try {
      const { readdir, unlink, stat } = await import('fs/promises');
      const files = await readdir(this.audioDir);
      const cutoffTime = Date.now() - (olderThanMinutes * 60 * 1000);
      
      for (const file of files) {
        if (file.startsWith('hume_') && file.endsWith('.wav')) {
          const filePath = join(this.audioDir, file);
          const stats = await stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await unlink(filePath);
            console.log(`🗑️ Cleaned up old audio file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Audio cleanup failed:', error);
    }
  }
} 