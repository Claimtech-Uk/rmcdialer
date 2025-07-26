// Simple local test for Hume TTS API
// Run with: node test-hume-tts.js

require('dotenv').config();

async function testHumeTTS() {
  console.log('🧪 Testing Hume TTS API locally...\n');

  // Use hardcoded API key for testing
  const apiKey = '80pkP7I3YiuV4uviFEccPEhucGwtmq2XRm0ktPMwW7MCLUMG';

  console.log('🔑 API Key check:', {
    hasKey: !!apiKey,
    keyLength: apiKey.length,
    keyPrefix: apiKey.substring(0, 8) + '...'
  });

  // Test request body (same as production)
  const requestBody = {
    utterances: [{
      description: "Conversational English Guy",
      text: "Hello, this is a test of the Hume TTS API. If you can hear this, it's working correctly!"
    }]
  };

  console.log('\n📤 Request body:');
  console.log(JSON.stringify(requestBody, null, 2));

  try {
    console.log('\n🌐 Making direct REST API call to Hume TTS...');
    
    const apiResponse = await fetch('https://api.hume.ai/v0/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('\n📡 API Response status:', apiResponse.status);
    console.log('📡 API Response headers:', Object.fromEntries(apiResponse.headers.entries()));

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('\n❌ Hume API HTTP error:', {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        errorBody: errorText
      });
      return;
    }

    const response = await apiResponse.json();
    
    console.log('\n📥 Hume TTS raw response:', {
      responseType: typeof response,
      isNull: response === null,
      isUndefined: response === undefined,
      responseKeys: response ? Object.keys(response) : 'No keys - response is falsy'
    });

    if (!response) {
      console.error('❌ Hume API returned null/undefined response');
      return;
    }

    console.log('\n📥 Hume TTS response received:', {
      hasGenerations: !!response.generations,
      generationsLength: response.generations?.length || 0,
      firstGeneration: response.generations?.[0] ? 'exists' : 'missing'
    });

    // Check if generations array exists
    if (!response.generations || !Array.isArray(response.generations)) {
      console.error('❌ Invalid response format: missing generations array');
      console.log('Full response:', JSON.stringify(response, null, 2));
      return;
    }

    // Check if first generation exists
    if (response.generations.length === 0) {
      console.error('❌ No generations returned in response');
      return;
    }

    const generation = response.generations[0];
    if (!generation.audio) {
      console.error('❌ No audio in generation');
      console.log('Generation object:', JSON.stringify(generation, null, 2));
      return;
    }

    console.log('\n✅ SUCCESS! Hume TTS generation completed:', {
      audioLength: generation.audio.length,
      audioPreview: generation.audio.substring(0, 50) + '...',
      generationId: generation.generation_id || 'No ID',
      duration: generation.duration || 'No duration'
    });

    // Optional: Save audio to file for testing
    const fs = require('fs');
    const audioBuffer = Buffer.from(generation.audio, 'base64');
    fs.writeFileSync('test-output.wav', audioBuffer);
    console.log('\n💾 Audio saved to test-output.wav');
    
  } catch (error) {
    console.error('\n❌ Error during API call:', {
      errorType: error.constructor.name,
      errorMessage: error.message,
      errorStack: error.stack
    });
  }
}

// Run the test
testHumeTTS(); 