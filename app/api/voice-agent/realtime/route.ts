// Twilio Media Stream WebSocket Handler
// Main endpoint for handling real-time audio streaming between Twilio and AI services

import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { AudioPipelineService } from '@/modules/ai-voice-agent';
import { voiceProfiles } from '@/modules/ai-voice-agent';
import { businessFunctions } from '@/modules/ai-voice-agent/functions/business-functions';

// Initialize the audio pipeline service
let audioPipeline: AudioPipelineService | null = null;

function getAudioPipeline(): AudioPipelineService {
  if (!audioPipeline) {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const humeApiKey = process.env.HUME_API_KEY;

    if (!openaiApiKey || !humeApiKey) {
      throw new Error('Missing required API keys: OPENAI_API_KEY and/or HUME_API_KEY');
    }

    audioPipeline = new AudioPipelineService(openaiApiKey, humeApiKey, {
      conversation: {
        systemPrompt: `You are a professional and empathetic customer service representative for RMC Dialler, a claims management company. 

Your role is to:
1. Assist customers with their claims and requirements
2. Provide helpful information about their cases  
3. Schedule appointments when needed
4. Escalate complex issues to human agents
5. Maintain a friendly, professional tone at all times

Guidelines:
- Be concise but thorough in your responses
- Always acknowledge the customer's concerns
- Use the available functions to look up specific information
- If you cannot help with something, offer to transfer to a human agent
- Keep responses under 50 words when possible for natural conversation flow
- Use empathetic language and show understanding

Remember: You are speaking, not writing, so use natural conversational language.`,
        maxTurns: 50,
        responseTimeout: 10000,
        silenceTimeout: 3000
      },
      hume: {
        voiceDescription: 'A professional, friendly, and empathetic customer service representative with a British accent',
        format: 'wav',
        instantMode: true
      }
    });

    // Register business functions
    audioPipeline.registerBusinessFunctions(businessFunctions);
  }

  return audioPipeline;
}

// Enhanced caller lookup using existing system logic
async function performEnhancedCallerLookup(phoneNumber: string) {
  try {
    // TODO: Integrate with the existing performEnhancedCallerLookup function
    // For now, return a simplified lookup structure
    return {
      user: {
        id: 12345,
        first_name: 'John',
        last_name: 'Doe',
        phone_number: phoneNumber,
        email_address: 'john.doe@example.com'
      },
      claims: [
        {
          id: 1,
          type: 'motor_vehicle_accident',
          status: 'active',
          lender: 'Insurance Company'
        }
      ],
      requirements: [],
      priorityScore: 75
    };
  } catch (error) {
    console.warn('Could not perform caller lookup:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  return new Response('WebSocket endpoint for Twilio Media Streams. Use WebSocket connection.', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

// Handle WebSocket connections for Twilio Media Streams
// Note: This is a placeholder implementation. In production, you would need to:
// 1. Set up a separate WebSocket server (e.g., using ws or socket.io)
// 2. Or use a service like Vercel's Edge Functions with WebSocket support
// 3. Or implement using a different deployment approach that supports WebSocket upgrades

export async function POST(request: NextRequest) {
  try {
    console.log('🎤 Setting up WebSocket connection for Twilio Media Stream');
    
    // Extract parameters from the request
    const { searchParams } = new URL(request.url);
    const callSid = searchParams.get('callSid') || 'unknown';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    
    // Perform enhanced caller lookup
    const callerInfo = await performEnhancedCallerLookup(from);
    
    // ✨ Customize voice based on call context
    let selectedVoice = voiceProfiles.default; // Use the specific voice ID as default
    
    // Example: Use different emotional tones based on call context
    if (callerInfo?.user) {
      // Returning customer - use empathetic tone
      selectedVoice = voiceProfiles.empathetic;
    } else if (new Date().getHours() >= 18 || new Date().getHours() <= 8) {
      // After hours - use calm, soothing tone
      selectedVoice = voiceProfiles.calm;
    }
    // Could add more logic here:
    // - High priority claims: voiceProfiles.urgent
    // - Complaint calls: voiceProfiles.empathetic
    // - General inquiries: voiceProfiles.default
    
    // Initialize audio pipeline with custom voice
    const audioPipeline = new AudioPipelineService(
      process.env.OPENAI_API_KEY!,
      process.env.HUME_API_KEY!,
      {
        hume: selectedVoice,
        // ... other config
      }
    );

    if (!callSid || !from) {
      console.error('❌ Missing required parameters: callSid or from');
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`📞 Setting up voice agent for call ${callSid} from ${from} to ${to}`);

    // TODO: Initialize WebSocket connection to audio pipeline
    // For now, return success response with connection details
    return new Response(JSON.stringify({
      success: true,
      message: 'Voice agent WebSocket endpoint ready',
      callSid,
      callerInfo: callerInfo?.user ? {
        name: `${callerInfo.user.first_name} ${callerInfo.user.last_name}`,
        phone: from
      } : null,
      // WebSocket URL that Twilio should connect to
      // This would be implemented as a separate WebSocket server
      websocketUrl: `wss://${request.headers.get('host')}/voice-agent/ws?callSid=${callSid}&from=${from}&to=${to || ''}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to set up voice agent connection:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to set up voice agent connection',
      details: error instanceof Error ? error.message : String(error)
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Export WebSocket handler for Next.js
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; 