import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioConfig, formatValidationResults, getTwilioWebhookUrls } from '@/lib/utils/twilio-validation';
import { SMSService } from '@/modules/communications';
import { AuthService } from '@/modules/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/modules/core';

export async function GET(request: NextRequest) {
  try {
    // Validate Twilio configuration
    const validation = validateTwilioConfig();
    const formattedResults = formatValidationResults(validation);
    
    console.log(formattedResults);

    const response = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      },
      webhookUrls: validation.config ? getTwilioWebhookUrls(validation.config.apiBaseUrl) : null,
      twilioConfig: validation.config ? {
        accountSid: validation.config.accountSid.substring(0, 8) + '...',  // Partial for security
        phoneNumber: validation.config.phoneNumber,
        hasAuthToken: !!validation.config.authToken,
        apiBaseUrl: validation.config.apiBaseUrl
      } : null
    };

    return NextResponse.json(response, { 
      status: validation.isValid ? 200 : 400 
    });

  } catch (error) {
    console.error('❌ Twilio config test error:', error);
    
    return NextResponse.json({
      error: 'Failed to validate Twilio configuration',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, phoneNumber, message } = body;

    // Validate configuration first
    const validation = validateTwilioConfig();
    if (!validation.isValid) {
      return NextResponse.json({
        error: 'Twilio configuration invalid',
        errors: validation.errors,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    if (action === 'send-test-sms') {
      if (!phoneNumber || !message) {
        return NextResponse.json({
          error: 'phoneNumber and message are required for test SMS',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }

      // Initialize SMS service
      const authService = new AuthService({ prisma, logger });
      const authForComms = {
        getCurrentAgent: async () => ({ id: 1, role: 'admin' })
      };
      const smsService = new SMSService({ authService: authForComms });

      // Send test SMS
      const result = await smsService.sendSMS({
        phoneNumber,
        message,
        messageType: 'manual'
      });

      return NextResponse.json({
        success: true,
        message: 'Test SMS sent successfully',
        result: {
          messageId: result.messageId,
          twilioSid: result.twilioSid,
          status: result.status
        },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      error: 'Unknown action. Supported actions: send-test-sms',
      timestamp: new Date().toISOString()
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Twilio test action error:', error);
    
    return NextResponse.json({
      error: 'Failed to execute test action',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 