import { AgentRuntimeService } from '@/modules/ai-agents/core/agent-runtime.service';
import { SMSService } from '@/modules/communications/services/sms.service';
import { MagicLinkService } from '@/modules/communications/services/magic-link.service';
import type { AgentTurnInput, AgentTurnOutput } from '@/modules/ai-agents/core/agent-runtime.service';

/**
 * Batch-specific SMS processor that bypasses the database handler
 * This is used ONLY by the cron job to process batched messages
 */
export class BatchSmsProcessor {
  private runtime: AgentRuntimeService;
  private smsService: SMSService;
  
  constructor(smsService: SMSService, magicLinkService: MagicLinkService) {
    this.smsService = smsService;
    this.runtime = new AgentRuntimeService(smsService, magicLinkService);
  }
  
  /**
   * Process a batch of messages directly without database locking
   * This method is called ONLY after messages are already batched
   */
  async processBatch(input: {
    fromPhone: string;
    message: string;
    userId?: number;
    replyFromE164?: string;
    messageSid?: string;
  }): Promise<AgentTurnOutput> {
    console.log('AI SMS | 📦 Batch processor started', {
      fromPhone: input.fromPhone,
      messageLength: input.message.length,
      userId: input.userId,
      mode: 'batch_processing_only'
    });
    
    // Prepare input for runtime
    const turnInput: AgentTurnInput = {
      fromPhone: input.fromPhone,
      message: input.message,
      userId: input.userId,
      channel: 'sms'
    };
    
    // Process with runtime directly (no database handler)
    const result = await this.runtime.handleTurn(turnInput);
    
    console.log('AI SMS | 🤖 Batch processing complete', {
      hasReply: !!result.reply?.text,
      replyLength: result.reply?.text?.length || 0,
      actionCount: result.actions?.length || 0
    });
    
    // Send SMS if there's a reply
    if (result.reply?.text && input.replyFromE164) {
      try {
        const formattedMessage = this.formatSmsMessage(result.reply.text);
        
        await this.smsService.sendSMS({
          phoneNumber: input.fromPhone,
          message: formattedMessage,
          messageType: 'auto_response',
          userId: input.userId
        });
        
        console.log('AI SMS | 📨 Batch SMS sent', {
          to: input.fromPhone,
          messageLength: formattedMessage.length
        });
      } catch (error) {
        console.error('AI SMS | ❌ Failed to send batch SMS', {
          error: error instanceof Error ? error.message : error,
          phoneNumber: input.fromPhone
        });
      }
    }
    
    // Process any non-SMS actions
    if (result.actions && result.actions.length > 0) {
      for (const action of result.actions) {
        if (action.type !== 'sms') {
          console.log('AI SMS | ⚡ Processing batch action', {
            type: action.type,
            phoneNumber: input.fromPhone
          });
          // Action processing would go here
        }
      }
    }
    
    return result;
  }
  
  private formatSmsMessage(text: string): string {
    // Format the message with proper spacing
    return text
      .replace(/\n{3,}/g, '\n\n') // Max 2 line breaks
      .trim();
  }
}
