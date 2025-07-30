import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { 
  handleInboundCall, 
  generateTwiMLResponse,
  shouldUseAIAgent,
  logCallEvent 
} from '@/modules/twilio-voice';

/**
 * Main Twilio Voice webhook handler
 * Refactored from 1367 lines to ~100 lines!
 * All business logic has been extracted to modules for better maintainability
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📞 Twilio Voice webhook received');
    
    // Emergency agent seeding check - ensure at least one agent exists
    const agentCount = await prisma.agent.count();
    if (agentCount === 0) {
      console.warn('⚠️ No agents found in database - creating emergency fallback agent');
      try {
        const bcrypt = require('bcryptjs');
        const emergencyAgent = await prisma.agent.create({
          data: {
            email: 'emergency@system.local',
            passwordHash: await bcrypt.hash('emergency123', 12),
            firstName: 'Emergency',
            lastName: 'Agent',
            role: 'agent',
            isActive: true,
            isAiAgent: false
          }
        });
        console.log(`✅ Created emergency agent with ID ${emergencyAgent.id}`);
      } catch (seedError) {
        console.error('❌ Failed to create emergency agent:', seedError);
      }
    }

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData = Object.fromEntries(formData.entries());
    
    console.log('📋 ALL Webhook data:', JSON.stringify(webhookData, null, 2));

    // Extract key fields
    const to = webhookData.To as string;
    const from = webhookData.From as string;
    const direction = webhookData.Direction as string;
    const callSid = webhookData.CallSid as string;

    console.log(`📞 Call ${callSid}`);
    console.log(`🎯 Direction: ${direction}`);
    console.log(`📱 From: ${from}`);
    console.log(`📱 To: ${to}`);

    // Check if this is a Voice SDK call (From starts with "client:")
    const isVoiceSDKCall = from && from.startsWith('client:');
    console.log(`🔍 Is Voice SDK call: ${isVoiceSDKCall}`);

    // For Voice SDK calls, look for target number in call parameters
    let targetPhoneNumber: string | null = null;
    if (isVoiceSDKCall) {
      // The target number should be in the call parameters
      targetPhoneNumber = (webhookData.To || webhookData.Called || webhookData.targetNumber) as string;
      console.log(`🎯 Target from parameters: ${targetPhoneNumber}`);
    }

    // Handle inbound calls differently - delegate to the service
    if (direction === 'inbound' && !isVoiceSDKCall) {
      return await handleInboundCall(callSid, from, to, webhookData);
    }

    // Return TwiML response for outbound calls
    const twimlResponse = generateTwiMLResponse(direction, webhookData, Boolean(isVoiceSDKCall), targetPhoneNumber);
    
    return new NextResponse(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });

  } catch (error: any) {
    console.error('❌ Twilio voice webhook error:', error);
    
    // Return error TwiML
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, there was an error processing your call. Please try again later.</Say>
    <Hangup/>
</Response>`;

    return new NextResponse(errorTwiML, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
}

// Handle GET requests (for testing)
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Twilio Voice webhook endpoint ready',
    timestamp: new Date(),
    endpoint: 'POST /api/webhooks/twilio/voice'
  });
} 