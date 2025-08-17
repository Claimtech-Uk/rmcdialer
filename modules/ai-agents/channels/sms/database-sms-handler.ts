import { PrismaClient } from '@prisma/client'
import { logger } from '@/modules/core'

const prisma = new PrismaClient()

export interface InboundMessage {
  messageSid: string
  phoneNumber: string
  text: string
  timestamp: number
  userId?: number
}

export interface DatabaseProcessingResult {
  processed: boolean
  response?: string
  reason: string
  error?: string
  messageId?: string
  retryAfterSeconds?: number
}

/**
 * Database-first SMS handler using atomic database operations
 * Goals: 
 * - Use existing database fields (processed, processedAt, phoneNumber, userId, messageSid)
 * - Eliminate Redis dependencies completely
 * - Atomic operations to prevent race conditions
 * - Reliable message processing with full audit trail
 */
export class DatabaseSmsHandler {
  private readonly PROCESSING_TIMEOUT = 30000 // 30 seconds
  private readonly MAX_RETRIES = 2
  private readonly RETRY_DELAY = 1000 // 1 second between retries

  /**
   * Process SMS message using database-atomic operations
   * Logic:
   * 1. Try to acquire "lock" by updating message record atomically
   * 2. If successful, gather ALL unprocessed messages for this phone
   * 3. Process the batch with retries
   * 4. Mark ALL messages as processed atomically
   * 5. Return success/failure with detailed reason
   */
  async handleMessage(
    message: InboundMessage,
    processCallback: (messages: InboundMessage[], attempt: number) => Promise<string>
  ): Promise<DatabaseProcessingResult> {
    const { phoneNumber: rawPhoneNumber, messageSid, userId, text, timestamp } = message
    
    // 🎯 CRITICAL FIX: Normalize phone number to match database format (no + prefix)
    const phoneNumber = rawPhoneNumber.replace(/^\+/, '')
    
    logger.info('AI SMS | 🎯 Database processing started', {
      phoneNumber: rawPhoneNumber,
      normalizedPhone: phoneNumber,  // 🎯 FIXED: Show both formats for debugging
      messageSid,
      userId,
      goal: 'phone_number_normalized_processing'
    })

    try {
      // STEP 1: Try to acquire processing lock via atomic database update
      // Goal: Only one process can successfully "claim" processing for this phone number
      const acquired = await this.acquireProcessingLock(messageSid, phoneNumber, userId)
      
      if (!acquired) {
        // Another process is handling messages for this phone number
        logger.info('AI SMS | 🔒 Processing already in progress for phone', {
          phoneNumber,
          messageSid,
          reason: 'atomic_lock_failed'
        })
        
        return {
          processed: false,
          reason: 'processing_in_progress',
          retryAfterSeconds: 5
        }
      }

      // STEP 2: We have the phone number lock - gather ALL locked messages for this phone
      // FIXED: Process all locked messages together to avoid fragmentation
      const lockedMessages = await this.getUnprocessedMessages(phoneNumber)
      
      logger.info('AI SMS | 📦 Processing phone number batch', {
        phoneNumber,
        messageCount: lockedMessages.length,
        currentMessageSid: messageSid,
        goal: 'phone_number_batch_processing'  // 🎯 FIXED: Updated goal
      })

      // STEP 3: Process locked batch with retries
      // Goal: Reliable processing of the locked phone number batch
      const result = await this.processWithRetries(
        lockedMessages,
        processCallback
      )

      // STEP 4: Mark ALL locked messages as processed atomically
      // Goal: Complete processing of the entire phone number batch
      await this.markMessagesProcessed(
        lockedMessages.map(m => m.messageSid), 
        result.response
      )

      logger.info('AI SMS | ✅ Phone number batch processing completed', {
        phoneNumber,
        messageCount: lockedMessages.length,
        responseLength: result.response.length,
        goal: 'phone_number_batch_complete_success'  // 🎯 FIXED: Updated goal
      })

      return {
        processed: true,
        response: result.response,
        reason: result.reason,
        messageId: messageSid
      }

    } catch (error) {
      logger.error('AI SMS | ❌ Database processing failed', {
        phoneNumber,
        messageSid,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })

      // Always try to clean up any locks we might have created
      await this.releaseProcessingLock(phoneNumber)

      return {
        processed: false,
        reason: 'processing_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Atomic lock acquisition using database UPDATE with WHERE conditions
   * Goal: Only one process can successfully mark a message as "being processed"
   * 
   * Logic: Use the specific message as a "lock token" - update it to show processing started
   * If another process already updated it, this will affect 0 rows
   */
  private async acquireProcessingLock(
    messageSid: string,
    phoneNumber: string,
    userId?: number
  ): Promise<boolean> {
    try {
      const lockTimestamp = new Date()
      
      // FIXED: Try to "claim" ALL unprocessed messages for this phone number
      // Goal: Phone-number-based global lock - only one process can lock all messages for a phone
      const result = await prisma.smsMessage.updateMany({
        where: {
          phoneNumber: phoneNumber,  // 🎯 FIXED: Lock by phone number, not individual message
          direction: 'inbound',
          processed: false,
          // Additional safety: make sure not already being processed
          processedAt: null
        },
        data: {
          processed: false, // Keep false until completely done
          processedAt: lockTimestamp, // This is our "lock timestamp"
          phoneNumber: phoneNumber,
          userId: userId || null
        }
      })

      // If we updated any rows, we have the phone number lock
      const acquired = result.count > 0  // 🎯 FIXED: > 0 means we locked messages for this phone
      
      if (acquired) {
        logger.info('AI SMS | 🔒 Phone number batch lock acquired', {
          messageSid,
          phoneNumber,
          lockedMessageCount: result.count,  // 🎯 FIXED: Show how many messages were locked
          lockTimestamp,
          goal: 'phone_number_batch_lock_success'
        })
      } else {
        logger.info('AI SMS | 🔒 Phone number already being processed', {
          messageSid,
          phoneNumber,
          updatedCount: result.count,
          goal: 'phone_number_batch_lock_prevented_race'
        })
      }

      return acquired

    } catch (error) {
      logger.error('AI SMS | ❌ Failed to acquire atomic processing lock', {
        messageSid,
        phoneNumber,
        error: error instanceof Error ? error.message : error
      })
      return false
    }
  }

  /**
   * Get all LOCKED messages for a phone number, ordered by timestamp
   * FIXED: Only get messages that are currently locked for processing
   * Goal: Process only the batch we locked, ignore new messages that arrive during processing
   */
  private async getUnprocessedMessages(phoneNumber: string): Promise<InboundMessage[]> {
    try {
      const messages = await prisma.smsMessage.findMany({
        where: {
          phoneNumber: phoneNumber,
          direction: 'inbound',
          processed: false,
          processedAt: { not: null }  // 🎯 FIXED: Only get messages we locked (have processedAt but not processed)
        },
        orderBy: {
          receivedAt: 'asc' // Process in chronological order
        },
        select: {
          messageSid: true,
          body: true,
          receivedAt: true,
          userId: true,
          phoneNumber: true,
          createdAt: true
        }
      })

      const validMessages = messages
        .filter(msg => msg.messageSid && msg.body && msg.phoneNumber)
        .map(msg => ({
          messageSid: msg.messageSid!,
          text: msg.body!,
          phoneNumber: msg.phoneNumber!,
          timestamp: msg.receivedAt?.getTime() || msg.createdAt.getTime(),
          userId: msg.userId ? Number(msg.userId) : undefined
        }))

      logger.info('AI SMS | 📋 Retrieved locked message batch', {
        phoneNumber,
        totalFound: messages.length,
        validMessages: validMessages.length,
        goal: 'phone_number_locked_batch_collection'  // 🎯 FIXED: Updated goal description
      })

      return validMessages

    } catch (error) {
      logger.error('AI SMS | ❌ Failed to get unprocessed messages', {
        phoneNumber,
        error: error instanceof Error ? error.message : error
      })
      return []
    }
  }

  /**
   * Process messages with retry logic
   * Goal: Reliable processing with automatic retry on transient failures
   */
  private async processWithRetries(
    messages: InboundMessage[],
    processCallback: (messages: InboundMessage[], attempt: number) => Promise<string>
  ): Promise<{ response: string; reason: string }> {
    let lastError: Error | null = null
    let attempt = 0

    while (attempt < this.MAX_RETRIES) {
      attempt++
      
      try {
        logger.info('AI SMS | 🔄 Processing attempt started', {
          attempt,
          maxRetries: this.MAX_RETRIES,
          messageCount: messages.length,
          goal: 'reliable_processing'
        })

        const response = await processCallback(messages, attempt)
        
        if (!response || response.trim().length === 0) {
          throw new Error('Empty response from LLM callback')
        }

        logger.info('AI SMS | ✅ Processing attempt successful', {
          attempt,
          messageCount: messages.length,
          responseLength: response.length,
          goal: 'processing_success'
        })

        return {
          response,
          reason: `processed_successfully_attempt_${attempt}`
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown processing error')
        
        logger.warn('AI SMS | ⚠️ Processing attempt failed', {
          attempt,
          maxRetries: this.MAX_RETRIES,
          error: lastError.message,
          willRetry: attempt < this.MAX_RETRIES,
          goal: 'retry_logic'
        })

        if (attempt < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt))
        }
      }
    }

    // All retries exhausted
    logger.error('AI SMS | ❌ All processing attempts failed', {
      attempts: this.MAX_RETRIES,
      finalError: lastError?.message,
      goal: 'processing_failed'
    })
    
    throw lastError || new Error('Processing failed after all retries')
  }

  /**
   * Mark all messages as processed atomically
   * Goal: Ensure database accurately reflects processing completion
   */
  private async markMessagesProcessed(
    messageSids: string[],
    response: string
  ): Promise<void> {
    try {
      if (messageSids.length === 0) return

      const now = new Date()
      
      // Atomic update: Mark all messages as processed
      // Goal: Single transaction to update all processed messages
      const result = await prisma.smsMessage.updateMany({
        where: {
          messageSid: {
            in: messageSids
          }
        },
        data: {
          processed: true,
          processedAt: now
        }
      })

      logger.info('AI SMS | ✅ Messages marked as processed atomically', {
        updated: result.count,
        expected: messageSids.length,
        messageSids: messageSids,
        responseLength: response.length,
        goal: 'atomic_completion'
      })

      // Verification: Ensure all messages were updated
      if (result.count !== messageSids.length) {
        logger.error('AI SMS | ❌ Not all messages were marked processed', {
          updated: result.count,
          expected: messageSids.length,
          missing: messageSids.length - result.count,
          goal: 'data_integrity_warning'
        })
        
        // This is a serious issue - some messages may be stuck
        throw new Error(`Only ${result.count}/${messageSids.length} messages marked processed`)
      }

    } catch (error) {
      logger.error('AI SMS | ❌ Failed to mark messages as processed', {
        messageSids,
        error: error instanceof Error ? error.message : error,
        goal: 'atomic_completion_failed'
      })
      throw error
    }
  }

  /**
   * Release processing lock (cleanup operation)
   * Goal: Clean up any stuck processing states to prevent permanent blocks
   */
  private async releaseProcessingLock(phoneNumber: string): Promise<void> {
    try {
      // Clean up any messages that have been "processing" too long
      const cutoffTime = new Date(Date.now() - this.PROCESSING_TIMEOUT)
      
      const result = await prisma.smsMessage.updateMany({
        where: {
          phoneNumber: phoneNumber,
          processed: false,
          processedAt: {
            lt: cutoffTime // Processing started more than 30 seconds ago
          }
        },
        data: {
          processedAt: null // Clear the processing timestamp to allow retry
        }
      })

      if (result.count > 0) {
        logger.info('AI SMS | 🧹 Released stuck processing locks', {
          phoneNumber,
          releasedCount: result.count,
          timeoutSeconds: this.PROCESSING_TIMEOUT / 1000,
          goal: 'cleanup_stuck_processing'
        })
      }

    } catch (error) {
      logger.error('AI SMS | ❌ Failed to release processing locks', {
        phoneNumber,
        error: error instanceof Error ? error.message : error
      })
    }
  }

  /**
   * Health check method to clean up any stuck processing across all phone numbers
   * Goal: Scheduled cleanup to prevent permanent stuck states
   */
  async cleanStuckProcessing(maxAgeMinutes: number = 5): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)
      
      // Find and clean up any messages stuck in processing state
      const result = await prisma.smsMessage.updateMany({
        where: {
          processed: false,
          processedAt: {
            not: null,
            lt: cutoffTime
          }
        },
        data: {
          processedAt: null // Clear processing timestamp to allow retry
        }
      })

      if (result.count > 0) {
        logger.info('AI SMS | 🧹 Cleaned stuck processing locks globally', {
          cleanedCount: result.count,
          maxAgeMinutes,
          goal: 'global_cleanup'
        })
      }

      return result.count

    } catch (error) {
      logger.error('AI SMS | ❌ Failed to clean stuck processing globally', { 
        error: error instanceof Error ? error.message : error 
      })
      return 0
    }
  }

  /**
   * Get processing statistics for monitoring
   * Goal: Visibility into system health and processing status
   */
  async getProcessingStats(): Promise<{
    unprocessed: number
    processing: number
    processed: number
    stuck: number
  }> {
    try {
      const cutoffTime = new Date(Date.now() - this.PROCESSING_TIMEOUT)

      const [unprocessed, processing, processed, stuck] = await Promise.all([
        // Messages not yet processed and not being processed
        prisma.smsMessage.count({
          where: {
            direction: 'inbound',
            processed: false,
            processedAt: null
          }
        }),
        // Messages currently being processed (recent processedAt)
        prisma.smsMessage.count({
          where: {
            direction: 'inbound', 
            processed: false,
            processedAt: {
              gte: cutoffTime
            }
          }
        }),
        // Messages successfully processed
        prisma.smsMessage.count({
          where: {
            direction: 'inbound',
            processed: true
          }
        }),
        // Messages stuck in processing (old processedAt but not completed)
        prisma.smsMessage.count({
          where: {
            direction: 'inbound',
            processed: false,
            processedAt: {
              lt: cutoffTime
            }
          }
        })
      ])

      return { unprocessed, processing, processed, stuck }

    } catch (error) {
      logger.error('AI SMS | ❌ Failed to get processing stats', { error })
      return { unprocessed: 0, processing: 0, processed: 0, stuck: 0 }
    }
  }
}

export const databaseSmsHandler = new DatabaseSmsHandler()
