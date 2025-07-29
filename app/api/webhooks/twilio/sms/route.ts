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

    // Clean phone numbers (remove + prefix for consistency)
    const fromPhone = validatedData.From.replace(/^\+/, '');
    const toPhone = validatedData.To.replace(/^\+/, '');
    
    // For inbound messages, the conversation is with the sender's phone number
    const conversationPhoneNumber = fromPhone;

    try {
      // Find existing conversation - search for both formats (with and without + prefix)
      let conversation = await prisma.smsConversation.findFirst({
        where: {
          OR: [
            { phoneNumber: conversationPhoneNumber }, // Without + prefix
            { phoneNumber: `+${conversationPhoneNumber}` } // With + prefix
          ]
        }
      });

      if (!conversation) {
        // Create new conversation for this phone number
        conversation = await prisma.smsConversation.create({
          data: {
            phoneNumber: conversationPhoneNumber,
            status: 'active',
            lastMessageAt: new Date(),
            unreadCount: 1, // New inbound message
            priority: 'normal'
          }
        });
        
        console.log('📝 Created new SMS conversation:', conversation.id);
      } else {
        // Update existing conversation
        await prisma.smsConversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 }, // Increment unread count
            status: 'active' // Reactivate if it was closed
          }
        });
        
        console.log('📝 Updated existing SMS conversation:', conversation.id);
      }

      // Create the SMS message
      const smsMessage = await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'inbound',
          body: validatedData.Body,
          twilioMessageSid: validatedData.MessageSid,
          isAutoResponse: false,
          receivedAt: new Date(),
          messageType: validatedData.NumMedia && parseInt(validatedData.NumMedia) > 0 ? 'media' : 'text'
        }
      });

      console.log('✅ SMS message saved to database:', {
        messageId: smsMessage.id,
        conversationId: conversation.id,
        MessageSid: validatedData.MessageSid,
        From: validatedData.From,
        To: validatedData.To,
        Body: validatedData.Body,
        timestamp: new Date().toISOString()
      });

      return NextResponse.json({ 
        message: 'SMS processed and saved successfully',
        status: 'processed',
        MessageSid: validatedData.MessageSid,
        conversationId: conversation.id,
        messageId: smsMessage.id
      });

    } catch (dbError) {
      console.error('❌ Database error saving SMS:', dbError);
      
      // Still return success to prevent Twilio retries, but log the error
      console.log('📋 SMS data that failed to save:', {
        MessageSid: validatedData.MessageSid,
        From: validatedData.From,
        To: validatedData.To,
        Body: validatedData.Body,
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json({ 
        message: 'SMS processed but database save failed',
        status: 'processed_with_errors',
        MessageSid: validatedData.MessageSid,
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });
    }

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