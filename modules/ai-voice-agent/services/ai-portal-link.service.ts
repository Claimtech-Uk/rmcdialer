/**
 * AI Voice-Specific Portal Link Service
 * Sends simple, clean portal links for AI voice calls
 * Separate from main system to maintain independence
 */

import { logger } from '@/lib/utils/logger';

export interface AIPortalLinkOptions {
  userId: number;
  phoneNumber: string;
  linkType: 'claims' | 'documents' | 'status';
  userName?: string;
}

export interface AIPortalLinkResult {
  success: boolean;
  message: string;
  messageId?: string;
  error?: string;
}

export class AIVoicePortalService {
  private baseUrl: string;
  private twilioAccountSid: string;
  private twilioAuthToken: string;
  private fromNumber: string;

  constructor(env: any) {
    this.baseUrl = env.MAIN_APP_URL || 'https://claim.resolvemyclaim.co.uk';
    this.twilioAccountSid = env.TWILIO_ACCOUNT_SID;
    this.twilioAuthToken = env.TWILIO_AUTH_TOKEN;
    this.fromNumber = env.TWILIO_PHONE_NUMBER;  // Use same variable as working SMS service
  }

  /**
   * Generate a secure token for portal access
   * In production, this should use proper JWT or database tokens
   */
  private generateSecureToken(userId: number, linkType: string): string {
    const timestamp = Date.now();
    const randomBytes = Math.random().toString(36).substring(2, 15);
    return Buffer.from(`${userId}_${linkType}_${timestamp}_${randomBytes}`).toString('base64url');
  }

  /**
   * Generate the portal URL based on link type
   */
  private generatePortalUrl(userId: number, linkType: string): string {
    const token = this.generateSecureToken(userId, linkType);
    
    const linkPaths = {
      'claims': '/claims',
      'documents': '/upload',
      'status': '/status'
    };
    
    const path = linkPaths[linkType] || '/claims';
    return `${this.baseUrl}${path}?token=${token}&user=${userId}`;
  }

  /**
   * Send portal link via SMS with AI voice-specific formatting
   * Uses simple, clean message format as requested
   */
  async sendPortalLink(options: AIPortalLinkOptions): Promise<AIPortalLinkResult> {
    const { userId, phoneNumber, linkType, userName } = options;
    
    try {
      // Generate the portal URL
      const portalUrl = this.generatePortalUrl(userId, linkType);
      
      // Create simple, clean message format for AI voice
      const message = `Access your portal here: ${portalUrl}`;
      
      console.log(`📱 [AI-VOICE-PORTAL] Sending portal link:`, {
        userId,
        phoneNumber: phoneNumber.substring(0, 8) + '***',
        linkType,
        userName
      });

      // Send SMS via Twilio
      const smsResult = await this.sendSMS(phoneNumber, message);
      
      if (smsResult.success) {
        logger.info('AI Voice portal link sent successfully', {
          userId,
          linkType,
          messageId: smsResult.messageId,
          phoneNumber: phoneNumber.substring(0, 8) + '***'
        });
        
        return {
          success: true,
          message: `I've sent you a secure portal link via text message. You should receive it shortly.`,
          messageId: smsResult.messageId
        };
      } else {
        return {
          success: false,
          message: `I couldn't send the text message right now. Please try again or contact us directly.`,
          error: smsResult.error
        };
      }
      
    } catch (error) {
      logger.error('AI Voice portal link sending failed:', {
        userId,
        linkType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        message: `I'm sorry, I couldn't send your portal link right now. Please try again later.`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send SMS using Twilio API
   * Direct implementation for AI voice to avoid dependencies
   */
  private async sendSMS(toNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;
      
      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: this.fromNumber,
          To: toNumber,
          Body: message
        })
      });
      
      if (response.ok) {
        const smsData = await response.json();
        console.log(`✅ [AI-VOICE-PORTAL] SMS sent successfully:`, {
          messageId: smsData.sid,
          to: toNumber.substring(0, 8) + '***'
        });
        
        return {
          success: true,
          messageId: smsData.sid
        };
      } else {
        const errorData = await response.json();
        console.error(`❌ [AI-VOICE-PORTAL] Twilio API error:`, errorData);
        
        return {
          success: false,
          error: errorData.message || 'Failed to send SMS'
        };
      }
    } catch (error) {
      console.error(`❌ [AI-VOICE-PORTAL] SMS sending error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send different types of portal links with context-aware messages
   * Can be extended for more sophisticated messaging if needed
   */
  async sendClaimsPortal(userId: number, phoneNumber: string, userName?: string): Promise<AIPortalLinkResult> {
    return this.sendPortalLink({
      userId,
      phoneNumber,
      linkType: 'claims',
      userName
    });
  }

  async sendDocumentsPortal(userId: number, phoneNumber: string, userName?: string): Promise<AIPortalLinkResult> {
    return this.sendPortalLink({
      userId,
      phoneNumber,
      linkType: 'documents',
      userName
    });
  }

  async sendStatusPortal(userId: number, phoneNumber: string, userName?: string): Promise<AIPortalLinkResult> {
    return this.sendPortalLink({
      userId,
      phoneNumber,
      linkType: 'status',
      userName
    });
  }
}

/**
 * Create an instance of the AI Voice Portal Service
 * Used by PartyKit and other AI voice components
 */
export function createAIVoicePortalService(env: any): AIVoicePortalService {
  return new AIVoicePortalService(env);
}
