import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// Twilio SMS Webhook Schema
const TwilioSMSWebhookSchema = z.object({
  MessageSid: z.string(),
  AccountSid: z.string(),
  From: z.string(),
  To: z.string(),
  Body: z.string(),
  NumMedia: z.string().optional(),
  MediaContentType0: z.string().optional(),
  MediaUrl0: z.string().optional(),
  FromCity: z.string().optional(),
  FromState: z.string().optional(),
  FromZip: z.string().optional(),
  FromCountry: z.string().optional(),
  ToCity: z.string().optional(),
  ToState: z.string().optional(),
  ToZip: z.string().optional(),
  ToCountry: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('📱 Twilio SMS webhook received');

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData: Record<string, string> = {};
    
    // Convert FormData to object
    for (const [key, value] of formData.entries()) {
      webhookData[key] = value.toString();
    }
    
    console.log('📋 SMS Webhook data:', {
      MessageSid: webhookData.MessageSid,
      From: webhookData.From,
      To: webhookData.To,
      Body: webhookData.Body,
      NumMedia: webhookData.NumMedia
    });

    // Validate webhook data
    const validatedData = TwilioSMSWebhookSchema.parse(webhookData);

    // For now, just log the incoming SMS (we'll add database storage later)
    console.log('✅ SMS webhook processed successfully:', {
      MessageSid: validatedData.MessageSid,
      From: validatedData.From,
      To: validatedData.To,
      Body: validatedData.Body,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ 
      message: 'SMS processed successfully',
      status: 'processed',
      MessageSid: validatedData.MessageSid
    });

  } catch (error) {
    console.error('❌ SMS webhook error:', error);
    
    // Return 200 OK even on error to prevent Twilio retries for invalid data
    // But log the error for investigation
    return NextResponse.json({ 
      message: 'SMS webhook processed with errors',
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 200 });
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint for Twilio webhook configuration
  return NextResponse.json({ 
    message: 'SMS webhook endpoint is healthy',
    timestamp: new Date().toISOString(),
    status: 'ok'
  });
} 