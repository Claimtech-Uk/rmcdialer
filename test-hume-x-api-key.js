// Test Hume API with X-API-Key header
const apiKey = '80pkP7I3YiuV4uviFEccPEhucGwtmq2XRm0ktPMwW7MCLUMG';

async function testHumeWithXApiKey() {
  console.log('🧪 Testing Hume TTS with X-API-Key header...\n');

  const requestBody = {
    utterances: [{
      description: "Conversational English Guy",
      text: "Hello, this is a test of the Hume TTS API."
    }]
  };

  console.log('📤 Request:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch('https://api.hume.ai/v0/tts', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('\n📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('\n📥 Response body:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('\n✅ SUCCESS! Audio generated.');
      console.log('Response structure:', {
        hasGenerations: !!data.generations,
        generationsCount: data.generations?.length || 0
      });
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

testHumeWithXApiKey(); 