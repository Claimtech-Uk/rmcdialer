import { NextResponse } from 'next/server';
import { SimpleHumeTTSService } from '@/modules/ai-voice-agent/services/simple-hume-tts.service';

/**
 * Generate TwiML response using Hume TTS with safe fallbacks
 */
export async function generateHumeTwiMLResponse(
  messageType: 'out_of_hours' | 'busy' | 'connecting' | 'emergency',
  callerName?: string,
  additionalTwiML?: string
): Promise<NextResponse> {
  try {
    console.log(`🎵 Generating Hume TwiML response for: ${messageType}`);
    
    const humeTTSService = new SimpleHumeTTSService();
    const audioContent = await humeTTSService.generateSafeMessage(messageType, callerName);
    
    if (audioContent) {
      console.log(`✅ Successfully generated Hume TTS for ${messageType}`);
      
      const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioContent}</Play>
    ${additionalTwiML || ''}
    <Hangup/>
</Response>`;
      
      return new NextResponse(twimlContent, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    } else {
      throw new Error('Hume TTS generation failed');
    }
  } catch (error) {
    console.error(`❌ Failed to generate Hume TwiML for ${messageType}:`, error);
    
    // Emergency fallback - minimal TwiML without voice
    const emergencyTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Pause length="2"/>
    ${additionalTwiML || ''}
    <Hangup/>
</Response>`;
    
    return new NextResponse(emergencyTwiML, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });
  }
}

/**
 * Generate TwiML response with Hume TTS and dial functionality
 */
export async function generateHumeDialTwiMLResponse(
  messageType: 'connecting',
  callerName: string | undefined,
  dialConfig: {
    agentClientName: string;
    callSid: string;
    from: string;
    callSessionId: string;
    callerInfo?: any;
    recordingCallbackUrl: string;
    statusCallbackUrl: string;
    dialActionUrl: string;
  }
): Promise<NextResponse> {
  try {
    console.log(`🎵 Generating Hume dial TwiML response for: ${messageType}`);
    
    const humeTTSService = new SimpleHumeTTSService();
    const audioContent = await humeTTSService.generateSafeMessage(messageType, callerName);
    
    if (audioContent) {
      console.log(`✅ Successfully generated Hume TTS dial response for ${messageType}`);
      
      const twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioContent}</Play>
    <Dial timeout="30" 
          record="record-from-answer" 
          recordingStatusCallback="${dialConfig.recordingCallbackUrl}"
          statusCallback="${dialConfig.statusCallbackUrl}"
          statusCallbackEvent="initiated ringing answered completed busy no-answer failed"
          statusCallbackMethod="POST"
          action="${dialConfig.dialActionUrl}">
        <Client>
            <Identity>${dialConfig.agentClientName}</Identity>
            <Parameter name="originalCallSid" value="${dialConfig.callSid}" />
            <Parameter name="callerPhone" value="${dialConfig.from}" />
            <Parameter name="callSessionId" value="${dialConfig.callSessionId}" />
            ${dialConfig.callerInfo?.user ? `<Parameter name="callerName" value="${dialConfig.callerInfo.user.first_name} ${dialConfig.callerInfo.user.last_name}" />` : ''}
            ${dialConfig.callerInfo?.user ? `<Parameter name="userId" value="${dialConfig.callerInfo.user.id}" />` : ''}
        </Client>
    </Dial>
</Response>`;
      
      return new NextResponse(twimlContent, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    } else {
      throw new Error('Hume TTS generation failed for dial response');
    }
  } catch (error) {
    console.error(`❌ Failed to generate Hume dial TwiML:`, error);
    
    // Fallback - try emergency Hume message with dial
    try {
      const emergencyHumeTTSService = new SimpleHumeTTSService();
      const emergencyAudio = await emergencyHumeTTSService.generateEmergencyMessage();
      
      const fallbackTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${emergencyAudio}</Play>
    <Dial timeout="30" 
          record="record-from-answer" 
          recordingStatusCallback="${dialConfig.recordingCallbackUrl}"
          statusCallback="${dialConfig.statusCallbackUrl}"
          statusCallbackEvent="initiated ringing answered completed busy no-answer failed"
          statusCallbackMethod="POST"
          action="${dialConfig.dialActionUrl}">
        <Client>
            <Identity>${dialConfig.agentClientName}</Identity>
            <Parameter name="originalCallSid" value="${dialConfig.callSid}" />
            <Parameter name="callerPhone" value="${dialConfig.from}" />
            <Parameter name="callSessionId" value="${dialConfig.callSessionId}" />
            ${dialConfig.callerInfo?.user ? `<Parameter name="callerName" value="${dialConfig.callerInfo.user.first_name} ${dialConfig.callerInfo.user.last_name}" />` : ''}
            ${dialConfig.callerInfo?.user ? `<Parameter name="userId" value="${dialConfig.callerInfo.user.id}" />` : ''}
        </Client>
    </Dial>
</Response>`;
      
      return new NextResponse(fallbackTwiML, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    } catch (emergencyError) {
      console.error(`❌ Emergency Hume TTS also failed:`, emergencyError);
      
      // Absolute emergency fallback - minimal TwiML with pause and dial
      const absoluteFallbackTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Pause length="2"/>
    <Dial timeout="30" 
          record="record-from-answer" 
          recordingStatusCallback="${dialConfig.recordingCallbackUrl}"
          statusCallback="${dialConfig.statusCallbackUrl}"
          statusCallbackEvent="initiated ringing answered completed busy no-answer failed"
          statusCallbackMethod="POST"
          action="${dialConfig.dialActionUrl}">
        <Client>
            <Identity>${dialConfig.agentClientName}</Identity>
            <Parameter name="originalCallSid" value="${dialConfig.callSid}" />
            <Parameter name="callerPhone" value="${dialConfig.from}" />
            <Parameter name="callSessionId" value="${dialConfig.callSessionId}" />
            ${dialConfig.callerInfo?.user ? `<Parameter name="callerName" value="${dialConfig.callerInfo.user.first_name} ${dialConfig.callerInfo.user.last_name}" />` : ''}
            ${dialConfig.callerInfo?.user ? `<Parameter name="userId" value="${dialConfig.callerInfo.user.id}" />` : ''}
        </Client>
    </Dial>
</Response>`;
      
      return new NextResponse(absoluteFallbackTwiML, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      });
    }
  }
} 