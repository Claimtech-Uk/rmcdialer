import { NextRequest, NextResponse } from 'next/server';
import { AudioMemoryStorageService } from '@/modules/ai-voice-agent/services/audio-memory-storage.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { generationId: string } }
) {
  try {
    const { generationId } = params;
    
    console.log(`🎵 Serving audio for generation: ${generationId}`);
    
    // Retrieve audio from memory storage
    const audioData = AudioMemoryStorageService.getAudio(generationId);
    
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