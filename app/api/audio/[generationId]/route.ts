import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory storage for audio files
const audioStorage = new Map<string, { 
  audio: string; 
  timestamp: number; 
  mimeType: string 
}>();

export async function GET(
  request: NextRequest,
  { params }: { params: { generationId: string } }
) {
  try {
    const { generationId } = params;
    
    console.log(`🎵 Serving audio for generation: ${generationId}`);
    
    // Retrieve audio from memory storage
    const audioData = audioStorage.get(generationId);
    
    if (!audioData) {
      console.log(`❌ Audio not found for generation: ${generationId}`);
      return new NextResponse('Audio not found', { status: 404 });
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData.audio, 'base64');
    
    console.log(`✅ Serving ${audioBuffer.length} bytes of audio for ${generationId}`);
    
    // Return audio with proper headers for Twilio
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': audioData.mimeType,
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Accept-Ranges': 'bytes',
      },
    });
    
  } catch (error) {
    console.error('Error serving audio:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// Function to store audio in memory (to be called by other services)
export function storeAudio(generationId: string, base64Audio: string, mimeType: string = 'audio/wav'): string {
  audioStorage.set(generationId, {
    audio: base64Audio,
    timestamp: Date.now(),
    mimeType: mimeType
  });
  
  // Clean up old audio files (older than 2 hours)
  const cutoffTime = Date.now() - (2 * 60 * 60 * 1000);
  for (const [id, data] of audioStorage.entries()) {
    if (data.timestamp < cutoffTime) {
      audioStorage.delete(id);
      console.log(`🗑️ Cleaned up old audio: ${id}`);
    }
  }
  
  // Return the public URL
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.API_BASE_URL || 'http://localhost:3000';
    
  return `${baseUrl}/api/audio/${generationId}`;
} 