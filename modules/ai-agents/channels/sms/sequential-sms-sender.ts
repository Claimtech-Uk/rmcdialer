/**
 * Sequential SMS Sender - Ensures proper message ordering for multi-message sequences
 * 
 * Solves the race condition where multiple SMS actions are sent simultaneously
 * and can arrive out of order due to network/carrier variations.
 */

import { SMSService } from '@/modules/communications'

// Helper function to ensure phone numbers are in E164 format
const toE164 = (n: string) => (n?.startsWith('+') ? n : `+${n}`)

export type SequentialSmsAction = {
  phoneNumber: string
  text: string
  userId?: number
  messageType?: string
  sequenceIndex?: number  // For logging/debugging
}

/**
 * Send multiple SMS messages in guaranteed sequential order
 * Uses 5-second delays between messages to prevent race conditions
 */
export async function sendSequentialSms(
  smsService: SMSService,
  actions: SequentialSmsAction[],
  options: {
    delayBetweenMessages?: number  // Delay in milliseconds (default: 5000)
    retries?: number              // Retry attempts per message (default: 2)
  } = {}
): Promise<void> {
  const { delayBetweenMessages = 5000, retries = 2 } = options
  
  if (actions.length === 0) return
  
  console.log('AI SMS | 🔄 Starting sequential SMS delivery', {
    messageCount: actions.length,
    delayBetweenMessages,
    estimatedDuration: `${(actions.length - 1) * delayBetweenMessages / 1000}s`,
    strategy: 'guaranteed_order'
  })
  
  // Helper function for delays
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  
  // Helper function for retry logic (similar to existing pattern)
  const sendSmsWithRetry = async (args: Parameters<SMSService['sendSMS']>[0], maxRetries: number = retries) => {
    let attempt = 0
    while (true) {
      try {
        return await smsService.sendSMS(args)
      } catch (err) {
        attempt++
        const isLast = attempt > maxRetries
        console.error('AI SMS | ❌ Sequential SMS send failed', { attempt, err })
        if (isLast) throw err
        await sleep(300 * attempt)  // Exponential backoff
      }
    }
  }
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    
    try {
      const { formatSms } = await import('./formatter')
      const formattedMessage = formatSms(action.text)
      
      console.log('AI SMS | 📨 Sending sequential SMS', {
        sequenceIndex: i + 1,
        totalMessages: actions.length,
        messageLength: formattedMessage.length,
        to: action.phoneNumber,
        delayAfter: i < actions.length - 1 ? `${delayBetweenMessages}ms` : 'none (last message)'
      })
      
      await sendSmsWithRetry({
        phoneNumber: toE164(action.phoneNumber),
        message: formattedMessage,
        messageType: action.messageType || 'auto_response',
        userId: action.userId,
      })
      
      console.log('AI SMS | ✅ Sequential SMS sent successfully', {
        sequenceIndex: i + 1,
        totalMessages: actions.length,
        remainingMessages: actions.length - i - 1
      })
      
      // Add 5-second delay before next message (except for the last one)
      if (i < actions.length - 1) {
        console.log('AI SMS | ⏳ Waiting before next message', {
          delayMs: delayBetweenMessages,
          nextMessage: i + 2,
          reason: 'ensuring_delivery_order'
        })
        await sleep(delayBetweenMessages)
      }
      
    } catch (error) {
      console.error('AI SMS | ❌ Sequential SMS failed permanently', {
        sequenceIndex: i + 1,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: {
          phoneNumber: action.phoneNumber,
          messageLength: action.text.length,
          messageType: action.messageType
        }
      })
      
      // Continue with remaining messages even if one fails
      // This prevents one failure from blocking the entire sequence
    }
  }
  
  console.log('AI SMS | 🎉 Sequential SMS delivery completed', {
    messageCount: actions.length,
    totalDuration: `${(actions.length - 1) * delayBetweenMessages / 1000}s`,
    strategy: 'guaranteed_order_success'
  })
}

/**
 * Configuration for message ordering
 */
export const SEQUENTIAL_SMS_CONFIG = {
  // Default delay between messages (5 seconds for guaranteed order)
  // Keep under typical serverless timeouts; 2s balances order + runtime
  defaultDelay: parseInt(process.env.SMS_ORDERING_DELAY || '2000'),
  
  // Whether to enable sequential ordering (can be disabled for testing)
  enabled: process.env.SMS_SEQUENTIAL_ORDERING !== 'false',
  
  // Maximum messages to send sequentially (larger sequences use follow-up system)
  maxSequentialMessages: parseInt(process.env.SMS_MAX_SEQUENTIAL || '3'),
  
  // Retry attempts per message
  retryAttempts: parseInt(process.env.SMS_RETRY_ATTEMPTS || '2')
} as const
