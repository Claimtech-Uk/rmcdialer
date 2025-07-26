import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_RECORDINGS_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;
    
    // Construct the full key path
    const key = `audio/hume-tts/${filename}`;
    
    console.log('🎵 Streaming Hume TTS audio:', {
      filename,
      key,
      bucket: process.env.R2_RECORDINGS_BUCKET
    });

    // Get object from R2
    const command = new GetObjectCommand({
      Bucket: process.env.R2_RECORDINGS_BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      console.error('❌ No body in R2 response for:', key);
      return new NextResponse('Audio file not found', { status: 404 });
    }

    // Convert stream to buffer
    const buffer = await response.Body.transformToByteArray();
    
    console.log('✅ Successfully streamed Hume TTS audio:', {
      filename,
      sizeKB: Math.round(buffer.length / 1024)
    });

    // Return audio with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Accept-Ranges': 'bytes',
      },
    });

  } catch (error) {
    console.error('❌ Failed to stream Hume TTS audio:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 