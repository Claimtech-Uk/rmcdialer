// Test different Hume API authentication approaches
require('dotenv').config();

async function testHumeAuth() {
  const apiKey = process.env.HUME_API_KEY;
  console.log('🔐 Testing Hume API Authentication\n');
  console.log('API Key:', {
    length: apiKey.length,
    prefix: apiKey.substring(0, 10) + '...',
    suffix: '...' + apiKey.substring(apiKey.length - 4)
  });

  // Test 1: Bearer Token (current approach)
  console.log('\n📍 Test 1: Bearer Token Authentication');
  await testRequest('Bearer ' + apiKey, 'https://api.hume.ai/v0/tts');

  // Test 2: X-API-Key Header
  console.log('\n📍 Test 2: X-API-Key Header');
  await testRequestWithApiKeyHeader(apiKey, 'https://api.hume.ai/v0/tts');

  // Test 3: Try different API versions
  console.log('\n📍 Test 3: Try v1 endpoint');
  await testRequest('Bearer ' + apiKey, 'https://api.hume.ai/v1/tts');

  // Test 4: Basic Auth
  console.log('\n📍 Test 4: Basic Auth');
  await testBasicAuth(apiKey, 'https://api.hume.ai/v0/tts');
}

async function testRequest(authHeader, url) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        utterances: [{
          description: "Test voice",
          text: "Test"
        }]
      })
    });
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      const text = await response.text();
      console.log(`  Error: ${text.substring(0, 200)}...`);
    } else {
      console.log('  ✅ Success!');
    }
  } catch (error) {
    console.log(`  ❌ Network error: ${error.message}`);
  }
}

async function testRequestWithApiKeyHeader(apiKey, url) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        utterances: [{
          description: "Test voice",
          text: "Test"
        }]
      })
    });
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      const text = await response.text();
      console.log(`  Error: ${text.substring(0, 200)}...`);
    } else {
      console.log('  ✅ Success!');
    }
  } catch (error) {
    console.log(`  ❌ Network error: ${error.message}`);
  }
}

async function testBasicAuth(apiKey, url) {
  try {
    const encoded = Buffer.from(apiKey + ':').toString('base64');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + encoded,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        utterances: [{
          description: "Test voice",
          text: "Test"
        }]
      })
    });
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      const text = await response.text();
      console.log(`  Error: ${text.substring(0, 200)}...`);
    } else {
      console.log('  ✅ Success!');
    }
  } catch (error) {
    console.log(`  ❌ Network error: ${error.message}`);
  }
}

testHumeAuth(); 