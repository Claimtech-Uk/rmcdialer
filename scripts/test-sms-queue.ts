#!/usr/bin/env ts-node
/**
 * Test script for SMS queue processing
 * Simulates rapid message sending to test queue handling
 */

import { smsQueueService } from '@/modules/ai-agents/core/sms-queue.service'
import { processQueue } from '@/modules/ai-agents/core/queue-processor'

async function simulateRapidMessages() {
  console.log('🧪 Starting SMS Queue Test')
  console.log('=' .repeat(50))
  
  // Clear queue before starting
  await smsQueueService.clearAll()
  console.log('✅ Queue cleared')
  
  // Test 1: Rapid fire messages from same number
  console.log('\n📱 Test 1: Rapid messages from same number')
  const testPhone = '447723495560'
  const messages = [
    'What is DCA?',
    'How much does it cost?',
    'Can I do this myself?',
    'What documents do I need?',
    'How long does it take?'
  ]
  
  for (let i = 0; i < messages.length; i++) {
    const queueId = await smsQueueService.enqueue({
      phoneNumber: testPhone,
      message: messages[i],
      messageSid: `TEST_SID_${i}`,
      receivedAt: new Date()
    })
    console.log(`  ➕ Queued: "${messages[i]}" (${queueId})`)
  }
  
  // Test 2: Messages from multiple numbers
  console.log('\n📱 Test 2: Messages from multiple numbers')
  const multipleNumbers = [
    { phone: '447700900001', message: 'Is this a scam?' },
    { phone: '447700900002', message: 'I need help with my claim' },
    { phone: '447700900003', message: 'What is motor finance?' }
  ]
  
  for (const { phone, message } of multipleNumbers) {
    const queueId = await smsQueueService.enqueue({
      phoneNumber: phone,
      message,
      messageSid: `TEST_SID_${phone}`,
      receivedAt: new Date()
    })
    console.log(`  ➕ Queued from ${phone}: "${message}"`)
  }
  
  // Test 3: Duplicate message detection
  console.log('\n📱 Test 3: Duplicate message detection')
  const duplicateSid = 'DUPLICATE_TEST_SID'
  
  const firstId = await smsQueueService.enqueue({
    phoneNumber: '447700900999',
    message: 'This is a duplicate test',
    messageSid: duplicateSid,
    receivedAt: new Date()
  })
  console.log(`  ➕ First message: ${firstId}`)
  
  const secondId = await smsQueueService.enqueue({
    phoneNumber: '447700900999',
    message: 'This is a duplicate test',
    messageSid: duplicateSid,
    receivedAt: new Date()
  })
  console.log(`  🔁 Second message: ${secondId} (should be 'duplicate')`)
  
  // Show queue stats
  console.log('\n📊 Queue Statistics:')
  const stats = await smsQueueService.getStats()
  console.log(`  • Queue depth: ${stats.queueDepth}`)
  console.log(`  • Processing: ${stats.processingCount}`)
  console.log(`  • Locked numbers: ${stats.lockedNumbers}`)
  
  // Test processor
  console.log('\n⚙️ Starting queue processor...')
  
  // Mock handler that simulates processing
  const mockHandler = async (message: any) => {
    console.log(`  🤖 Processing: ${message.phoneNumber} - "${message.message}"`)
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500))
    console.log(`  ✅ Completed: ${message.id}`)
  }
  
  // Process the queue
  await processQueue(mockHandler)
  
  // Final stats
  console.log('\n📊 Final Statistics:')
  const finalStats = await smsQueueService.getStats()
  console.log(`  • Queue depth: ${finalStats.queueDepth} (should be 0)`)
  console.log(`  • Processing: ${finalStats.processingCount} (should be 0)`)
  console.log(`  • Locked numbers: ${finalStats.lockedNumbers} (should be 0)`)
  
  console.log('\n✅ Test completed successfully!')
}

// Run the test
simulateRapidMessages().catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
