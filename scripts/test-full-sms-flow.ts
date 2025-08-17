import { config } from 'dotenv'
import { join } from 'path'

// Load production environment
config({ path: join(process.cwd(), '.env.production') })

async function testFullSmsFlow() {
  console.log('🧪 Testing Full SMS Flow (Webhook -> Database -> Handler)...')
  console.log('═'.repeat(70))

  try {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
    const testPhone = '+447738585850'
    const testUserId = 2064
    
    // Step 1: Create a conversation (simulating webhook behavior)
    console.log('\n📞 Step 1: Create/Find Conversation')
    let conversation = await prisma.smsConversation.findFirst({
      where: {
        phoneNumber: testPhone.replace(/^\+/, '')
      }
    })
    
    if (!conversation) {
      conversation = await prisma.smsConversation.create({
        data: {
          phoneNumber: testPhone.replace(/^\+/, ''),
          userId: testUserId,
          status: 'active',
          lastMessageAt: new Date(),
          unreadCount: 1,
          priority: 'normal'
        }
      })
      console.log('  ✅ Created new conversation:', conversation.id)
    } else {
      console.log('  ✅ Found existing conversation:', conversation.id)
    }

    // Step 2: Create SMS message in database (simulating webhook behavior)
    console.log('\n📱 Step 2: Create SMS Message in Database')
    const testMessageSid = `TEST_FULL_${Date.now()}`
    const testMessage = 'Hello, what are the fees and process?'
    
    const smsMessage = await prisma.smsMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        body: testMessage,
        twilioMessageSid: `twilio_${testMessageSid}`,
        isAutoResponse: false,
        receivedAt: new Date(),
        messageType: 'text',
        // Database-first fields
        processed: false,
        processedAt: null,
        phoneNumber: testPhone,
        userId: testUserId,
        messageSid: testMessageSid
      }
    })
    
    console.log('  ✅ Created SMS message:', {
      id: smsMessage.id,
      messageSid: testMessageSid,
      processed: smsMessage.processed,
      phoneNumber: smsMessage.phoneNumber
    })

    // Step 3: Now test the database handler
    console.log('\n🎯 Step 3: Test Database Handler')
    const { databaseSmsHandler } = await import('../modules/ai-agents/channels/sms/database-sms-handler')
    
    const result = await databaseSmsHandler.handleMessage(
      {
        messageSid: testMessageSid,
        phoneNumber: testPhone,
        text: testMessage,
        timestamp: Date.now(),
        userId: testUserId
      },
      async (messages, attempt) => {
        console.log(`  📝 Handler callback: ${messages.length} messages, attempt ${attempt}`)
        console.log(`    Messages: ${messages.map(m => m.text).join(' | ')}`)
        
        // Simulate AI processing
        await new Promise(resolve => setTimeout(resolve, 500))
        
        return `AI Response: I understand you're asking about fees. Our service operates on a no-win-no-fee basis, meaning you only pay if we succeed in recovering your money.`
      }
    )

    console.log('  Handler result:', {
      processed: result.processed,
      reason: result.reason,
      responseLength: result.response?.length,
      error: result.error
    })

    // Step 4: Verify database state
    console.log('\n🔍 Step 4: Verify Database State After Processing')
    const updatedMessage = await prisma.smsMessage.findFirst({
      where: {
        messageSid: testMessageSid
      }
    })

    if (updatedMessage) {
      console.log('  Updated message state:', {
        messageSid: updatedMessage.messageSid,
        processed: updatedMessage.processed,
        processedAt: updatedMessage.processedAt,
        phoneNumber: updatedMessage.phoneNumber,
        userId: updatedMessage.userId
      })

      if (updatedMessage.processed) {
        console.log('  ✅ Message successfully marked as processed in database')
      } else {
        console.log('  ❌ Message NOT marked as processed - handler may have failed')
      }
    } else {
      console.log('  ❌ Could not find message in database')
    }

    // Step 5: Test concurrent processing
    console.log('\n⚡ Step 5: Test Concurrent Processing Prevention')
    
    // Create another message for the same phone
    const concurrentMessageSid = `TEST_CONCURRENT_${Date.now()}`
    const concurrentMessage = await prisma.smsMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        body: 'Another message',
        twilioMessageSid: `twilio_${concurrentMessageSid}`,
        isAutoResponse: false,
        receivedAt: new Date(),
        messageType: 'text',
        processed: false,
        processedAt: null,
        phoneNumber: testPhone,
        userId: testUserId,
        messageSid: concurrentMessageSid
      }
    })

    // Try to process both messages simultaneously
    const concurrentResults = await Promise.all([
      databaseSmsHandler.handleMessage(
        {
          messageSid: concurrentMessageSid,
          phoneNumber: testPhone,
          text: 'Another message',
          timestamp: Date.now(),
          userId: testUserId
        },
        async (messages, attempt) => {
          console.log(`  📝 Concurrent handler 1: ${messages.length} messages`)
          await new Promise(resolve => setTimeout(resolve, 300))
          return 'Concurrent response 1'
        }
      ),
      databaseSmsHandler.handleMessage(
        {
          messageSid: `FAKE_${Date.now()}`, // This one won't exist in DB
          phoneNumber: testPhone,
          text: 'Fake message',
          timestamp: Date.now(),
          userId: testUserId
        },
        async (messages, attempt) => {
          console.log(`  📝 Concurrent handler 2: ${messages.length} messages`)
          await new Promise(resolve => setTimeout(resolve, 300))
          return 'Concurrent response 2'
        }
      )
    ])

    console.log('  Concurrent results:', concurrentResults.map(r => ({
      processed: r.processed,
      reason: r.reason
    })))

    // Step 6: Final stats
    console.log('\n📊 Step 6: Processing Statistics')
    const stats = await databaseSmsHandler.getProcessingStats()
    console.log('  Final stats:', stats)

    await prisma.$disconnect()

  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack')
  }

  console.log('\n═'.repeat(70))
  console.log('🏁 Full SMS Flow Test Complete')
}

testFullSmsFlow().catch(console.error)
