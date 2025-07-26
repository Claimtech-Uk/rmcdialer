import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ConversationEngineService, HumeTTSService, AudioStorageService, voiceProfiles } from '@/modules/ai-voice-agent';
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
     const audioStorage = new AudioStorageService(new URL(request.url).origin);

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

     // Generate speech using Hume TTS with voice description
     console.log(`🎵 Generating speech with Hume TTS (voice: ${selectedVoice.voiceDescription ? 'custom' : 'dynamic'})...`);
     const audioResponse = await humeTTS.synthesizeText(aiResponseText);
     
     // Generate follow-up questions with Hume voice (shorter text)
     const followUpText = "Anything else?";
     const followUpAudio = await humeTTS.synthesizeText(followUpText);
     
     const closingText = "Thank you for calling!";
     const closingAudio = await humeTTS.synthesizeText(closingText);
     
     // Convert to data URIs but check size first
     const responseDataUri = `data:audio/wav;base64,${audioResponse.audio}`;
     const followUpDataUri = `data:audio/wav;base64,${followUpAudio.audio}`;
     const closingDataUri = `data:audio/wav;base64,${closingAudio.audio}`;
     
     const totalSize = Math.round((audioResponse.audio.length + followUpAudio.audio.length + closingAudio.audio.length)/1024);
     console.log(`🎵 Generated response data URIs (response: ${Math.round(audioResponse.audio.length/1024)}KB, followup: ${Math.round(followUpAudio.audio.length/1024)}KB, closing: ${Math.round(closingAudio.audio.length/1024)}KB, total: ${totalSize}KB)`);
     
     // If too large, fall back to Polly
     if (totalSize > 800) {
       console.log(`⚠️ Response data URIs too large (${totalSize}KB), falling back to Polly to avoid TwiML size limits`);
       const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
     <Say voice="Polly.Joanna">${aiResponseText}</Say>
     <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/webhooks/twilio/voice-response" method="POST">
         <Say voice="Polly.Joanna">Anything else?</Say>
     </Gather>
     <Say voice="Polly.Joanna">Thank you for calling!</Say>
     <Hangup/>
</Response>`;
       return new NextResponse(twimlResponse, {
         status: 200,
         headers: {
           'Content-Type': 'application/xml',
         },
       });
     }
     
     console.log(`🔗 Using data URIs for response (size OK: ${totalSize}KB)`);
     
     // Use Hume-generated audio via data URIs (if size is acceptable)
     const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
     <Play>${responseDataUri}</Play>
     <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/webhooks/twilio/voice-response" method="POST">
         <Play>${followUpDataUri}</Play>
     </Gather>
     <Play>${closingDataUri}</Play>
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