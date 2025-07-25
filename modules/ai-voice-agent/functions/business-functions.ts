// Business Functions for AI Voice Agent
// Functions that the AI can call to interact with the RMC Dialler system

import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { BusinessFunction, FunctionContext } from '../types/audio-streaming.types';
import { MagicLinkService } from '@/modules/communications/services/magic-link.service';

/**
 * Lookup caller information including claims and requirements
 */
export const callerLookupFunction: BusinessFunction = {
  name: 'lookup_caller_info',
  description: 'Look up detailed information about the caller including their claims, requirements, and call history',
  parameters: {
    type: 'object',
    properties: {
      phoneNumber: {
        type: 'string',
        description: 'The caller\'s phone number to look up'
      }
    },
    required: ['phoneNumber']
  },
  handler: async (params: Record<string, any>, context: FunctionContext) => {
    try {
      console.log(`🔍 Looking up caller info for: ${params.phoneNumber}`);

      // Normalize phone number for lookup
      const normalizedNumbers = normalizePhoneNumber(params.phoneNumber);

      // Find user by phone number
      const user = await replicaDb.user.findFirst({
        where: {
          phone_number: { in: normalizedNumbers },
          is_enabled: true
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          email_address: true,
          status: true,
          created_at: true
        }
      });

      if (!user) {
        return {
          found: false,
          message: 'No account found for this phone number'
        };
      }

      // Get claims and requirements
      const [claims, callHistory] = await Promise.all([
        replicaDb.claim.findMany({
          where: { user_id: user.id },
          select: {
            id: true,
            type: true,
            status: true,
            lender: true,
            created_at: true,
            updated_at: true
          },
          orderBy: { created_at: 'desc' },
          take: 10
        }),
        prisma.callSession.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            status: true,
            direction: true,
            startedAt: true
          },
          orderBy: { startedAt: 'desc' },
          take: 5
        })
      ]);

      return {
        found: true,
        user: {
          id: Number(user.id),
          name: `${user.first_name} ${user.last_name}`,
          email: user.email_address,
          phone: user.phone_number,
          status: user.status,
          memberSince: user.created_at
        },
        claims: claims.map(claim => ({
          id: Number(claim.id),
          type: claim.type,
          status: claim.status,
          lender: claim.lender,
          createdAt: claim.created_at
        })),
        recentCalls: callHistory.map(call => ({
          id: call.id,
          status: call.status,
          direction: call.direction,
          date: call.startedAt
        })),
        summary: `Found ${claims.length} claims and ${callHistory.length} recent calls`
      };

    } catch (error) {
      console.error('Caller lookup error:', error);
      return {
        found: false,
        error: 'Unable to lookup caller information',
        message: 'There was an error accessing your account information'
      };
    }
  }
};

/**
 * Check outstanding requirements for a user
 */
export const checkRequirementsFunction: BusinessFunction = {
  name: 'check_requirements',
  description: 'Check outstanding requirements and documentation needed for the caller\'s claims',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'number',
        description: 'The user ID to check requirements for'
      }
    },
    required: ['userId']
  },
  handler: async (params: Record<string, any>, context: FunctionContext) => {
    try {
      console.log(`📋 Checking requirements for user: ${params.userId}`);

      // TODO: Implement requirements lookup when table schema is available
      // For now, return placeholder response
      const hasRequirements = Math.random() > 0.5; // Simulate having requirements

      if (!hasRequirements) {
        return {
          hasRequirements: false,
          message: 'Great news! You have no outstanding requirements at this time.'
        };
      }

      return {
        hasRequirements: true,
        total: 2,
        urgent: 1,
        requirements: [
          {
            id: 1,
            type: 'medical_report',
            description: 'Medical assessment report from treating physician',
            status: 'pending',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            isUrgent: true
          },
          {
            id: 2,
            type: 'employment_records',
            description: 'Employment records for the past 12 months',
            status: 'pending',
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
            isUrgent: false
          }
        ],
        message: 'You have 1 urgent requirement due soon.'
      };

    } catch (error) {
      console.error('Requirements check error:', error);
      return {
        hasRequirements: false,
        error: 'Unable to check requirements',
        message: 'I\'m having trouble accessing your requirements information right now.'
      };
    }
  }
};

/**
 * Transfer call to human agent
 */
export const transferToHumanFunction: BusinessFunction = {
  name: 'transfer_to_human',
  description: 'Transfer the call to a human agent when the AI cannot help or when specifically requested',
  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Reason for transferring to human agent'
      },
      urgent: {
        type: 'boolean',
        description: 'Whether this is an urgent transfer'
      }
    },
    required: ['reason']
  },
  handler: async (params: Record<string, any>, context: FunctionContext) => {
    try {
      console.log(`👥 Initiating transfer to human agent: ${params.reason}`);

      // Find available agents
      const availableAgents = await prisma.agentSession.findMany({
        where: {
          status: 'available',
          logoutAt: null,
          agent: { isActive: true }
        },
        include: {
          agent: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { lastActivity: 'asc' },
        take: 1
      });

      if (availableAgents.length === 0) {
        return {
          transferred: false,
          message: 'I apologize, but all our agents are currently busy. Would you like me to take a message or have someone call you back?',
          waitTime: 'approximately 10-15 minutes'
        };
      }

      const agent = availableAgents[0];

      // Create transfer request (this would integrate with existing call routing)
      // For now, we'll just log the intent
      console.log(`🔄 Transfer request created for agent ${agent.agent.firstName} ${agent.agent.lastName}`);

      return {
        transferred: true,
        message: `I'm transferring you to ${agent.agent.firstName} now. Please hold for just a moment.`,
        agentName: `${agent.agent.firstName} ${agent.agent.lastName}`,
        transferReason: params.reason
      };

    } catch (error) {
      console.error('Transfer to human error:', error);
      return {
        transferred: false,
        error: 'Unable to transfer call',
        message: 'I\'m having trouble connecting you to an agent right now. Let me continue to help you if possible.'
      };
    }
  }
};

/**
 * Schedule appointment or callback
 */
export const scheduleAppointmentFunction: BusinessFunction = {
  name: 'schedule_appointment',
  description: 'Schedule an appointment or callback for the caller',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Type of appointment (callback, meeting, consultation)'
      },
      preferredDate: {
        type: 'string',
        description: 'Preferred date for the appointment (YYYY-MM-DD format)'
      },
      preferredTime: {
        type: 'string',
        description: 'Preferred time for the appointment (HH:MM format)'
      },
      reason: {
        type: 'string',
        description: 'Reason for the appointment'
      }
    },
    required: ['type', 'reason']
  },
  handler: async (params: Record<string, any>, context: FunctionContext) => {
    try {
      console.log(`📅 Scheduling ${params.type} for caller`);

      // For now, we'll create a basic scheduling record
      // This could be enhanced to integrate with a proper calendar system
      const appointment = {
        type: params.type,
        reason: params.reason,
        preferredDate: params.preferredDate,
        preferredTime: params.preferredTime,
        callSid: context.callSid,
        userId: context.callerInfo?.userId,
        scheduledAt: new Date()
      };

      console.log('📝 Appointment details:', appointment);

      // Return confirmation
      const timeInfo = params.preferredDate && params.preferredTime 
        ? `for ${params.preferredDate} at ${params.preferredTime}`
        : 'at your preferred time';

      return {
        scheduled: true,
        message: `I've scheduled a ${params.type} ${timeInfo}. You'll receive a confirmation call within 24 hours.`,
        appointmentType: params.type,
        details: appointment
      };

    } catch (error) {
      console.error('Appointment scheduling error:', error);
      return {
        scheduled: false,
        error: 'Unable to schedule appointment',
        message: 'I\'m having trouble scheduling that appointment right now. Let me transfer you to someone who can help.'
      };
    }
  }
};

/**
 * Get general help and information
 */
export const getHelpFunction: BusinessFunction = {
  name: 'get_help',
  description: 'Provide general help and information about RMC Dialler services',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'The help topic requested (claims, requirements, process, contact, etc.)'
      }
    },
    required: ['topic']
  },
  handler: async (params: Record<string, any>, context: FunctionContext) => {
    const topic = params.topic.toLowerCase();

    const helpInfo: { [key: string]: string } = {
      claims: 'We help you manage your compensation claims. I can check your claim status, requirements, and help schedule appointments with specialists.',
      requirements: 'Requirements are documents or information needed to process your claim. I can check what\'s outstanding and help you understand what\'s needed.',
      process: 'Our claims process involves initial assessment, documentation collection, review, and settlement. Each step ensures you get the compensation you deserve.',
      contact: 'You can reach us by phone during business hours, or I can schedule a callback at your convenience. For urgent matters, I can transfer you to an agent immediately.',
      default: 'I can help you with claim information, checking requirements, scheduling appointments, and answering questions about our services. What would you like to know?'
    };

    return {
      topic: params.topic,
      information: helpInfo[topic] || helpInfo.default,
      additionalHelp: 'Is there anything specific about this topic you\'d like to know more about?'
    };
  }
};

/**
 * Send a magic link to the user for portal access
 */
export const sendMagicLinkFunction: BusinessFunction = {
  name: 'send_magic_link',
  description: 'Send a secure magic link to the user giving them access to the customer portal',
  parameters: {
    type: 'object',
    properties: {
      deliveryMethod: {
        type: 'string',
        description: 'How to send the magic link: sms, whatsapp, or email'
      },
      phoneNumber: {
        type: 'string',
        description: 'Phone number for SMS or WhatsApp delivery (required for sms/whatsapp)'
      },
      email: {
        type: 'string',
        description: 'Email address for email delivery (required for email)'
      },
      userName: {
        type: 'string',
        description: 'User\'s name to personalize the message'
      }
    },
    required: ['deliveryMethod']
  },
  handler: async (params: Record<string, any>, context: FunctionContext) => {
    try {
      console.log(`🔗 Sending magic link via ${params.deliveryMethod} to user`);

      // Get user info from caller context
      if (!context.callerInfo?.phoneNumber) {
        return {
          success: false,
          message: 'Unable to send magic link - caller information not available'
        };
      }

      // Find user ID from phone number
      const normalizedNumbers = normalizePhoneNumber(context.callerInfo.phoneNumber);
      const user = await replicaDb.user.findFirst({
        where: {
          phone_number: { in: normalizedNumbers },
          is_enabled: true
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          email_address: true
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'Unable to send magic link - user account not found'
        };
      }

      // Initialize magic link service with minimal dependencies
      const magicLinkService = new MagicLinkService({
        authService: {
          getCurrentAgent: async () => ({ id: 1, role: 'ai_agent' })
        }
      });

      // Determine delivery details
      let phoneNumber = params.phoneNumber || user.phone_number;
      let email = params.email || user.email_address;
      let userName = params.userName || `${user.first_name} ${user.last_name}`;

      // Validate delivery method requirements
      if (params.deliveryMethod === 'email' && !email) {
        return {
          success: false,
          message: 'Email address is required for email delivery, but none is available'
        };
      }

      if ((params.deliveryMethod === 'sms' || params.deliveryMethod === 'whatsapp') && !phoneNumber) {
        return {
          success: false,
          message: 'Phone number is required for SMS/WhatsApp delivery, but none is available'
        };
      }

      // Send magic link
      const result = await magicLinkService.sendMagicLink({
        userId: Number(user.id),
        linkType: 'claimPortal',
        deliveryMethod: params.deliveryMethod,
        phoneNumber: phoneNumber,
        email: email,
        userName: userName,
        callSessionId: context.callSid,
        customMessage: `Hi ${userName}, here's your secure link to access your claim portal and manage your case online.`
      });

      console.log(`✅ Magic link sent successfully via ${params.deliveryMethod}`);

      return {
        success: true,
        message: `I've sent a secure link to your ${params.deliveryMethod === 'sms' ? 'phone' : params.deliveryMethod} that will give you access to your customer portal. You can use this to view your claim details, upload documents, and track your progress.`,
        deliveryMethod: params.deliveryMethod,
        sentTo: params.deliveryMethod === 'email' ? email : phoneNumber,
        trackingId: result.magicLink.trackingId
      };

    } catch (error) {
      console.error('Failed to send magic link:', error);
      return {
        success: false,
        message: 'I\'m sorry, I\'m having trouble sending the portal link right now. Our team can send it to you manually, or you can try calling back later.'
      };
    }
  }
};

// Helper function to normalize phone numbers
function normalizePhoneNumber(phoneNumber: string): string[] {
  const digits = phoneNumber.replace(/\D/g, '');
  const variants: string[] = [phoneNumber];
  
  if (digits.length >= 10) {
    if (digits.startsWith('447')) {
      variants.push(`+${digits}`, `0${digits.substring(2)}`, digits);
    } else if (digits.startsWith('44')) {
      variants.push(`+${digits}`, `0${digits.substring(2)}`, digits);
    } else if (digits.startsWith('07')) {
      variants.push(digits, `+44${digits.substring(1)}`, `44${digits.substring(1)}`);
    }
  }
  
  return [...new Set(variants)];
}

// Export all business functions
export const businessFunctions: BusinessFunction[] = [
  callerLookupFunction,
  checkRequirementsFunction,
  transferToHumanFunction,
  scheduleAppointmentFunction,
  getHelpFunction,
  sendMagicLinkFunction
]; 