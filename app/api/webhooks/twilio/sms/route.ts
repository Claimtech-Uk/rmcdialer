import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { normalizePhoneNumber } from '@/modules/twilio-voice/utils/phone.utils';
import { FEATURE_FLAGS } from '@/lib/config/features';
import { SMSService } from '@/modules/communications';
import { containsStopIntent } from '@/modules/ai-agents/core/guardrails'
// Using batch processing - messages are stored and processed by cron job

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
    console.log('AI SMS | 📱 Twilio SMS webhook received');

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData: Record<string, string> = {};
    
    // Convert FormData to object
    for (const [key, value] of formData.entries()) {
      webhookData[key] = value.toString();
    }
    
    console.log('AI SMS | 📋 SMS Webhook data:', {
      MessageSid: webhookData.MessageSid,
      From: webhookData.From,
      To: webhookData.To,
      Body: webhookData.Body,
      NumMedia: webhookData.NumMedia
    });

    // Validate webhook data
    const validatedData = TwilioSMSWebhookSchema.parse(webhookData);

    // Clean phone numbers (remove + prefix for consistency) and ensure we pass E.164 to lookup helpers
    const fromPhone = validatedData.From.replace(/^\+/, '');
    const toPhone = validatedData.To.replace(/^\+/, '');
    
    // Validate phone numbers to prevent NULL entries
    if (!fromPhone || !toPhone) {
      console.error('AI SMS | ❌ Invalid phone numbers received', {
        from: validatedData.From,
        to: validatedData.To,
        fromCleaned: fromPhone,
        toCleaned: toPhone
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid phone numbers' 
      }, { status: 400 });
    }

    // Only allow AI SMS agent auto-replies on the designated test number
    const aiSmsTestNumberE164 = process.env.AI_SMS_TEST_NUMBER || '+447723495560';
    const isTestNumber = (validatedData.To === aiSmsTestNumberE164) || (toPhone === aiSmsTestNumberE164.replace(/^\+/, ''));
    console.log('AI SMS | 🧪 Agent gating', {
      featureEnabled: FEATURE_FLAGS.ENABLE_AI_SMS_AGENT,
      isTestNumber,
      to: validatedData.To,
      aiSmsTestNumberE164
    })
    
    // For inbound messages, the conversation is with the sender's phone number
    const conversationPhoneNumber = fromPhone;

    // Try to match this phone number to an existing user in the replica DB
    let matchedUserId: number | undefined = undefined;
    try {
      const phoneVariants = normalizePhoneNumber(validatedData.From);
      const matchedUser = await replicaDb.user.findFirst({
        where: {
          AND: [
            { phone_number: { in: phoneVariants } },
            { is_enabled: true }
          ]
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true
        }
      });

      if (matchedUser) {
        matchedUserId = Number(matchedUser.id);
        console.log('AI SMS | 🔗 Matched inbound SMS to user', {
          userId: matchedUserId,
          phone: matchedUser.phone_number
        });
      } else {
        console.log('AI SMS | ℹ️ No user match for inbound SMS', { triedVariants: phoneVariants.join(', '), from: validatedData.From });
      }
    } catch (lookupError) {
      console.error('❌ Failed to lookup user from phone for inbound SMS:', lookupError);
    }

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
            ...(matchedUserId ? { userId: matchedUserId } : {}),
            status: 'active',
            lastMessageAt: new Date(),
            unreadCount: 1, // New inbound message
            priority: 'normal'
          }
        });
        
        console.log('AI SMS | 📝 Created new SMS conversation:', conversation.id);
      } else {
        // Update existing conversation
        await prisma.smsConversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 }, // Increment unread count
            status: 'active', // Reactivate if it was closed
            ...(matchedUserId && !conversation.userId ? { userId: matchedUserId } : {})
          }
        });
        
        console.log('AI SMS | 📝 Updated existing SMS conversation:', conversation.id);
      }

      // Handle STOP/UNSUBSCRIBE before any auto-reply
      const isStop = containsStopIntent(validatedData.Body)

      // Create the SMS message with ALL tracking fields populated
      // Goal: Populate database fields that were added for SMS processing tracking
      const smsMessage = await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'inbound',
          body: validatedData.Body,
          twilioMessageSid: validatedData.MessageSid,
          isAutoResponse: false,
          receivedAt: new Date(),
          messageType: validatedData.NumMedia && parseInt(validatedData.NumMedia) > 0 ? 'media' : 'text',
          // ✅ NEW: Database-first SMS processing tracking fields
          processed: false,                    // Explicitly set - not processed yet
          processedAt: null,                   // No processing timestamp yet
          phoneNumber: conversationPhoneNumber, // Copy from conversation for indexing
          userId: matchedUserId || null,       // Link to user if found
          messageSid: validatedData.MessageSid, // Use MessageSid for processing tracking
          // 🎯 PHASE 2: Store destination number for smart routing
          destinationNumber: validatedData.To  // Track which Twilio number was contacted
        }
      });

      console.log('AI SMS | ✅ Inbound saved:', {
        messageId: smsMessage.id,
        conversationId: conversation.id,
        MessageSid: validatedData.MessageSid,
        From: validatedData.From,
        To: validatedData.To,
        Body: validatedData.Body,
        timestamp: new Date().toISOString()
      });

      // If STOP, send acknowledgement directly and halt automation for 24h
      if (isStop) {
        try {
          const { SMSService } = await import('@/modules/communications')
          const { setAutomationHalt } = await import('@/modules/ai-agents/core/memory.store')
          const smsSvc = new SMSService({ authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) } })
          await smsSvc.sendSMS({
            phoneNumber: validatedData.From,
            message: "You've been unsubscribed from SMS. You can still receive updates by phone or email.",
            messageType: 'auto_response',
            userId: matchedUserId,
            fromNumberOverride: aiSmsTestNumberE164
          })
          await setAutomationHalt(conversationPhoneNumber)
          console.log('AI SMS | ✅ STOP acknowledged, automation halted 24h', { conversationId: conversation.id, to: validatedData.From })
        } catch (stopErr) {
          console.error('Failed to send STOP acknowledgement:', stopErr)
        }
        return NextResponse.json({ message: 'STOP acknowledged', status: 'processed_stop' })
      }

      // NEW: Batch-based AI SMS processing (prevents duplicate responses)
      if (FEATURE_FLAGS.ENABLE_AI_SMS_AGENT && isTestNumber) {
        try {
          // Create batch ID using 15-second windows
          // This groups rapid-fire messages together for single AI response
          const batchId = `${conversationPhoneNumber}:${Math.floor(Date.now() / 15000)}`;
          const batchTimestamp = new Date();
          
          console.log('AI SMS | 📦 Message added to batch', {
            batchId,
            from: validatedData.From,
            conversationId: conversation.id,
            messageSid: validatedData.MessageSid,
            messagePreview: validatedData.Body.substring(0, 50),
            batchWindow: '15 seconds'
          });
          
          // Update the message with batch information
          await prisma.smsMessage.update({
            where: { id: smsMessage.id },
            data: {
              batchId,
              batchCreatedAt: batchTimestamp,
              batchProcessed: false,
              batchResponseSent: false
            }
          });
          
          // Create or update batch status (tracks processing state)
          await prisma.smsBatchStatus.upsert({
            where: { batchId },
            create: {
              batchId,
              phoneNumber: conversationPhoneNumber,
              messageCount: 1,
              createdAt: batchTimestamp
            },
            update: {
              messageCount: { increment: 1 }
            }
          });
          
          console.log('AI SMS | ✅ Message batched successfully', {
            batchId,
            info: 'Will be processed by cron job within 10-15 seconds'
          });
          
        } catch (batchError) {
          console.error('AI SMS | ❌ Batching failed', {
            error: batchError instanceof Error ? batchError.message : batchError,
            fallback: 'Message saved but may not be processed'
          });
        }
      } else {
        console.log('AI SMS | ℹ️ Agent not triggered', {
          reason: FEATURE_FLAGS.ENABLE_AI_SMS_AGENT ? (isTestNumber ? 'unknown' : 'not test number') : 'feature disabled',
          to: validatedData.To
        })
      }

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