import { config } from 'dotenv'
import { join } from 'path'

// Load production environment
config({ path: join(process.cwd(), '.env.production') })

async function testTimingAnalysis() {
  console.log('🕐 Testing Timing Analysis (Separate Batch Hypothesis)...')
  console.log('═'.repeat(70))

  try {
    const { PrismaClient } = await import('@prisma/client')
    const { databaseSmsHandler } = await import('../modules/ai-agents/channels/sms/database-sms-handler')
    const prisma = new PrismaClient()
    
    const testPhone = '+447738585850'
    const testUserId = 2064
    
    const conversation = await prisma.smsConversation.findFirst({
      where: { phoneNumber: testPhone.replace(/^\+/, '') }
    })
    
    if (!conversation) {
      throw new Error('No conversation found')
    }

    // Simulate REAL rapid-fire scenario with SLIGHT timing differences
    console.log('\n📱 Creating Messages with Realistic Timing Gaps...')
    
    const baseTime = Date.now()
    
    // Message 1: Create immediately
    const message1Sid = `TIMING_TEST_1_${baseTime}`
    await prisma.smsMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        body: 'I have seen a notice from the fca saying I don\'t need a cmc',
        twilioMessageSid: `twilio_${message1Sid}`,
        isAutoResponse: false,
        receivedAt: new Date(baseTime),
        messageType: 'text',
        processed: false,
        processedAt: null,
        phoneNumber: testPhone,
        userId: testUserId,
        messageSid: message1Sid
      }
    })
    
    console.log('  ✅ Created message 1')
    
    // Message 2: Create 50ms later (very close)
    await new Promise(resolve => setTimeout(resolve, 50))
    const message2Sid = `TIMING_TEST_2_${baseTime + 50}`
    await prisma.smsMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        body: 'Is it true',
        twilioMessageSid: `twilio_${message2Sid}`,
        isAutoResponse: false,
        receivedAt: new Date(baseTime + 50),
        messageType: 'text',
        processed: false,
        processedAt: null,
        phoneNumber: testPhone,
        userId: testUserId,
        messageSid: message2Sid
      }
    })
    
    console.log('  ✅ Created message 2 (+50ms)')

    // Start processing message 1 and 2 (they should be batched)
    console.log('\n⚡ Starting Processing for Messages 1-2...')
    
    const processing12Promise = databaseSmsHandler.handleMessage(
      {
        messageSid: message1Sid,
        phoneNumber: testPhone,
        text: 'I have seen a notice from the fca saying I don\'t need a cmc',
        timestamp: baseTime,
        userId: testUserId
      },
      async (messages, attempt) => {
        console.log(`  📝 Batch 1-2 processing: ${messages.length} messages`)
        console.log(`    Messages: ${messages.map(m => m.text.substring(0, 30)).join(' | ')}`)
        
        // Simulate realistic processing time
        await new Promise(resolve => setTimeout(resolve, 800))
        
        return `Batch 1-2 Response: I understand your concern about the FCA notice...`
      }
    )

    // Message 3: Create while messages 1-2 are being processed (300ms later)
    await new Promise(resolve => setTimeout(resolve, 300))
    const message3Sid = `TIMING_TEST_3_${baseTime + 350}`
    await prisma.smsMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        body: 'Is there any benefit to using one',
        twilioMessageSid: `twilio_${message3Sid}`,
        isAutoResponse: false,
        receivedAt: new Date(baseTime + 350),
        messageType: 'text',
        processed: false,
        processedAt: null,
        phoneNumber: testPhone,
        userId: testUserId,
        messageSid: message3Sid
      }
    })
    
    console.log('  ✅ Created message 3 (+350ms, while 1-2 processing)')

    // Try to process message 3 (should it be included or separate?)
    console.log('\n⚡ Starting Processing for Message 3...')
    
    const processing3Promise = databaseSmsHandler.handleMessage(
      {
        messageSid: message3Sid,
        phoneNumber: testPhone,
        text: 'Is there any benefit to using one',
        timestamp: baseTime + 350,
        userId: testUserId
      },
      async (messages, attempt) => {
        console.log(`  📝 Batch 3 processing: ${messages.length} messages`)
        console.log(`    Messages: ${messages.map(m => m.text.substring(0, 30)).join(' | ')}`)
        
        await new Promise(resolve => setTimeout(resolve, 400))
        
        return `Batch 3 Response: Regarding the benefits of using a CMC...`
      }
    )

    // Wait for both processing attempts
    const [result12, result3] = await Promise.all([processing12Promise, processing3Promise])
    
    console.log('\n📊 TIMING ANALYSIS RESULTS:')
    console.log(`  Batch 1-2: processed=${result12.processed}, reason=${result12.reason}`)
    if (result12.processed) {
      console.log(`    Response: "${result12.response?.substring(0, 50)}..."`)
    }
    
    console.log(`  Batch 3: processed=${result3.processed}, reason=${result3.reason}`)
    if (result3.processed) {
      console.log(`    Response: "${result3.response?.substring(0, 50)}..."`)
    }

    const totalProcessed = [result12, result3].filter(r => r.processed).length
    
    if (totalProcessed === 2) {
      console.log('\n🚨 SEPARATE BATCH PROCESSING CONFIRMED!')
      console.log('   Messages arriving during processing create separate batches')
      console.log('   This explains the 2 responses you\'re seeing!')
    } else if (totalProcessed === 1) {
      console.log('\n✅ PROPER BATCHING - Only one batch processed')
    } else {
      console.log('\n❓ Unexpected result')
    }

    // Check final database state
    const finalMessages = await prisma.smsMessage.findMany({
      where: {
        messageSid: { in: [message1Sid, message2Sid, message3Sid] }
      },
      select: {
        messageSid: true,
        processed: true,
        processedAt: true,
        body: true
      },
      orderBy: {
        processedAt: 'asc'
      }
    })

    console.log('\n🗄️  Final Database State:')
    finalMessages.forEach(msg => {
      console.log(`  ${msg.messageSid}: processed=${msg.processed}`)
      console.log(`    Text: "${msg.body?.substring(0, 40)}..."`)
      console.log(`    ProcessedAt: ${msg.processedAt?.toISOString().substring(11, 19)}`)
      console.log()
    })

    await prisma.$disconnect()

  } catch (error) {
    console.error('❌ Timing test failed:', error)
  }

  console.log('\n═'.repeat(70))
  console.log('🏁 Timing Analysis Complete')
}

testTimingAnalysis().catch(console.error)
