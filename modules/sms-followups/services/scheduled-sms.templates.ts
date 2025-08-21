// =============================================================================
// SMS Follow-ups Templates
// =============================================================================
// Message templates for each follow-up type with safe personalization

import { MagicLinkService } from '@/modules/communications';
import type { TemplateMap, TemplateContext } from '../types';

// -----------------------------------------------------------------------------
// Template Generators
// -----------------------------------------------------------------------------

export const smsTemplates: TemplateMap = {
  'no_answer_checkin': {
    key: 'no_answer_checkin',
    messageType: 'no_answer_checkin',
    generate: async ({ firstName, userId, phoneNumber }: TemplateContext) => {
      const name = firstName ? `Hi ${firstName}` : 'Hi';
      
      // Generate magic link for claims portal
      const magicLinkService = new MagicLinkService({
        authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) },
        userService: {
          async getUserData(uid: number) {
            return {
              id: uid,
              firstName: firstName || 'Unknown',
              lastName: '',
              email: '',
              phoneNumber: phoneNumber
            };
          }
        }
      });

      try {
        const linkResult = await magicLinkService.generateMagicLink({
          userId,
          linkType: 'claimPortal',
          deliveryMethod: 'sms'
        });

        const portalUrl = linkResult.url;

        return `${name},

It's Sophie from Resolve My Claim 👋 I just tried giving you a quick call about your car finance claim.

Have you got any questions I can answer before you get started?

If not, finish signing up here: ${portalUrl}`;
      } catch (error) {
        console.error('Error generating magic link for no_answer template:', error);
        
        // Fallback to main portal URL
        const fallbackUrl = process.env.MAIN_APP_URL || 'https://portal.resolvemyclaim.co.uk';
        return `${name},

It's Sophie from Resolve My Claim 👋 I just tried giving you a quick call about your car finance claim.

Have you got any questions I can answer before you get started?

If not, finish signing up here: ${fallbackUrl}`;
      }
    }
  },

  'callback_confirmation': {
    key: 'callback_confirmation',
    messageType: 'callback_confirmation',
    generate: async ({ firstName, meta }: TemplateContext) => {
      const name = firstName || 'there';
      const callbackTime = meta?.callbackTime 
        ? new Date(meta.callbackTime).toLocaleString('en-GB', {
            timeZone: 'Europe/London',
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
        : 'your requested time';

      return `Hi ${name},

It was lovely speaking with you. We'll give you a call at ${callbackTime} as agreed.

Kind regards,
Sophie`;
    }
  },

  'completion_reminder_evening': {
    key: 'completion_reminder_evening',
    messageType: 'completion_reminder',
    generate: async ({ firstName, userId, phoneNumber }: TemplateContext) => {
      const name = firstName || 'there';
      
      // Generate magic link for claims portal
      const magicLinkService = new MagicLinkService({
        authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) },
        userService: {
          async getUserData(uid: number) {
            return {
              id: uid,
              firstName: firstName || 'Unknown',
              lastName: '',
              email: '',
              phoneNumber: phoneNumber
            };
          }
        }
      });

      try {
        const linkResult = await magicLinkService.generateMagicLink({
          userId,
          linkType: 'claimPortal',
          deliveryMethod: 'sms'
        });

        const portalUrl = linkResult.url;

        return `Hi ${name},

Thanks again for speaking with us earlier 🌟 Just a quick reminder — your form only takes about 30 seconds, and once it's done we can get your claim moving straight away 🚀

Finish here: ${portalUrl}

Can't wait to get things started for you! 😊`;
      } catch (error) {
        console.error('Error generating magic link for completion reminder:', error);
        
        const fallbackUrl = process.env.MAIN_APP_URL || 'https://portal.resolvemyclaim.co.uk';
        return `Hi ${name},

Thanks again for speaking with us earlier 🌟 Just a quick reminder — your form only takes about 30 seconds, and once it's done we can get your claim moving straight away 🚀

Finish here: ${fallbackUrl}

Can't wait to get things started for you! 😊`;
      }
    }
  },

  'completion_reminder_plus_3d': {
    key: 'completion_reminder_plus_3d',
    messageType: 'completion_reminder',
    generate: async ({ firstName }: TemplateContext) => {
      const name = firstName || 'there';
      return `Hey ${name},

It's Sophie here from the Success Team at RMC. 😊

I noticed you haven't managed to finish signing up yet. I wanted to see if you were having any technical issues or had any questions before you get started?

Kind Regards, Sophie`;
    }
  },

  'maybe_completion_evening': {
    key: 'maybe_completion_evening',
    messageType: 'completion_reminder',
    generate: async ({ firstName, userId, phoneNumber }: TemplateContext) => {
      const name = firstName || 'there';
      
      // Generate magic link for claims portal
      const magicLinkService = new MagicLinkService({
        authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) },
        userService: {
          async getUserData(uid: number) {
            return {
              id: uid,
              firstName: firstName || 'Unknown',
              lastName: '',
              email: '',
              phoneNumber: phoneNumber
            };
          }
        }
      });

      try {
        const linkResult = await magicLinkService.generateMagicLink({
          userId,
          linkType: 'claimPortal',
          deliveryMethod: 'sms'
        });

        const portalUrl = linkResult.url;

        return `Hi ${name},

Thanks again for speaking with us earlier 🌟 No rush at all — your form will be ready whenever you are (it only takes 30 secs): ${portalUrl}.

Need anything? Just drop me a message — I'd be happy to help!`;
      } catch (error) {
        console.error('Error generating magic link for maybe completion:', error);
        
        const fallbackUrl = process.env.MAIN_APP_URL || 'https://portal.resolvemyclaim.co.uk';
        return `Hi ${name},

Thanks again for speaking with us earlier 🌟 No rush at all — your form will be ready whenever you are (it only takes 30 secs): ${fallbackUrl}.

Need anything? Just drop me a message — I'd be happy to help!`;
      }
    }
  },

  'maybe_completion_plus_5d': {
    key: 'maybe_completion_plus_5d',
    messageType: 'completion_reminder',
    generate: async ({ firstName }: TemplateContext) => {
      const name = firstName || 'there';
      return `Hi ${name},

It's Sophie here from the Success Team at RMC. 👋

Just checking in to see if you've had chance to think things over.

If there's anything you'd like to ask or talk through — big or small — I'd love to help you out 😊`;
    }
  },

  'review_request': {
    key: 'review_request',
    messageType: 'review_request',
    generate: async ({ firstName }: TemplateContext) => {
      const name = firstName || 'there';
      const trustpilotUrl = process.env.TRUSTPILOT_REVIEW_URL || 'trustpilot.com/evaluate/resolvemyclaim.co.uk';
      
      return `${name}, Sophie here 😊 we've got what we need to start reviewing your claims.

We always want to make sure we're giving you the best service possible — has everything felt smooth and straightforward so far?

If you've got 2 mins, it would mean a lot if you could share your experience on Trustpilot ⭐ Here's the link: ${trustpilotUrl}.`;
    }
  }
};

// -----------------------------------------------------------------------------
// Template Utilities
// -----------------------------------------------------------------------------

export async function generateMessage(
  templateKey: string,
  context: TemplateContext
): Promise<{ message: string; messageType: string; requiresConsent?: boolean }> {
  const template = smsTemplates[templateKey];
  
  if (!template) {
    throw new Error(`Template not found: ${templateKey}`);
  }

  const message = await template.generate(context);
  
  return {
    message,
    messageType: template.messageType,
    requiresConsent: template.requiresConsent
  };
}

export function getAvailableTemplates(): string[] {
  return Object.keys(smsTemplates);
}
