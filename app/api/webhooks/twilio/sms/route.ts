import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SMSService } from '@/modules/communications';
import { AuthService } from '@/modules/auth';
import { UserService } from '@/modules/users';
import { prisma } from '@/lib/db';
import { logger } from '@/modules/core';

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

// Initialize services with proper dependencies
const authService = new AuthService({ prisma, logger });
const userService = new UserService();

const authForComms = {
  getCurrentAgent: async () => ({ id: 1, role: 'system' }) // System agent for webhooks
};

// Create user service adapter for SMS service
const userServiceAdapter = {
  async getUserData(userId: number) {
    const context = await userService.getUserCallContext(userId);
    if (!context) {
      throw new Error(`User ${userId} not found`);
    }
    return {
      id: context.user.id,
      firstName: context.user.firstName || 'Unknown',
      lastName: context.user.lastName || 'User',
      email: context.user.email || '',
      phoneNumber: context.user.phoneNumber || ''
    };
  }
};

const smsService = new SMSService({ 
  authService: authForComms,
  userService: userServiceAdapter
});

export async function POST(request: NextRequest) {
  try {
    console.log('📱 Twilio SMS webhook received');

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData = Object.fromEntries(formData.entries());
    
    console.log('📋 SMS Webhook data:', {
      MessageSid: webhookData.MessageSid,
      From: webhookData.From,
      To: webhookData.To,
      Body: webhookData.Body,
      NumMedia: webhookData.NumMedia
    });

    // Validate webhook data
    const validatedData = TwilioSMSWebhookSchema.parse(webhookData);

    // Check if this is a media message (not yet supported)
    if (validatedData.NumMedia && parseInt(validatedData.NumMedia) > 0) {
      logger.warn('Media message received but not yet supported', {
        MessageSid: validatedData.MessageSid,
        From: validatedData.From,
        NumMedia: validatedData.NumMedia
      });
      
      // Send auto-response for media messages
      await smsService.sendSMS({
        phoneNumber: validatedData.From,
        message: "Thank you for your message. Media attachments are not supported yet. Please send text messages only.",
        messageType: 'auto_response'
      });

      return NextResponse.json({ 
        message: 'Media message received but not supported',
        status: 'acknowledged'
      });
    }

    // Process the incoming SMS
    const result = await smsService.processIncomingSMS({
      from: validatedData.From,
      to: validatedData.To,
      body: validatedData.Body,
      messageSid: validatedData.MessageSid,
      accountSid: validatedData.AccountSid,
      timestamp: new Date()
    });

    logger.info('Incoming SMS processed successfully', {
      messageId: result.message.id,
      conversationId: result.conversation.id,
      from: validatedData.From,
      hasAutoResponse: !!result.autoResponse
    });

    // Return TwiML response if needed (currently not required)
    return NextResponse.json({ 
      message: 'SMS processed successfully',
      status: 'processed',
      messageId: result.message.id,
      conversationId: result.conversation.id,
      autoResponseSent: !!result.autoResponse
    });

  } catch (error) {
    console.error('❌ SMS webhook error:', error);
    
    logger.error('Failed to process incoming SMS webhook', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      webhookData: Object.fromEntries((await request.formData()).entries())
    });

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
    message: 'Twilio SMS webhook endpoint ready',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
} 