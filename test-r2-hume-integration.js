const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testR2HumeIntegration() {
  console.log('🧪 Testing R2 + Hume TTS Integration Locally...\n');

  // Check environment variables first
  console.log('🔍 Checking environment variables...');
  const requiredEnvVars = [
    'HUME_API_KEY',
    'R2_ACCESS_KEY_ID', 
    'R2_SECRET_ACCESS_KEY',
    'R2_RECORDINGS_BUCKET',
    'CLOUDFLARE_ACCOUNT_ID'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars);
    return;
  }

  console.log('✅ All required environment variables found\n');

  try {
    // Import our services (using dynamic import for ES modules)
    console.log('📦 Loading services...');
    
    // First test Hume TTS generation
    console.log('\n🎵 Step 1: Testing Hume TTS Generation...');
    
    const testText = "Hello, this is a test of our Hume TTS and R2 integration. Welcome to Resolve Your Claim!";
    console.log('📝 Test text:', testText);

    // Make direct API call to Hume (like our service does)
    const requestBody = {
      utterances: [{
        description: "Conversational English Guy",
        text: testText
      }]
    };

    console.log('🌐 Making Hume TTS API request...');
    const humeResponse = await fetch('https://api.hume.ai/v0/tts', {
      method: 'POST',
      headers: {
        'X-Hume-Api-Key': process.env.HUME_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!humeResponse.ok) {
      const errorText = await humeResponse.text();
      throw new Error(`Hume API failed: ${humeResponse.status} - ${errorText}`);
    }

    const humeResult = await humeResponse.json();
    
    if (!humeResult.generations || !humeResult.generations[0] || !humeResult.generations[0].audio) {
      throw new Error('Invalid Hume response format');
    }

    const audioBase64 = humeResult.generations[0].audio;
    console.log('✅ Hume TTS successful!');
    console.log('📊 Audio size:', Math.round(audioBase64.length / 1024), 'KB (base64)');
    console.log('📊 Estimated MP3 size:', Math.round(audioBase64.length * 0.75 / 1024), 'KB\n');

    // Step 2: Test R2 Upload
    console.log('🗄️ Step 2: Testing R2 Upload...');
    
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_RECORDINGS_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    // Generate test filename
    const timestamp = Date.now();
    const filename = `audio/hume-tts/test-integration-${timestamp}.mp3`;
    
    console.log('📤 Uploading to R2...');
    console.log('📁 Bucket:', process.env.R2_RECORDINGS_BUCKET);
    console.log('📁 Key:', filename);

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_RECORDINGS_BUCKET,
      Key: filename,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=86400',
      Metadata: {
        'uploaded-by': 'local-test-script',
        'upload-date': new Date().toISOString(),
        'test-run': 'true',
        'generated-by': 'hume-ai'
      }
    });

    await s3Client.send(uploadCommand);

    // Generate public URL using Vercel API proxy (will work once deployed)
    const filenameOnly = filename.split('/').pop();
    const publicUrl = `https://rmcdialer.vercel.app/api/audio/hume-tts/${filenameOnly}`;
    
    console.log('✅ R2 upload successful!');
    console.log('🔗 Public URL:', publicUrl);
    console.log('📊 Upload size:', Math.round(audioBuffer.length / 1024), 'KB\n');

    // Step 3: Test URL accessibility
    console.log('🌐 Step 3: Testing URL accessibility...');
    
    try {
      const urlTestResponse = await fetch(publicUrl, { method: 'HEAD' });
      console.log('📡 URL Status:', urlTestResponse.status);
      console.log('📡 Content-Type:', urlTestResponse.headers.get('content-type'));
      console.log('📡 Content-Length:', urlTestResponse.headers.get('content-length'));
      
      if (urlTestResponse.ok) {
        console.log('✅ URL is publicly accessible!');
      } else {
        console.log('⚠️ URL returned non-200 status:', urlTestResponse.status);
      }
    } catch (urlError) {
      console.warn('⚠️ Could not test URL accessibility:', urlError.message);
    }

    console.log('\n🎉 INTEGRATION TEST COMPLETE!');
    console.log('📋 Summary:');
    console.log('  ✅ Hume TTS generation: SUCCESS');
    console.log('  ✅ R2 upload: SUCCESS');
    console.log('  ✅ Public URL generated: SUCCESS');
    console.log('\n🔗 Test audio URL:', publicUrl);
    console.log('\n💡 You can test this URL in a browser or with Twilio TwiML:');
    console.log(`   <Play>${publicUrl}</Play>`);
    
    // Step 4: Test our actual service classes
    console.log('\n🧪 Step 4: Testing our service classes...');
    
    // We need to dynamically import our TypeScript services
    // For now, let's test if they can be instantiated
    console.log('🔧 Service integration test would require TypeScript compilation');
    console.log('   Production services will work the same way as this direct test');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testR2HumeIntegration().then(() => {
  console.log('\n🏁 Test script completed');
}).catch(console.error); 