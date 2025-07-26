// Debug Hume API authentication issue
const { HumeClient } = require('hume');

async function debugHumeAPI() {
  console.log('🔍 Debugging Hume API Authentication\n');

  const apiKey = '80pkP7I3YiuV4uviFEccPEhucGwtmq2XRm0ktPMwW7MCLUMG';
  
  try {
    const hume = new HumeClient({ apiKey });
    console.log('✅ HumeClient created successfully');
    
    console.log('\n🎯 Attempting synthesizeJson...');
    
    const result = await hume.tts.synthesizeJson({
      utterances: [{
        description: "Conversational English Guy",
        text: "Hello, this is a test of the Hume TTS API."
      }]
    });

    console.log('\n✅ SUCCESS! TTS worked!');
    console.log('Result:', {
      hasGenerations: !!result.generations,
      generationsCount: result.generations?.length || 0,
      audioLength: result.generations?.[0]?.audio?.length || 0
    });

    // Save the audio if successful
    if (result.generations?.[0]?.audio) {
      const fs = require('fs');
      const audioBuffer = Buffer.from(result.generations[0].audio, 'base64');
      fs.writeFileSync('success-output.wav', audioBuffer);
      console.log('\n💾 Audio saved to success-output.wav');
    }

  } catch (error) {
    console.error('\n❌ Detailed Error Information:');
    console.error('  Error type:', error.constructor.name);
    console.error('  Message:', error.message);
    
    // Check if it's an API error with response details
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Status Text:', error.response.statusText);
      console.error('  Headers:', error.response.headers);
    }
    
    if (error.body) {
      console.error('  Response body:', error.body);
    }
    
    if (error.cause) {
      console.error('  Cause:', error.cause);
    }
    
    // Full error object
    console.error('\n  Full error object:');
    console.error(JSON.stringify(error, null, 2));
    
    // Stack trace
    console.error('\n  Stack trace:');
    console.error(error.stack);
  }
}

debugHumeAPI(); 