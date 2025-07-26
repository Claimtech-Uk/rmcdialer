// Comprehensive Hume TTS test
const { HumeClient } = require('hume');

async function testAllApproaches() {
  console.log('🧪 Comprehensive Hume TTS Testing\n');

  const apiKey = '80pkP7I3YiuV4uviFEccPEhucGwtmq2XRm0ktPMwW7MCLUMG';

  // Test 1: Set as environment variable
  console.log('📍 Test 1: Using environment variable');
  process.env.HUME_API_KEY = apiKey;
  try {
    const hume1 = new HumeClient();
    console.log('  Client created with env var');
    console.log('  TTS structure:', Object.getOwnPropertyNames(hume1.tts || {}));
  } catch (error) {
    console.log('  Error:', error.message);
  }

  // Test 2: Direct API key
  console.log('\n📍 Test 2: Direct API key in constructor');
  try {
    const hume2 = new HumeClient({ apiKey });
    console.log('  Client created');
    console.log('  Has tts:', !!hume2.tts);
    
    // Try different method names
    if (hume2.tts) {
      console.log('  Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(hume2.tts)));
      
      // Try synthesize instead of synthesizeJson
      if (typeof hume2.tts.synthesize === 'function') {
        console.log('  Found synthesize method!');
        const result = await hume2.tts.synthesize({
          utterances: [{
            description: "Test voice",
            text: "Test"
          }]
        });
        console.log('  Result:', !!result);
      }
    }
  } catch (error) {
    console.log('  Error:', error.message);
  }

  // Test 3: Check what the Hume client actually exports
  console.log('\n📍 Test 3: Inspect Hume exports');
  console.log('  HumeClient type:', typeof HumeClient);
  console.log('  HumeClient properties:', Object.getOwnPropertyNames(HumeClient));
  
  // Test 4: Try instantiating with different syntax
  console.log('\n📍 Test 4: Alternative instantiation');
  try {
    const Hume = require('hume');
    console.log('  Hume exports:', Object.keys(Hume));
    
    if (Hume.Hume) {
      const client = new Hume.Hume({ apiKey });
      console.log('  Alternative client created');
    }
  } catch (error) {
    console.log('  Error:', error.message);
  }
}

testAllApproaches(); 