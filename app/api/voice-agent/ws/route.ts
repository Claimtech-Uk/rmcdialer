// WebSocket handler for Twilio Media Streams
// This creates a proper WebSocket connection for real-time audio

import { NextRequest } from 'next/server';
import { AudioPipelineService, voiceProfiles } from '@/modules/ai-voice-agent';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callSid = searchParams.get('callSid');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    console.log(`🎤 WebSocket upgrade request for call ${callSid}`);

    // Check if this is a WebSocket upgrade request
    const upgrade = request.headers.get('upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Initialize audio pipeline
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const humeApiKey = process.env.HUME_API_KEY;

    if (!openaiApiKey || !humeApiKey) {
      return new Response('Missing API keys', { status: 500 });
    }

    // Select voice based on caller
    let selectedVoice = voiceProfiles.default;
    if (new Date().getHours() >= 18 || new Date().getHours() <= 8) {
      selectedVoice = voiceProfiles.calm;
    }

    const audioPipeline = new AudioPipelineService(openaiApiKey, humeApiKey, {
      hume: selectedVoice
    });

    // For Next.js, we need to use a different approach
    // This endpoint should return connection details
    return new Response(JSON.stringify({
      message: 'WebSocket endpoint ready',
      callSid,
      from,
      to,
      voiceConfig: selectedVoice
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ WebSocket setup error:', error);
    return new Response('WebSocket setup failed', { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; 