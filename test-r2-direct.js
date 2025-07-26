const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testR2DirectAccess() {
  console.log('🔍 Testing R2 Direct Access...\n');

  try {
    // Step 1: Upload a test file
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_RECORDINGS_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    // Create a simple test file
    const testContent = 'Hello R2 Test!';
    const timestamp = Date.now();
    const filename = `test-access-${timestamp}.txt`;
    
    console.log('📤 Uploading test file:', filename);
    
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_RECORDINGS_BUCKET,
      Key: filename,
      Body: testContent,
      ContentType: 'text/plain',
      CacheControl: 'public, max-age=3600'
    });

    await s3Client.send(uploadCommand);
    console.log('✅ Upload successful!\n');

    // Step 2: Test both URL formats
    const oldFormatUrl = `https://${process.env.R2_RECORDINGS_BUCKET}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${filename}`;
    const newFormatUrl = `https://pub-c469bcbe5947499d91894e9b2ddc5423.r2.dev/${filename}`;

    console.log('🔗 Testing URL formats:');
    console.log('📍 Old format:', oldFormatUrl);
    console.log('📍 New format:', newFormatUrl);
    console.log();

    // Test old format
    console.log('🧪 Testing OLD format...');
    try {
      const oldResponse = await fetch(oldFormatUrl);
      console.log('📡 Status:', oldResponse.status);
      if (oldResponse.ok) {
        const content = await oldResponse.text();
        console.log('📄 Content:', content);
        console.log('✅ OLD format works!');
      } else {
        console.log('❌ OLD format failed');
      }
    } catch (oldError) {
      console.log('❌ OLD format error:', oldError.message);
    }

    console.log();

    // Test new format
    console.log('🧪 Testing NEW format...');
    try {
      const newResponse = await fetch(newFormatUrl);
      console.log('📡 Status:', newResponse.status);
      if (newResponse.ok) {
        const content = await newResponse.text();
        console.log('📄 Content:', content);
        console.log('✅ NEW format works!');
      } else {
        console.log('❌ NEW format failed');
      }
    } catch (newError) {
      console.log('❌ NEW format error:', newError.message);
    }

    console.log('\n🎯 CONCLUSION:');
    console.log('- If OLD format works but NEW doesn\'t: R2 public domain not properly configured');
    console.log('- If neither works: Need to configure bucket permissions');
    console.log('- If both work: Production deployment issue');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testR2DirectAccess().catch(console.error); 