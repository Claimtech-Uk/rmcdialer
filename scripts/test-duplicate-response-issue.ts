import { config } from 'dotenv'
import { join } from 'path'

// Load production environment
config({ path: join(process.cwd(), '.env.production') })

async function testDuplicateResponseIssue() {
  console.log('🧪 Testing Duplicate Response Issue...')
  console.log('═'.repeat(70))

  try {
    const { PrismaClient } = await import('@prisma/client')
    const { databaseSmsHandler } = await import('../modules/ai-agents/channels/sms/database-sms-handler')
    const prisma = new PrismaClient()
    
    const testPhone = '+447738585850'
    const testUserId = 2064
    
    // Create a test scenario similar to real usage
    console.log('\n📱 Creating 3 Rapid Messages (Simulating Real Scenario)...')
    
    const conversation = await prisma.smsConversation.findFirst({
      where: { phoneNumber: testPhone.replace(/^\+/, '') }
    })
    
    if (!conversation) {
      throw new Error('No conversation found')
    }

    // Create 3 messages with same millisecond timestamp (like real rapid messages)
    const baseTime = new Date()
    const messageSids: string[] = []
    
    for (let i = 1; i <= 3; i++) {
      const messageSid = `DUPLICATE_TEST_${i}_${Date.now()}`
      messageSids.push(messageSid)
      
      await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'inbound',
          body: i === 1 ? 'I have seen a notice from the fca saying I don\'t need a cmc' : 
                i === 2 ? 'Is it true' : 'Is there any benefit to using one',
          twilioMessageSid: `twilio_${messageSid}`,
          isAutoResponse: false,
          receivedAt: baseTime, // Same timestamp!
          messageType: 'text',
          processed: false,
          processedAt: null,
          phoneNumber: testPhone,
          userId: testUserId,
          messageSid: messageSid
        }
      })
    }
    
    console.log('  ✅ Created 3 messages with identical timestamps (simulating rapid-fire)')

    // Test concurrent processing with detailed tracking
    console.log('\n⚡ Testing Concurrent Processing with Response Tracking...')
    
    let smsServiceCallCount = 0
    let processTurnOutputCallCount = 0
    
    const concurrentPromises = messageSids.map((messageSid, index) => 
      databaseSmsHandler.handleMessage(
        {
          messageSid,
          phoneNumber: testPhone,
          text: index === 0 ? 'I have seen a notice from the fca saying I don\'t need a cmc' : 
                index === 1 ? 'Is it true' : 'Is there any benefit to using one',
          timestamp: baseTime.getTime() + index,
          userId: testUserId
        },
        async (messages, attempt) => {
          console.log(`  📝 Handler ${index + 1} callback triggered:`)
          console.log(`    - Messages: ${messages.length}`)
          console.log(`    - Attempt: ${attempt}`)
          console.log(`    - Preview: ${messages.map(m => m.text.substring(0, 25)).join(' | ')}`)
          
          processTurnOutputCallCount++
          console.log(`    - processTurnOutput calls so far: ${processTurnOutputCallCount}`)
          
          // Simulate the processTurnOutput logic (which sends SMS)
          console.log(`    - 🚨 SIMULATING SMS SEND #${processTurnOutputCallCount}`)
          smsServiceCallCount++
          
          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, 200))
          
          const response = `Response ${processTurnOutputCallCount}: I understand your concern about the FCA notice. It's true that you don't need a Claims Management Company...`
          console.log(`    - Generated response length: ${response.length}`)
          
          return response
        }
      )
    )
    
    const results = await Promise.all(concurrentPromises)
    
    console.log('\n📊 DUPLICATE RESPONSE ANALYSIS:')
    console.log(`  SMS Service Calls: ${smsServiceCallCount}`)
    console.log(`  processTurnOutput Calls: ${processTurnOutputCallCount}`)
    console.log(`  Database Handler Results:`)
    
    results.forEach((result, i) => {
      console.log(`    Handler ${i + 1}: processed=${result.processed}, reason=${result.reason}`)
      if (result.processed) {
        console.log(`      - Response length: ${result.response?.length}`)
      }
    })

    const processedCount = results.filter(r => r.processed).length
    const deferredCount = results.filter(r => !r.processed).length
    
    console.log(`\n🎯 CRITICAL INSIGHT:`)
    console.log(`  - Processed handlers: ${processedCount} (should be 1)`)
    console.log(`  - Deferred handlers: ${deferredCount} (should be 2)`) 
    console.log(`  - SMS sends triggered: ${smsServiceCallCount} (should be 1)`)
    console.log(`  - Process callbacks: ${processTurnOutputCallCount} (should be 1)`)

    if (smsServiceCallCount > 1) {
      console.log('\n🚨 DUPLICATE RESPONSE CONFIRMED!')
      console.log(`   Multiple handlers (${smsServiceCallCount}) are calling processTurnOutput`)
      console.log('   This means multiple SMS messages are being sent')
    } else {
      console.log('\n✅ NO DUPLICATE RESPONSES DETECTED')
      console.log('   Only one handler processed and sent SMS')
    }

    // Check final database state
    const finalMessages = await prisma.smsMessage.findMany({
      where: {
        messageSid: { in: messageSids }
      },
      select: {
        messageSid: true,
        processed: true,
        processedAt: true
      }
    })

    console.log('\n🗄️  Final Database State:')
    finalMessages.forEach(msg => {
      console.log(`  ${msg.messageSid}: processed=${msg.processed}, processedAt=${msg.processedAt?.toISOString().substring(11, 19)}`)
    })

    await prisma.$disconnect()

  } catch (error) {
    console.error('❌ Test failed:', error)
  }

  console.log('\n═'.repeat(70))
  console.log('🏁 Duplicate Response Test Complete')
}

testDuplicateResponseIssue().catch(console.error)
