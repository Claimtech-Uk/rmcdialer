// Twilio Media Stream WebSocket endpoint for EVI integration
// Handles real-time audio streaming between Twilio and Hume EVI

import { NextRequest } from 'next/server';
import { WebSocketServer } from 'ws';
import { TwilioEVIBridge, TwilioMediaMessage } from '@/modules/ai-voice-agent/services/twilio-evi-bridge.service';
import { ComprehensiveBusinessContext } from '@/modules/ai-voice-agent/services/hume-evi.service';

// Global bridge instance (in production, consider using Redis or similar for scaling)
let evibridge: TwilioEVIBridge | null = null;

export async function GET(request: NextRequest) {
  try {
    console.log('🎤 EVI Stream WebSocket endpoint accessed');

    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const callSid = searchParams.get('callSid');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const userId = searchParams.get('userId');
    const callerName = searchParams.get('callerName');

    if (!callSid || !from) {
      return new Response('Missing required parameters: callSid, from', { status: 400 });
    }

    const humeApiKey = process.env.HUME_API_KEY;
    if (!humeApiKey) {
      console.error('❌ Missing HUME_API_KEY environment variable');
      return new Response('Server configuration error', { status: 500 });
    }

    // Initialize bridge if needed
    if (!evibridge) {
      evibridge = new TwilioEVIBridge(humeApiKey);
      console.log('🌉 EVI Bridge initialized');
    }

    // Check if this is a WebSocket upgrade request
    const upgrade = request.headers.get('upgrade');
    if (upgrade !== 'websocket') {
      return new Response(
        'This endpoint requires WebSocket connection. ' +
        `Use: wss://your-domain/api/voice-agent/evi-stream?callSid=${callSid}&from=${encodeURIComponent(from)}`,
        { status: 426, headers: { 'Upgrade': 'websocket' } }
      );
    }

    // Create business context
    const businessContext: ComprehensiveBusinessContext = {
      callSid,
      callerPhone: from,
      callerName: callerName || undefined,
      userId: userId ? parseInt(userId) : undefined,
    };

    console.log(`🚀 Starting EVI stream for call ${callSid} from ${from}`);

    // Return response indicating WebSocket handling
    // Note: The actual WebSocket upgrade is handled by the WebSocket server
    return new Response('WebSocket connection initiated', { 
      status: 101,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade'
      }
    });

  } catch (error) {
    console.error('❌ EVI Stream endpoint error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// WebSocket server for handling media streams
// This needs to be set up separately in a Node.js environment
export async function POST(request: NextRequest) {
  return new Response('Use WebSocket connection for media streaming', { status: 405 });
}

// WebSocket handling is done externally in a Node.js environment
// This Next.js API route provides the endpoint information for WebSocket connections 