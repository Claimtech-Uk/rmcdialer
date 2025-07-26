import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export class R2AudioHostingService {
  private s3Client: S3Client;
  private bucket: string;
  private endpoint: string;
  private accountId: string;

  constructor() {
    // Use the same R2 credentials from environment
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_RECORDINGS_BUCKET) {
      throw new Error('R2 credentials not configured. Please check your environment variables.');
    }

    this.bucket = process.env.R2_RECORDINGS_BUCKET;
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.endpoint = process.env.R2_RECORDINGS_ENDPOINT || `https://${this.accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    console.log('🗄️ R2 Audio Hosting Service initialized:', {
      bucket: this.bucket,
      endpoint: this.endpoint,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Upload Hume TTS audio to R2 and return public URL
   */
  async uploadAudioFile(
    audioBase64: string, 
    greetingType: 'connecting' | 'out-of-hours' | 'busy',
    callerName?: string
  ): Promise<string> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const nameSlug = callerName ? `-${callerName.toLowerCase().replace(/[^a-z0-9]/g, '')}` : '';
      const filename = `audio/hume-tts/${greetingType}-greeting${nameSlug}-${timestamp}.mp3`;

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');

      console.log('📤 Uploading Hume TTS audio to R2:', {
        filename,
        sizeKB: Math.round(audioBuffer.length / 1024),
        greetingType,
        callerName: callerName || 'anonymous'
      });

      // Upload to R2
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: filename,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
        CacheControl: 'public, max-age=86400', // Cache for 24 hours
        Metadata: {
          'uploaded-by': 'rmc-dialler-hume-tts',
          'upload-date': new Date().toISOString(),
          'greeting-type': greetingType,
          'caller-name': callerName || 'anonymous',
          'generated-by': 'hume-ai'
        }
      });

      await this.s3Client.send(uploadCommand);

      // Generate public URL using the public development domain
      const publicUrl = `https://pub-c469bcbe5947499d91894e9b2ddc5423.r2.dev/${filename}`;

      console.log('✅ Successfully uploaded Hume TTS audio to R2:', {
        url: publicUrl,
        filename,
        sizeKB: Math.round(audioBuffer.length / 1024)
      });

      // Test URL accessibility before returning
      try {
        console.log('🔍 Testing R2 URL accessibility...');
        const testResponse = await fetch(publicUrl, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (testResponse.ok) {
          console.log('✅ R2 URL is accessible, returning URL');
          return publicUrl;
        } else {
          console.warn(`⚠️ R2 URL returned ${testResponse.status}, will fall back to data URI`);
          throw new Error(`URL returned ${testResponse.status}`);
        }
      } catch (urlTestError) {
        console.warn('⚠️ R2 URL not accessible yet, falling back to data URI:', urlTestError instanceof Error ? urlTestError.message : String(urlTestError));
        throw new Error('R2 URL not accessible');
      }

    } catch (error) {
      console.error('❌ Failed to upload Hume TTS audio to R2:', error);
      throw new Error(`R2 upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if R2 is properly configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_RECORDINGS_BUCKET &&
      process.env.CLOUDFLARE_ACCOUNT_ID
    );
  }

  /**
   * Get R2 configuration status for debugging
   */
  getConfigStatus() {
    return {
      hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
      hasBucket: !!process.env.R2_RECORDINGS_BUCKET,
      hasAccountId: !!process.env.CLOUDFLARE_ACCOUNT_ID,
      bucket: this.bucket,
      endpoint: this.endpoint
    };
  }
} 