import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { SMSService } from '@/modules/communications';
import { advanceSmsPlan, getPlanBySid } from '@/modules/ai-agents/core/followup.store'

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
    console.log('AI SMS | 📈 Twilio SMS status callback received');

    // Parse form data from Twilio
    const formData = await request.formData();
    const webhookData = Object.fromEntries(formData.entries());
    
    console.log('AI SMS | 📊 SMS Status data:', {
      MessageSid: webhookData.MessageSid,
      MessageStatus: webhookData.MessageStatus,
      From: webhookData.From,
      To: webhookData.To,
      ErrorCode: webhookData.ErrorCode,
      ErrorMessage: webhookData.ErrorMessage
    });

    // Validate webhook data
    const validatedData = TwilioSMSStatusSchema.parse(webhookData);

    // Persist status update to DB for observability/retries
    try {
      const smsService = new SMSService({
        authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) }
      })
      await smsService.updateMessageStatus(
        validatedData.MessageSid,
        validatedData.MessageStatus,
        validatedData.ErrorCode,
        validatedData.ErrorMessage
      )
      // Chain next SMS in plan when previous is confirmed sent/delivered
      if (validatedData.MessageStatus === 'sent' || validatedData.MessageStatus === 'delivered') {
        console.log('AI SMS | 🔍 Looking up plan mapping for SID:', validatedData.MessageSid)
        const mapping = await getPlanBySid(validatedData.MessageSid)
        
        if (mapping?.phone && mapping.planId) {
          console.log('AI SMS | ✅ Found plan mapping', { phone: mapping.phone, planId: mapping.planId })
          const { nextText, done } = await advanceSmsPlan(mapping.phone, mapping.planId)
          
          if (nextText) {
            console.log('AI SMS | 🚀 Advancing plan - sending next message', { 
              phone: mapping.phone, 
              planId: mapping.planId, 
              messageLength: nextText.length,
              done 
            })
            await smsService.sendSMS({
              phoneNumber: mapping.phone,
              message: nextText,
              messageType: 'auto_response'
            })
          } else {
            console.log('AI SMS | ✅ Plan completed or no next message', { 
              phone: mapping.phone, 
              planId: mapping.planId, 
              done 
            })
          }
        } else {
          // Only log missing mapping if not in testing mode (testing mode uses Redis follow-ups)
          const isTestingMode = process.env.AI_SMS_IMMEDIATE_MULTIMSGS === 'true'
          if (!isTestingMode) {
            console.log('AI SMS | ❌ No plan mapping found for SID:', validatedData.MessageSid)
          }
        }
      }
    } catch (persistError) {
      console.error('AI SMS | Failed to persist SMS status:', persistError)
    }

    // Log any delivery failures for investigation
    if (validatedData.MessageStatus === 'failed' || validatedData.MessageStatus === 'undelivered') {
      console.error('AI SMS | SMS delivery failed:', {
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
    console.error('AI SMS | ❌ SMS status webhook error:', error);

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