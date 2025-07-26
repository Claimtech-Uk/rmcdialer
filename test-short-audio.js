const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testShortAudio() {
  console.log('🧪 Testing Short Audio for TwiML Limits...\n');

  try {
    // Test with much shorter text
    const shortText = "Hello, connecting you now.";
    
    console.log('🎵 Generating short Hume TTS...');
    console.log('📝 Text:', shortText);
    
    const response = await fetch('https://api.hume.ai/v0/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hume-Api-Key': process.env.HUME_API_KEY
      },
      body: JSON.stringify({
        utterances: [{
          description: "Conversational English Guy",
          text: shortText
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

    // Convert to data URI
    const dataUri = `data:audio/mpeg;base64,${audioBase64}`;
    
    console.log('\n📄 Data URI Stats:');
    console.log('📊 Data URI length:', dataUri.length);
    console.log('📊 Data URI size:', Math.round(dataUri.length / 1024), 'KB');

    // Create minimal TwiML
    const twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${dataUri}</Play>
    <Dial timeout="30">
        <Client><Identity>agent_4</Identity></Client>
    </Dial>
</Response>`;

    console.log('\n📄 TwiML Stats:');
    console.log('📊 TwiML length:', twiML.length);
    console.log('📊 TwiML size:', Math.round(twiML.length / 1024), 'KB');

    // Check limit
    const limitKB = 64;
    const twiMLSizeKB = twiML.length / 1024;
    
    console.log('\n🎯 TwiML Limit Check:');
    console.log('📏 Limit:', limitKB, 'KB');
    console.log('📏 Actual:', Math.round(twiMLSizeKB), 'KB');
    
    if (twiMLSizeKB < limitKB) {
      console.log('✅ SHORT AUDIO WORKS!');
      console.log('💡 Could use shorter greetings as interim solution');
    } else {
      console.log('❌ Even short audio too big - MUST fix R2');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testShortAudio().catch(console.error); 