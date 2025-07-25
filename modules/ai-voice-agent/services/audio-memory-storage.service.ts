// Simple in-memory storage for audio files
const audioStorage = new Map<string, { 
  audio: string; 
  timestamp: number; 
  mimeType: string 
}>();

export class AudioMemoryStorageService {
  static storeAudio(generationId: string, base64Audio: string, mimeType: string = 'audio/wav'): string {
    audioStorage.set(generationId, {
      audio: base64Audio,
      timestamp: Date.now(),
      mimeType: mimeType
    });
    
    // Clean up old audio files (older than 2 hours)
    AudioMemoryStorageService.cleanup();
    
    // Return the public URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.API_BASE_URL || 'http://localhost:3000';
      
    return `${baseUrl}/api/audio/${generationId}`;
  }

  static getAudio(generationId: string): { audio: string; timestamp: number; mimeType: string } | undefined {
    return audioStorage.get(generationId);
  }

  static cleanup(): void {
    const cutoffTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours
    for (const [id, data] of audioStorage.entries()) {
      if (data.timestamp < cutoffTime) {
        audioStorage.delete(id);
        console.log(`🗑️ Cleaned up old audio: ${id}`);
      }
    }
  }
} 