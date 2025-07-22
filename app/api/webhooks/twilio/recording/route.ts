import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// Twilio Recording Webhook Schema
const TwilioRecordingWebhookSchema = z.object({
  CallSid: z.string(),
  RecordingSid: z.string(),
  RecordingUrl: z.string(),
  RecordingStatus: z.enum(['in-progress', 'completed', 'absent', 'failed']),
  RecordingDuration: z.string().optional(),
  RecordingChannels: z.string().optional(),
  RecordingSource: z.string().optional(),
  AccountSid: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('🎙️ Twilio Recording webhook received');

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData = Object.fromEntries(formData.entries());
    
    console.log('📋 Recording webhook data:', JSON.stringify(webhookData, null, 2));

    // Validate the webhook data
    const validatedData = TwilioRecordingWebhookSchema.parse(webhookData);
    
    const { 
      CallSid, 
      RecordingSid, 
      RecordingUrl, 
      RecordingStatus, 
      RecordingDuration,
      RecordingChannels 
    } = validatedData;

    console.log(`🎙️ Recording ${RecordingSid} for call ${CallSid} - Status: ${RecordingStatus}`);

    // Find the call session by Twilio Call SID
    const callSession = await prisma.callSession.findFirst({
      where: { twilioCallSid: CallSid }
    });

    if (!callSession) {
      console.warn(`⚠️ Recording webhook for unknown call session: ${CallSid}`);
      return NextResponse.json({ 
        success: false, 
        message: 'Call session not found' 
      }, { status: 404 });
    }

    // Update call session with recording information
    const updateData: any = {
      recordingStatus: RecordingStatus,
      recordingSid: RecordingSid,
      updatedAt: new Date()
    };

    // Only update URL and duration when recording is completed
    if (RecordingStatus === 'completed') {
      updateData.recordingUrl = RecordingUrl;
      
      if (RecordingDuration) {
        updateData.recordingDurationSeconds = parseInt(RecordingDuration);
      }
      
      console.log(`✅ Recording completed for call ${CallSid}: ${RecordingUrl}`);
      
      // 🚀 FUTURE: Download and store recording in cloud storage
      // This will eliminate the need for Twilio authentication entirely
      try {
        await downloadAndStoreRecording(callSession.id, RecordingUrl, RecordingSid);
      } catch (storageError) {
        console.warn('⚠️ Failed to store recording in cloud storage:', storageError);
        // Don't fail the webhook - recording URL is still available
      }
      
    } else if (RecordingStatus === 'failed') {
      console.error(`❌ Recording failed for call ${CallSid}`);
    }

    // Update the call session with recording info
    await prisma.callSession.update({
      where: { id: callSession.id },
      data: updateData
    });

    console.log(`📝 Updated call session ${callSession.id} with recording status: ${RecordingStatus}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Recording webhook processed',
      callSessionId: callSession.id,
      recordingStatus: RecordingStatus
    });

  } catch (error: any) {
    console.error('❌ Recording webhook error:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to process recording webhook'
    }, { status: 500 });
  }
}

/**
 * Download recording from Twilio and store in cloud storage
 * This eliminates the need for browser-based Twilio authentication
 */
async function downloadAndStoreRecording(sessionId: string, recordingUrl: string, recordingSid: string): Promise<string | null> {
  try {
    console.log(`📥 Downloading recording ${recordingSid} for storage...`);
    
    // Download from Twilio with server-side authentication
    const authHeader = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
    
    const response = await fetch(recordingUrl, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'audio/wav,audio/mpeg,audio/*,*/*'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'audio/wav';
    
    console.log(`📁 Downloaded ${audioBuffer.byteLength} bytes of ${contentType}`);

    // 🚀 TODO: Upload to your preferred cloud storage
    // Examples below for different storage providers:
    
    // 1. AWS S3 Example:
    // const s3Key = `call-recordings/${sessionId}/${recordingSid}.wav`;
    // await uploadToS3(audioBuffer, s3Key, contentType);
    
    // 2. Vercel Blob Example:
    // const blobUrl = await uploadToVercelBlob(audioBuffer, `${sessionId}-${recordingSid}.wav`);
    
    // 3. Cloudflare R2 Example:
    // const r2Url = await uploadToR2(audioBuffer, `recordings/${sessionId}.wav`);
    
    // For now, we'll prepare the infrastructure but use the proxied approach
    console.log(`✅ Recording infrastructure ready for ${sessionId}`);
    
    // TODO: Update call session with cloud storage URL when implemented
    // await prisma.callSession.update({
    //   where: { id: sessionId },
    //   data: { cloudStorageUrl: cloudUrl }
    // });
    
    return null; // Will return cloud URL when implemented
    
  } catch (error: any) {
    console.error(`❌ Failed to download/store recording ${recordingSid}:`, error);
    throw error;
  }
}

// 🚀 FUTURE IMPLEMENTATION EXAMPLES:

/*
// AWS S3 Upload Function
async function uploadToS3(audioBuffer: ArrayBuffer, key: string, contentType: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.S3_RECORDINGS_BUCKET!,
    Key: key,
    Body: new Uint8Array(audioBuffer),
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  });

  await s3Client.send(command);
  return `https://${process.env.S3_RECORDINGS_BUCKET}.s3.amazonaws.com/${key}`;
}

// Vercel Blob Upload Function  
async function uploadToVercelBlob(audioBuffer: ArrayBuffer, filename: string): Promise<string> {
  const { put } = await import('@vercel/blob');
  
  const blob = await put(filename, new Uint8Array(audioBuffer), {
    access: 'private', // Secure access
    contentType: 'audio/wav',
  });
  
  return blob.url;
}

// Cloudflare R2 Upload Function
async function uploadToR2(audioBuffer: ArrayBuffer, key: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  
  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_RECORDINGS_BUCKET!,
    Key: key,
    Body: new Uint8Array(audioBuffer),
    ContentType: 'audio/wav',
  });

  await r2Client.send(command);
  return `https://${process.env.R2_RECORDINGS_BUCKET}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}
*/

// Handle GET requests for webhook verification/testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Twilio Recording webhook endpoint ready',
    timestamp: new Date(),
    endpoint: 'POST /api/webhooks/twilio/recording',
    features: {
      proxyDownloads: true,
      cloudStorageReady: false, // Set to true when cloud storage is implemented
      supportedProviders: ['AWS S3', 'Vercel Blob', 'Cloudflare R2']
    }
  });
} 