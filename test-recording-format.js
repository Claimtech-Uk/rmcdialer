const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testRecordingURLFormat() {
  console.log('🧪 Testing Call Recording URL Format...\n');

  try {
    // Step 1: Upload using exact same pattern as call recordings
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_RECORDINGS_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    // Use a test audio file (like call recordings would)
    const testContent = 'Test audio content for Hume TTS';
    const timestamp = Date.now();
    const filename = `audio/hume-tts/test-recording-format-${timestamp}.mp3`;
    
    console.log('📤 Uploading test file with recording-style metadata...');
    console.log('📁 Filename:', filename);
    
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_RECORDINGS_BUCKET,
      Key: filename,
      Body: testContent,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=86400',
      Metadata: {
        'uploaded-by': 'rmc-dialler-test',
        'upload-date': new Date().toISOString(),
        'file-type': 'hume-tts-test'
      }
    });

    await s3Client.send(uploadCommand);
    console.log('✅ Upload successful!\n');

    // Step 2: Test using EXACT same URL format as call recordings
    const recordingFormatUrl = `https://${process.env.R2_RECORDINGS_BUCKET}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${filename}`;
    
    console.log('🔗 Testing Recording URL Format:');
    console.log('📍 URL:', recordingFormatUrl);
    console.log();

    // Test the recording format URL
    console.log('🧪 Testing Recording Format URL...');
    try {
      const response = await fetch(recordingFormatUrl);
      console.log('📡 Status:', response.status);
      console.log('📡 Headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const content = await response.text();
        console.log('📄 Content:', content);
        console.log('✅ RECORDING FORMAT WORKS!');
        console.log('🎯 This means the bucket IS publicly accessible');
        console.log('🔧 We should use this format instead of pub-*.r2.dev');
      } else {
        console.log('❌ Recording format failed');
        const errorText = await response.text();
        console.log('📄 Error:', errorText);
      }
    } catch (error) {
      console.log('❌ Recording format error:', error.message);
    }

    console.log('\n🎯 CONCLUSION:');
    console.log('If recording format works:');
    console.log('- ✅ Bucket IS publicly accessible');  
    console.log('- 🔧 Update Hume TTS to use same URL format as recordings');
    console.log('- 🚀 Full greetings will work immediately');
    console.log('\nIf recording format fails:');
    console.log('- ❓ Check if recordings actually work in your app');
    console.log('- 🔧 May need custom domain setup');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRecordingURLFormat().catch(console.error); 