// EVI Business Functions Service (Simplified)
// Implements the actual business logic for functions that the EVI agent can call

import { ComprehensiveBusinessContext } from './hume-evi.service';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';

export interface FunctionCallRequest {
  functionName: string;
  parameters: Record<string, any>;
  callSid: string;
  context: ComprehensiveBusinessContext;
}

export interface FunctionCallResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

export class EVIBusinessFunctionsService {
  constructor() {
    // Simplified constructor without complex dependencies
  }

  /**
   * Route function calls to appropriate handlers
   */
  async executeFunction(request: FunctionCallRequest): Promise<FunctionCallResult> {
    const { functionName, parameters, callSid, context } = request;
    
    console.log(`🔧 Executing business function: ${functionName} for call ${callSid}`);
    console.log(`📋 Parameters:`, parameters);

    try {
      switch (functionName) {
        case 'send_magic_link':
          return await this.sendMagicLink(parameters as { linkType: string; reason: string; documentsNeeded?: string[] }, context);
          
        case 'transfer_to_agent':
          return await this.transferToAgent(parameters as { reason: string; preferredSpecialty?: string; urgency?: string; notes?: string }, context);
          
        case 'record_call_outcome':
          return await this.recordCallOutcome(parameters as { outcomeType: string; notes: string; magicLinkSent?: boolean; documentsRequested?: string[]; followUpRequired?: boolean; nextCallDelayHours?: number }, context);
          
        case 'schedule_callback':
          return await this.scheduleCallback(parameters as { callbackDateTime: string; reason: string; preferredAgentType?: string; notes?: string }, context);
          
        case 'lookup_claim_details':
          return await this.lookupClaimDetails(parameters as { claimNumber: string }, context);
          
        case 'check_requirements_status':
          return await this.checkRequirementsStatus(parameters as { requirementType?: string }, context);
          
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
    } catch (error) {
      console.error(`❌ Function execution failed: ${functionName}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `Failed to execute ${functionName}`
      };
    }
  }

  /**
   * Send magic link via SMS (simplified implementation)
   */
  private async sendMagicLink(
    params: { linkType: string; reason: string; documentsNeeded?: string[] },
    context: ComprehensiveBusinessContext
  ): Promise<FunctionCallResult> {
    try {
      if (!context.userId) {
        throw new Error('User ID required to send magic link');
      }

      const { linkType, reason } = params;
      
      console.log(`📱 Would send ${linkType} magic link to ${context.callerPhone}`);
      
      // For now, return success without actually sending
      // TODO: Integrate with actual MagicLinkService once dependency issues are resolved
      return {
        success: true,
        data: {
          linkType,
          messageId: `mock_msg_${Date.now()}`,
          expiryHours: 48
        },
        message: `Magic link would be sent to ${context.callerPhone}. ${reason}`
      };

    } catch (error) {
      console.error('❌ Failed to send magic link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send magic link',
        message: 'Unable to send secure link at this time'
      };
    }
  }

  /**
   * Transfer call to human agent
   */
  private async transferToAgent(
    params: { reason: string; preferredSpecialty?: string; urgency?: string; notes?: string },
    context: ComprehensiveBusinessContext
  ): Promise<FunctionCallResult> {
    try {
      const { reason, preferredSpecialty = 'general', urgency = 'medium' } = params;
      
      console.log(`📞 Transfer request: ${reason} (${preferredSpecialty}, ${urgency})`);
      
      // Return transfer instruction - this will be handled by the bridge service
      return {
        success: true,
        data: {
          transferType: 'agent',
          reason,
          specialty: preferredSpecialty,
          urgency,
          action: 'transfer_to_human_agent'
        },
        message: `Transferring you to a ${preferredSpecialty} agent. Please hold on.`
      };

    } catch (error) {
      console.error('❌ Failed to transfer to agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed',
        message: 'Unable to transfer to agent at this time'
      };
    }
  }

  /**
   * Record call outcome
   */
  private async recordCallOutcome(
    params: {
      outcomeType: string;
      notes: string;
      magicLinkSent?: boolean;
      documentsRequested?: string[];
      followUpRequired?: boolean;
      nextCallDelayHours?: number;
    },
    context: ComprehensiveBusinessContext
  ): Promise<FunctionCallResult> {
    try {
      const {
        outcomeType,
        notes,
        magicLinkSent = false,
        documentsRequested = [],
        followUpRequired = false,
        nextCallDelayHours
      } = params;

      // Find the call session
      const callSession = await prisma.callSession.findFirst({
        where: { twilioCallSid: context.callSid }
      });

      if (!callSession) {
        throw new Error('Call session not found');
      }

      // Record the outcome directly in database
      const outcome = await prisma.callOutcome.create({
        data: {
          callSessionId: callSession.id,
          outcomeType,
          outcomeNotes: notes,
          magicLinkSent,
          smsSent: magicLinkSent,
          documentsRequested: documentsRequested,
          recordedByAgentId: 1, // AI Agent ID
          nextCallDelayHours: nextCallDelayHours || null,
          scoreAdjustment: this.calculateScoreAdjustment(outcomeType)
        }
      });

      console.log(`📝 Recorded call outcome: ${outcomeType} for call ${context.callSid}`);

      return {
        success: true,
        data: {
          outcomeId: outcome.id,
          outcomeType,
          nextCallDelayHours,
          followUpRequired
        },
        message: `Call outcome recorded: ${outcomeType}`
      };

    } catch (error) {
      console.error('❌ Failed to record call outcome:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record outcome',
        message: 'Unable to record call outcome'
      };
    }
  }

  /**
   * Schedule callback
   */
  private async scheduleCallback(
    params: {
      callbackDateTime: string;
      reason: string;
      preferredAgentType?: string;
      notes?: string;
    },
    context: ComprehensiveBusinessContext
  ): Promise<FunctionCallResult> {
    try {
      const { callbackDateTime, reason, notes } = params;
      
      if (!context.userId) {
        throw new Error('User ID required to schedule callback');
      }

      // Find the call session
      const callSession = await prisma.callSession.findFirst({
        where: { twilioCallSid: context.callSid }
      });

      if (!callSession) {
        throw new Error('Call session not found');
      }

      // Create callback record
      const callback = await prisma.callback.create({
        data: {
          userId: BigInt(context.userId),
          scheduledFor: new Date(callbackDateTime),
          callbackReason: reason,
          originalCallSessionId: callSession.id,
          status: 'pending'
        }
      });

      console.log(`📅 Scheduled callback for ${callbackDateTime} - call ${context.callSid}`);

      return {
        success: true,
        data: {
          callbackId: callback.id,
          scheduledFor: callbackDateTime,
          reason,
          confirmationSent: false // TODO: Send SMS confirmation
        },
        message: `Callback scheduled for ${new Date(callbackDateTime).toLocaleString()}.`
      };

    } catch (error) {
      console.error('❌ Failed to schedule callback:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule callback',
        message: 'Unable to schedule callback at this time'
      };
    }
  }

  /**
   * Lookup claim details (simplified with mock data)
   */
  private async lookupClaimDetails(
    params: { claimNumber: string },
    context: ComprehensiveBusinessContext
  ): Promise<FunctionCallResult> {
    try {
      const { claimNumber } = params;

      console.log(`🔍 Looking up claim ${claimNumber} for user ${context.userId}`);
      
      // TODO: Implement actual database lookup once schema is confirmed
      // For now, return mock data for demonstration
      const mockClaimDetails = {
        claimNumber,
        status: 'Active',
        incidentDate: '2024-01-15',
        injuryType: 'Vehicle Finance',
        estimatedValue: 5000,
        createdAt: '2024-01-10',
        requirementsCount: 3,
        outstandingRequirements: 1
      };

      return {
        success: true,
        data: mockClaimDetails,
        message: `Found claim ${claimNumber}: Active status, incident date 2024-01-15`
      };

    } catch (error) {
      console.error('❌ Failed to lookup claim:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Claim lookup failed',
        message: 'Unable to lookup claim details at this time'
      };
    }
  }

  /**
   * Check requirements status (simplified with mock data)
   */
  private async checkRequirementsStatus(
    params: { requirementType?: string },
    context: ComprehensiveBusinessContext
  ): Promise<FunctionCallResult> {
    try {
      if (!context.userId) {
        throw new Error('User ID required to check requirements');
      }

      console.log(`📋 Checking requirements for user ${context.userId}`);

      // TODO: Implement actual database lookup once schema is confirmed
      // For now, return mock data for demonstration
      const mockRequirements = {
        total: 3,
        outstanding: 1,
        completed: 2,
        outstandingDetails: [
          {
            type: 'Document Upload',
            description: 'Please upload your vehicle finance agreement',
            dueDate: '2024-02-01',
            claimNumber: 'CLM123456'
          }
        ]
      };

      const message = mockRequirements.outstanding > 0 
        ? `You have ${mockRequirements.outstanding} outstanding requirements: Document Upload`
        : 'All your requirements are up to date!';

      return {
        success: true,
        data: mockRequirements,
        message
      };

    } catch (error) {
      console.error('❌ Failed to check requirements:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Requirements check failed',
        message: 'Unable to check requirements at this time'
      };
    }
  }

  // Helper methods
  private calculateScoreAdjustment(outcomeType: string): number {
    // Calculate score adjustment based on outcome
    switch (outcomeType) {
      case 'contacted':
        return 10;
      case 'completed_successfully':
        return 20;
      case 'no_answer':
        return -5;
      case 'not_interested':
        return -10;
      case 'callback_requested':
        return 5;
      default:
        return 0;
    }
  }
} 