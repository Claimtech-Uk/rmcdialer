import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// Twilio SMS Status Callback Schema
const TwilioSMSStatusSchema = z.object({
  MessageSid: z.string(),
  MessageStatus: z.enum(['queued', 'sending', 'sent', 'failed', 'delivered', 'undelivered', 'receiving', 'received']),
  AccountSid: z.string(),
  From: z.string(),
  To: z.string(),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
  ApiVersion: z.string().optional(),
  SmsSid: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('📈 Twilio SMS status callback received');

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData = Object.fromEntries(formData.entries());
    
    console.log('📊 SMS Status data:', {
      MessageSid: webhookData.MessageSid,
      MessageStatus: webhookData.MessageStatus,
      From: webhookData.From,
      To: webhookData.To,
      ErrorCode: webhookData.ErrorCode,
      ErrorMessage: webhookData.ErrorMessage
    });

    // Validate webhook data
    const validatedData = TwilioSMSStatusSchema.parse(webhookData);

    // For now, just log the status update
    // TODO: Update SMS message status in database when SMS module is fully implemented
    console.log('SMS status update:', {
      MessageSid: validatedData.MessageSid,
      status: validatedData.MessageStatus,
      errorCode: validatedData.ErrorCode,
      errorMessage: validatedData.ErrorMessage
    });

    // Log any delivery failures for investigation
    if (validatedData.MessageStatus === 'failed' || validatedData.MessageStatus === 'undelivered') {
      console.error('SMS delivery failed:', {
        MessageSid: validatedData.MessageSid,
        From: validatedData.From,
        To: validatedData.To,
        ErrorCode: validatedData.ErrorCode,
        ErrorMessage: validatedData.ErrorMessage,
        status: validatedData.MessageStatus
      });
    }

    return NextResponse.json({ 
      message: 'Status update processed successfully',
      status: 'processed',
      MessageSid: validatedData.MessageSid,
      newStatus: validatedData.MessageStatus
    });

  } catch (error) {
    console.error('❌ SMS status webhook error:', error);

    // Return 200 OK even on error to prevent Twilio retries
    return NextResponse.json({ 
      message: 'Status callback processed with errors',
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 200 });
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint for Twilio webhook configuration
  return NextResponse.json({
    message: 'Twilio SMS status callback endpoint ready',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
} 