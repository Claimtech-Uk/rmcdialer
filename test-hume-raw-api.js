// Test Hume API with exact SDK-like implementation
const apiKey = '80pkP7I3YiuV4uviFEccPEhucGwtmq2XRm0ktPMwW7MCLUMG';

async function testHumeRawAPI() {
  console.log('🧪 Testing Hume API with SDK-like implementation\n');

  const requestBody = {
    utterances: [{
      description: "Conversational English Guy",
      text: "Hello, this is a test of the Hume TTS API."
    }]
  };

  // Try different authentication approaches that the SDK might use
  const authMethods = [
    { name: 'X-Hume-Api-Key', headers: { 'X-Hume-Api-Key': apiKey } },
    { name: 'x-hume-api-key (lowercase)', headers: { 'x-hume-api-key': apiKey } },
    { name: 'X-API-Key', headers: { 'X-API-Key': apiKey } },
    { name: 'Authorization Bearer', headers: { 'Authorization': `Bearer ${apiKey}` } },
    { name: 'Api-Key', headers: { 'Api-Key': apiKey } }
  ];

  for (const method of authMethods) {
    console.log(`\n📍 Testing ${method.name}:`);
    
    try {
      const response = await fetch('https://api.hume.ai/v0/tts', {
        method: 'POST',
        headers: {
          ...method.headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`  Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('  ✅ SUCCESS! Response structure:', {
          hasGenerations: !!data.generations,
          generationsCount: data.generations?.length || 0
        });
        
        // Save the working method
        console.log('\n🎉 WORKING AUTHENTICATION METHOD FOUND!');
        console.log(`Use header: ${JSON.stringify(method.headers)}`);
        
        // Save audio
        if (data.generations?.[0]?.audio) {
          const fs = require('fs');
          const audioBuffer = Buffer.from(data.generations[0].audio, 'base64');
          fs.writeFileSync('working-output.wav', audioBuffer);
          console.log('💾 Audio saved to working-output.wav');
        }
        
        break;
      } else {
        const errorText = await response.text();
        console.log(`  Error: ${errorText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`  Network error: ${error.message}`);
    }
  }
}

testHumeRawAPI(); 