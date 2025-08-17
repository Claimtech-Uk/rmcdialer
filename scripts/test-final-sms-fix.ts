import { config } from 'dotenv'
import { join } from 'path'

// Load production environment
config({ path: join(process.cwd(), '.env.production') })

async function testFinalSmsFix() {
  console.log('🏁 Final SMS Fix Test (No Duplicate SMS)...')
  console.log('═'.repeat(70))

  try {
    const { SmsAgentService } = await import('../modules/ai-agents/channels/sms/sms-agent.service')
    const { SMSService, MagicLinkService } = await import('../modules/communications')
    const { PrismaClient } = await import('@prisma/client')
    
    const prisma = new PrismaClient()
    
    const testPhone = '+447738585850'
    const testUserId = 2064
    
    const conversation = await prisma.smsConversation.findFirst({
      where: { phoneNumber: testPhone.replace(/^\+/, '') }
    })
    
    if (!conversation) {
      throw new Error('No conversation found')
    }

    // Create 3 rapid messages (like in your production scenario)
    console.log('\n📱 Creating 3 Rapid Messages (Production Simulation)...')
    const messageSids: string[] = []
    const messages = [
      'I have seen a notice from the fca saying I don\'t need a cmc',
      'Is it true', 
      'Is there any benefit to using one'
    ]
    
    for (let i = 0; i < 3; i++) {
      const messageSid = `FINAL_TEST_${i + 1}_${Date.now()}`
      messageSids.push(messageSid)
      
      await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'inbound',
          body: messages[i],
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
    
    console.log('  ✅ Created 3 messages simulating your production scenario')

    // Create agent with SMS send tracking
    let totalSmsSends = 0
    let smsMessages: string[] = []
    
    const mockSmsService = {
      sendSMS: async (args: any) => {
        totalSmsSends++
        smsMessages.push(args.message)
        console.log(`    📤 SMS SEND #${totalSmsSends}: "${args.message.substring(0, 50)}..."`)
        return { messageId: `mock-${totalSmsSends}`, twilioSid: `TW${totalSmsSends}` }
      }
    }
    
    const agent = new SmsAgentService(
      mockSmsService as any,
      new MagicLinkService({
        authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) }
      })
    )

    // Test concurrent processing (simulating 3 webhook calls)
    console.log('\n⚡ Simulating 3 Concurrent Webhook Calls...')
    
    const concurrentResults = await Promise.all([
      agent.handleInbound({
        fromPhone: testPhone,
        message: messages[0],
        userId: testUserId,
        messageSid: messageSids[0]
      }),
      agent.handleInbound({
        fromPhone: testPhone, 
        message: messages[1],
        userId: testUserId,
        messageSid: messageSids[1]
      }),
      agent.handleInbound({
        fromPhone: testPhone,
        message: messages[2], 
        userId: testUserId,
        messageSid: messageSids[2]
      })
    ])
    
    console.log('\n📊 FINAL RESULTS:')
    console.log(`  Total SMS Sends: ${totalSmsSends}`)
    console.log(`  Agent Results:`)
    
    concurrentResults.forEach((result, i) => {
      console.log(`    Handler ${i + 1}: hasReply=${!!result.reply?.text}, actions=${result.actions?.length || 0}`)
    })

    console.log('\n📱 SMS Messages Sent:')
    smsMessages.forEach((msg, i) => {
      console.log(`  ${i + 1}. "${msg.substring(0, 60)}..."`)
    })

    if (totalSmsSends === 1) {
      console.log('\n🎉 SUCCESS! Duplicate SMS Issue FIXED!')
      console.log('   Only 1 SMS sent despite 3 concurrent handlers')
      console.log('   Batching and deduplication working perfectly')
    } else {
      console.log(`\n❌ Issue persists: ${totalSmsSends} SMS messages sent`)
      console.log('   Expected: 1 SMS message')
    }

    // Verify database state
    const finalMessages = await prisma.smsMessage.findMany({
      where: {
        messageSid: { in: messageSids }
      },
      select: {
        messageSid: true,
        processed: true,
        processedAt: true,
        body: true
      }
    })

    console.log('\n🗄️  Database Verification:')
    const processedCount = finalMessages.filter(msg => msg.processed).length
    console.log(`  Processed messages: ${processedCount}/3`)
    
    if (processedCount === 3) {
      console.log('  ✅ All messages properly marked as processed')
    } else {
      console.log('  ❌ Some messages not marked as processed')
    }

    await prisma.$disconnect()

  } catch (error) {
    console.error('❌ Final test failed:', error)
  }

  console.log('\n═'.repeat(70))
  console.log('🏁 Final SMS Fix Test Complete')
}

testFinalSmsFix().catch(console.error)
