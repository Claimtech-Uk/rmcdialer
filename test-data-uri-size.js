const dotenv = require('dotenv');

// Load environment variables  
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testDataUriFallback() {
  console.log('🧪 Testing Data URI Fallback Size...\n');

  try {
    // Test Hume TTS generation (like production does)
    console.log('🎵 Generating Hume TTS...');
    
    const response = await fetch('https://api.hume.ai/v0/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hume-Api-Key': process.env.HUME_API_KEY
      },
      body: JSON.stringify({
        utterances: [{
          description: "Conversational English Guy",
          text: "Hello James, welcome to Resolve Your Claim.\n\nPlease hold for just a moment while I connect you to one of our available agents.\n\nThank you for calling!"
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Hume API failed: ${response.status}`);
    }

    const result = await response.json();
    const audioBase64 = result.generations[0].audio;
    
    console.log('✅ Hume TTS successful');
    console.log('📊 Audio base64 length:', audioBase64.length);
    console.log('📊 Estimated MP3 size:', Math.round(audioBase64.length * 0.75 / 1024), 'KB');

    // Convert to data URI (like our fallback does)
    const dataUri = `data:audio/mpeg;base64,${audioBase64}`;
    
    console.log('\n📄 Data URI Stats:');
    console.log('📊 Data URI length:', dataUri.length);
    console.log('📊 Data URI size:', Math.round(dataUri.length / 1024), 'KB');

    // Create sample TwiML (like production does)
    const sampleTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${dataUri}</Play>
    <Dial timeout="30" 
          record="record-from-answer" 
          recordingStatusCallback="https://rmcdialer.vercel.app/api/webhooks/twilio/recording"
          statusCallback="https://rmcdialer.vercel.app/api/webhooks/twilio/call-status"
          statusCallbackEvent="initiated ringing answered completed busy no-answer failed"
          statusCallbackMethod="POST"
          action="https://rmcdialer.vercel.app/api/webhooks/twilio/call-status">
        <Client>
            <Identity>agent_4</Identity>
            <Parameter name="originalCallSid" value="TEST123" />
            <Parameter name="callerPhone" value="+447738585850" />
            <Parameter name="callSessionId" value="test-session" />
            <Parameter name="callerName" value="James Campbell" />
            <Parameter name="userId" value="2064" />
        </Client>
    </Dial>
    <Say voice="alice">I'm sorry, the agent couldn't be reached right now. We'll have someone call you back as soon as possible. Thank you!</Say>
    <Hangup/>
</Response>`;

    console.log('\n📄 TwiML Stats:');
    console.log('📊 TwiML length:', sampleTwiML.length);
    console.log('📊 TwiML size:', Math.round(sampleTwiML.length / 1024), 'KB');

    // Check against TwiML limit (64KB)
    const limitKB = 64;
    const twiMLSizeKB = sampleTwiML.length / 1024;
    
    console.log('\n🎯 TwiML Limit Check:');
    console.log('📏 Limit:', limitKB, 'KB');
    console.log('📏 Actual:', Math.round(twiMLSizeKB), 'KB');
    
    if (twiMLSizeKB < limitKB) {
      console.log('✅ WITHIN LIMIT - Data URI fallback works!');
      console.log('🎉 Current solution is viable');
    } else {
      console.log('❌ EXCEEDS LIMIT - Need R2 or smaller audio');
      console.log('🔧 Must fix R2 public access');
    }

    console.log('\n💡 RECOMMENDATIONS:');
    if (twiMLSizeKB < limitKB) {
      console.log('1. ✅ Current fallback system works fine');
      console.log('2. 🎯 Fix R2 for better performance (optional)');
      console.log('3. 🔄 System auto-switches when R2 works');
    } else {
      console.log('1. 🚨 Must fix R2 public access immediately');
      console.log('2. 🔧 Add bucket policy for public read');
      console.log('3. 📝 Or reduce audio length');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDataUriFallback().catch(console.error); 