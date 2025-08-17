/**
 * Queue Processor for handling SMS messages with proper concurrency control
 * Ensures messages from the same phone number are processed sequentially
 */

import { smsQueueService, type QueuedMessage } from './sms-queue.service'
import { isAutomationHalted } from './memory.store'

// Track if processor is running to prevent multiple instances
let processorRunning = false
let shouldStop = false

/**
 * Process queued messages
 * This function will process messages until the queue is empty
 */
export async function processQueue(
  handler: (message: QueuedMessage) => Promise<void>
): Promise<void> {
  if (processorRunning) {
    console.log('AI SMS Queue | ⏭️ Processor already running')
    return
  }
  
  processorRunning = true
  shouldStop = false
  
  console.log('AI SMS Queue | ▶️ Starting queue processor')
  
  try {
    while (!shouldStop) {
      // Get queue stats for monitoring
      const stats = await smsQueueService.getStats()
      if (stats.queueDepth === 0) {
        console.log('AI SMS Queue | 📭 Queue empty, stopping processor')
        break
      }
      
      console.log('AI SMS Queue | 📊 Queue stats', stats)
      
      // Dequeue next message
      const message = await smsQueueService.dequeue()
      if (!message) {
        // No messages available (could happen due to race condition)
        break
      }
      
      // Check if automation is halted for this number (e.g., user sent STOP)
      if (await isAutomationHalted(message.phoneNumber)) {
        console.log('AI SMS Queue | 🚫 Automation halted for number, skipping', {
          phoneNumber: message.phoneNumber,
          messageId: message.id
        })
        await smsQueueService.markCompleted(message.id)
        continue
      }
      
      // Try to acquire lock for this phone number
      const lockAcquired = await smsQueueService.acquireLock(message.phoneNumber)
      
      if (!lockAcquired) {
        // Another message for this number is being processed
        // Re-queue this message to try again later
        console.log('AI SMS Queue | 🔒 Concurrent processing detected, re-queuing', {
          phoneNumber: message.phoneNumber,
          messageId: message.id
        })
        
        // Re-queue the message (it will go to the back of the queue)
        await smsQueueService.enqueue({
          phoneNumber: message.phoneNumber,
          message: message.message,
          messageSid: message.messageSid,
          receivedAt: message.receivedAt,
          userId: message.userId,
          conversationId: message.conversationId
        })
        
        // Mark as completed (removed from processing set)
        await smsQueueService.markCompleted(message.id)
        
        // Continue to next message
        continue
      }
      
      try {
        // Process the message
        console.log('AI SMS Queue | ⚡ Processing message', { 
          id: message.id,
          phoneNumber: message.phoneNumber,
          attempts: message.attempts
        })
        
        // Call the handler (this is where the actual SMS agent logic runs)
        await handler(message)
        
        // Mark as successfully completed
        await smsQueueService.markCompleted(message.id)
        
        console.log('AI SMS Queue | ✅ Message processed successfully', { 
          id: message.id,
          phoneNumber: message.phoneNumber
        })
        
      } catch (error) {
        console.error('AI SMS Queue | ❌ Processing failed', { 
          id: message.id,
          phoneNumber: message.phoneNumber,
          error: error instanceof Error ? error.message : String(error)
        })
        
        // Mark as failed (will trigger retry logic)
        await smsQueueService.markFailed(
          message.id, 
          error instanceof Error ? error.message : String(error)
        )
      } finally {
        // Always release the lock
        await smsQueueService.releaseLock(message.phoneNumber)
      }
      
      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  } catch (error) {
    console.error('AI SMS Queue | 💥 Fatal processor error', error)
  } finally {
    processorRunning = false
    console.log('AI SMS Queue | ⏹️ Queue processor stopped')
  }
}

/**
 * Stop the queue processor gracefully
 */
export function stopProcessor(): void {
  shouldStop = true
  console.log('AI SMS Queue | 🛑 Stop signal sent to processor')
}

/**
 * Check if processor is currently running
 */
export function isProcessorRunning(): boolean {
  return processorRunning
}

/**
 * Start processing if not already running
 */
export async function ensureProcessorRunning(
  handler: (message: QueuedMessage) => Promise<void>
): Promise<void> {
  if (!processorRunning) {
    // Start processor in background (non-blocking)
    processQueue(handler).catch(error => {
      console.error('AI SMS Queue | 💥 Processor crashed', error)
      processorRunning = false
    })
    
    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

