import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ConversationEngineService, HumeTTSService, voiceProfiles } from '@/modules/ai-voice-agent';
import { businessFunctions } from '@/modules/ai-voice-agent/functions/business-functions';

// Twilio Speech Recognition Webhook Schema
const TwilioSpeechSchema = z.object({
  CallSid: z.string(),
  From: z.string(),
  To: z.string(),
  SpeechResult: z.string().optional(),
  Confidence: z.string().optional(),
  UnstableSpeechResult: z.string().optional(),
  Digits: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('🎤 Voice response webhook received');
    
    // Parse form data from Twilio
    const formData = await request.formData();
    const data = Object.fromEntries(formData.entries());
    const parsed = TwilioSpeechSchema.parse(data);
    
    console.log('📝 Speech recognition result:', {
      callSid: parsed.CallSid,
      speechResult: parsed.SpeechResult,
      confidence: parsed.Confidence
    });

    // Get user speech input
    const userInput = parsed.SpeechResult || parsed.UnstableSpeechResult;
    
    if (!userInput) {
             // No speech detected, ask again
       const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
     <Say voice="Polly.Joanna">I'm sorry, I didn't catch that. Could you please repeat what you need help with?</Say>
     <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/webhooks/twilio/voice-response" method="POST">
         <Say voice="Polly.Joanna">Please tell me how I can help you today.</Say>
     </Gather>
     <Say voice="Polly.Joanna">Let me transfer you to one of our agents.</Say>
    <Dial timeout="30">
        <Queue>support</Queue>
    </Dial>
</Response>`;
      
      return new NextResponse(twimlResponse, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    }

    // Initialize AI services
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const humeApiKey = process.env.HUME_API_KEY;

    if (!openaiApiKey || !humeApiKey) {
      throw new Error('Missing required API keys');
    }

    // Select voice based on call context
    let selectedVoice = voiceProfiles.default;
    const currentHour = new Date().getHours();
    if (currentHour >= 18 || currentHour <= 8) {
      selectedVoice = voiceProfiles.calm;
    }

    // Initialize services
    const conversationEngine = new ConversationEngineService(openaiApiKey);
    const humeTTS = new HumeTTSService(humeApiKey, selectedVoice);

    // Register business functions
    conversationEngine.registerFunctions(businessFunctions);

                   console.log('🤖 Processing conversation with AI...');
     
     // For now, use a simple AI response until we fix the complex type issues
     // TODO: Integrate with full conversation engine
     let aiResponseText = `Thank you for your message: "${userInput}". I'm your AI assistant at RMC Dialler. How can I help you with your claims today?`;
     
     // Simple intent detection for common requests
     if (userInput.toLowerCase().includes('claim')) {
       aiResponseText = "I can help you with your claim. Let me look up your information. Can you please provide your claim reference number?";
     } else if (userInput.toLowerCase().includes('appointment')) {
       aiResponseText = "I'd be happy to schedule an appointment for you. What day and time would work best for you?";
     } else if (userInput.toLowerCase().includes('transfer') || userInput.toLowerCase().includes('agent')) {
       aiResponseText = "I'll transfer you to one of our specialist agents right away.";
     }
     
     console.log('💬 AI Response:', aiResponseText);

     // Generate speech using Hume TTS
     console.log('🎵 Generating speech with Hume TTS...');
     const audioResponse = await humeTTS.synthesizeText(aiResponseText);
     
     // For now, we'll use a placeholder since the Hume API integration needs to be completed
     // In production, you would:
     // 1. Save the audio file to a publicly accessible URL (S3, etc.)
     // 2. Use <Play> to play the audio file
     
          // Temporary fallback - will replace with Hume-generated audio
     const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
     <Say voice="Polly.Joanna">${aiResponseText}</Say>
     <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/webhooks/twilio/voice-response" method="POST">
         <Say voice="Polly.Joanna">Is there anything else I can help you with?</Say>
     </Gather>
     <Say voice="Polly.Joanna">Thank you for calling RMC Dialler. Have a great day!</Say>
    <Hangup/>
</Response>`;

    // TODO: When Hume TTS is fully integrated, use this approach:
    /*
    // Save audio to public URL and play it
    const audioUrl = await saveAudioToPublicUrl(audioResponse.audio);
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioUrl}</Play>
    <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/webhooks/twilio/voice-response" method="POST">
        <Play>${await generateHumeAudio("Is there anything else I can help you with?")}</Play>
    </Gather>
    <Play>${await generateHumeAudio("Thank you for calling RMC Dialler. Have a great day!")}</Play>
    <Hangup/>
</Response>`;
    */

    return new NextResponse(twimlResponse, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });

  } catch (error) {
    console.error('❌ Voice response error:', error);
    
         // Fallback response
     const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
     <Say voice="Polly.Joanna">I'm sorry, I'm experiencing technical difficulties. Let me transfer you to one of our agents.</Say>
    <Dial timeout="30">
        <Queue>support</Queue>
    </Dial>
</Response>`;
    
    return new NextResponse(errorTwiML, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });
  }
}

export async function GET() {
  return new NextResponse('Twilio Voice Response Webhook Endpoint', { status: 200 });
} 