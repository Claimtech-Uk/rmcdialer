// Test using Hume SDK directly
const { HumeClient } = require('hume');

async function testWithHumeSDK() {
  console.log('🧪 Testing with Hume SDK directly...\n');

  const apiKey = '80pkP7I3YiuV4uviFEccPEhucGwtmq2XRm0ktPMwW7MCLUMG';
  
  try {
    const hume = new HumeClient({
      apiKey: apiKey
    });

    console.log('📦 HumeClient created successfully');
    console.log('🔍 Checking SDK structure:', {
      hasTTS: !!hume.tts,
      ttsType: typeof hume.tts,
      ttsMethods: hume.tts ? Object.getOwnPropertyNames(hume.tts) : 'No TTS object'
    });

    if (hume.tts) {
      console.log('\n🎯 Attempting TTS synthesis...');
      
      const result = await hume.tts.synthesizeJson({
        utterances: [{
          description: "Conversational English Guy",
          text: "Hello, this is a test."
        }]
      });

      console.log('\n✅ SUCCESS!');
      console.log('Result:', {
        hasGenerations: !!result.generations,
        generationsCount: result.generations?.length || 0,
        firstGeneration: result.generations?.[0] ? 'exists' : 'missing'
      });
    }
  } catch (error) {
    console.error('\n❌ SDK Error:', {
      name: error.name,
      message: error.message,
      status: error.status,
      responseBody: error.body
    });
  }
}

testWithHumeSDK(); 