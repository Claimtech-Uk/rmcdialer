import { config } from 'dotenv'
import { join } from 'path'

// Load production environment
config({ path: join(process.cwd(), '.env.production') })

async function testRetryDuplicate() {
  console.log('🔄 Testing Retry Duplicate SMS Issue...')
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

    // Create 3 rapid messages
    console.log('\n📱 Creating 3 Messages for Retry Test...')
    const messageSids: string[] = []
    
    for (let i = 1; i <= 3; i++) {
      const messageSid = `RETRY_TEST_${i}_${Date.now()}`
      messageSids.push(messageSid)
      
      await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'inbound',
          body: i === 1 ? 'FCA notice question' : i === 2 ? 'Is it true' : 'Benefits question',
          twilioMessageSid: `twilio_${messageSid}`,
          isAutoResponse: false,
          receivedAt: new Date(),
          messageType: 'text',
          processed: false,
          processedAt: null,
          phoneNumber: testPhone,
          userId: testUserId,
          messageSid: messageSid
        }
      })
    }
    
    console.log('  ✅ Created 3 messages for retry testing')

    // Test with INTENTIONAL first failure to trigger retry
    console.log('\n🔄 Testing with Retry Logic (First Attempt Fails)...')
    
    let smsProcessTurnOutputCalls = 0
    let attemptCount = 0
    
    const result = await databaseSmsHandler.handleMessage(
      {
        messageSid: messageSids[0],
        phoneNumber: testPhone,
        text: 'FCA notice question',
        timestamp: Date.now(),
        userId: testUserId
      },
      async (messages, attempt) => {
        attemptCount++
        console.log(`\n  🔄 Callback Attempt ${attempt}:`)
        console.log(`    - Messages: ${messages.length}`)
        console.log(`    - Preview: ${messages.map(m => m.text.substring(0, 20)).join(' | ')}`)
        
        // Simulate processTurnOutput call (which sends SMS)
        console.log(`    - 🚨 SIMULATING processTurnOutput call #${attemptCount}`)
        smsProcessTurnOutputCalls++
        
        // FAIL on first attempt to trigger retry
        if (attempt === 1) {
          console.log(`    - ❌ Simulating first attempt failure`)
          throw new Error('Simulated LLM timeout on first attempt')
        }
        
        // SUCCESS on second attempt
        console.log(`    - ✅ Second attempt succeeds`)
        return `Retry test response: Understanding your FCA concerns...`
      }
    )
    
    console.log('\n📊 RETRY DUPLICATE ANALYSIS:')
    console.log(`  Total Callback Attempts: ${attemptCount}`)
    console.log(`  ProcessTurnOutput Calls: ${smsProcessTurnOutputCalls}`)
    console.log(`  Result: processed=${result.processed}, reason=${result.reason}`)
    
    if (smsProcessTurnOutputCalls > 1) {
      console.log('\n🚨 RETRY DUPLICATE CONFIRMED!')
      console.log(`   processTurnOutput called ${smsProcessTurnOutputCalls} times`)
      console.log('   This would send multiple SMS messages to the user')
      console.log('   🎯 FIX: Move SMS sending OUTSIDE the retry callback')
    } else {
      console.log('\n✅ No retry duplicates detected')
    }

    await prisma.$disconnect()

  } catch (error) {
    console.error('❌ Retry test failed:', error)
  }

  console.log('\n═'.repeat(70))
  console.log('🏁 Retry Duplicate Test Complete')
}

testRetryDuplicate().catch(console.error)
