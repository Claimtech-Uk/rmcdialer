const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testR2Access() {
  console.log('🔍 Testing R2 Bucket Access Configuration...\n');

  // Use the URL from our previous test
  const testUrl = 'https://rmc-dialer.6c9a7c16682d65855858a4f1df033ee4.r2.cloudflarestorage.com/audio/hume-tts/test-integration-1753540029370.mp3';
  
  console.log('🔗 Testing URL:', testUrl);

  // Test 1: HEAD request (what we did before)
  console.log('\n📡 Test 1: HEAD request...');
  try {
    const headResponse = await fetch(testUrl, { method: 'HEAD' });
    console.log('Status:', headResponse.status);
    console.log('Headers:', Object.fromEntries(headResponse.headers.entries()));
  } catch (error) {
    console.error('HEAD request failed:', error.message);
  }

  // Test 2: GET request (what Twilio would do)
  console.log('\n📡 Test 2: GET request (like Twilio)...');
  try {
    const getResponse = await fetch(testUrl);
    console.log('Status:', getResponse.status);
    console.log('Content-Type:', getResponse.headers.get('content-type'));
    console.log('Content-Length:', getResponse.headers.get('content-length'));
    
    if (getResponse.ok) {
      console.log('✅ GET request successful! Twilio should be able to access this.');
      // Don't download the full audio, just check if we can read
      const firstBytes = await getResponse.text().then(text => text.substring(0, 100));
      console.log('First 100 chars:', firstBytes.substring(0, 50) + '...');
    } else {
      const errorText = await getResponse.text();
      console.log('❌ GET request failed:', errorText);
    }
  } catch (error) {
    console.error('GET request failed:', error.message);
  }

  // Test 3: Check if it's a CORS issue
  console.log('\n📡 Test 3: Browser vs Server access...');
  console.log('Note: The difference between HEAD and GET responses can indicate CORS/permissions setup');

  console.log('\n💡 RECOMMENDATIONS:');
  console.log('1. If GET request works (200 status), Twilio will work fine');
  console.log('2. If both fail, we need to configure R2 bucket for public read access');
  console.log('3. Check your R2 bucket settings in Cloudflare dashboard');
  console.log('4. You may need to add public read permissions or a custom domain');
}

testR2Access().catch(console.error); 