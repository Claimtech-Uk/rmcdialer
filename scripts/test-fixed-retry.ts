import { config } from 'dotenv'
import { join } from 'path'

// Load production environment  
config({ path: join(process.cwd(), '.env.production') })

async function testFixedRetry() {
  console.log('🔧 Testing FIXED Retry Logic (No Duplicate SMS)...')
  console.log('═'.repeat(70))

  try {
    const { SmsAgentService } = await import('../modules/ai-agents/channels/sms/sms-agent.service')
    const { SMSService, MagicLinkService } = await import('../modules/communications')
    const { PrismaClient } = await import('@prisma/client')
    
    const prisma = new PrismaClient()
    
    // Create agent (like webhook does)
    const agent = new SmsAgentService(
      new SMSService({
        authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) }
      }),
      new MagicLinkService({
        authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) }
      })
    )
    
    const testPhone = '+447738585850'
    const testUserId = 2064
    
    const conversation = await prisma.smsConversation.findFirst({
      where: { phoneNumber: testPhone.replace(/^\+/, '') }
    })
    
    if (!conversation) {
      throw new Error('No conversation found')
    }

    // Create 3 messages
    console.log('\n📱 Creating 3 Messages...')
    const messageSids: string[] = []
    
    for (let i = 1; i <= 3; i++) {
      const messageSid = `FIXED_RETRY_${i}_${Date.now()}`
      messageSids.push(messageSid)
      
      await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'inbound',
          body: i === 1 ? 'FCA notice concern' : i === 2 ? 'Is it really true' : 'Benefits of CMC',
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
    
    console.log('  ✅ Created 3 messages')

    // Test the FIXED agent with simulated retry failure
    console.log('\n🔧 Testing FIXED Agent (Should Only Send 1 SMS Despite Retries)...')
    
    // Mock the runtime to fail first, succeed second (like real LLM timeouts)
    let runtimeCallCount = 0
    const originalHandleTurn = (agent as any).runtime.handleTurn
    
    ;(agent as any).runtime.handleTurn = async (input: any) => {
      runtimeCallCount++
      console.log(`    📞 Runtime call ${runtimeCallCount}`)
      
      if (runtimeCallCount === 1) {
        console.log(`    ❌ Simulating LLM timeout on call ${runtimeCallCount}`)
        throw new Error('Simulated OpenAI timeout')
      }
      
      console.log(`    ✅ LLM succeeds on call ${runtimeCallCount}`)
      return {
        reply: { text: 'Fixed response: I understand your FCA concerns. Our CMC service offers comprehensive support...' },
        actions: [],
        idempotencyKey: `test-key-${Date.now()}`
      }
    }
    
    // Mock processTurnOutput to track calls
    let processTurnOutputCalls = 0
    const originalProcessTurnOutput = (agent as any).processTurnOutput
    
    ;(agent as any).processTurnOutput = async (turn: any, input: any) => {
      processTurnOutputCalls++
      console.log(`    📤 processTurnOutput call #${processTurnOutputCalls}`)
      console.log(`      - Reply: "${turn.reply?.text?.substring(0, 40)}..."`)
      console.log(`      - IdempotencyKey: ${turn.idempotencyKey}`)
      
      // Simulate SMS sending (don't actually send)
      console.log(`      - 🚨 WOULD SEND SMS: "processTurnOutput call #${processTurnOutputCalls}"`)
      
      return Promise.resolve()
    }

    try {
      const result = await agent.handleInbound({
        fromPhone: testPhone,
        message: 'FCA notice concern',
        userId: testUserId,
        messageSid: messageSids[0]
      })
      
      console.log('\n📊 FIXED RETRY RESULTS:')
      console.log(`  Runtime Calls: ${runtimeCallCount}`)
      console.log(`  ProcessTurnOutput Calls: ${processTurnOutputCalls}`)
      console.log(`  Agent Result:`, {
        hasReply: !!result.reply?.text,
        replyLength: result.reply?.text?.length
      })
      
      if (processTurnOutputCalls === 1) {
        console.log('\n✅ FIX SUCCESSFUL!')
        console.log('   Only 1 SMS would be sent despite 2 runtime attempts')
        console.log('   Retry duplicates eliminated!')
      } else {
        console.log('\n❌ FIX NEEDS MORE WORK')
        console.log(`   Still ${processTurnOutputCalls} SMS sends would occur`)
      }
      
    } finally {
      // Restore original methods
      ;(agent as any).runtime.handleTurn = originalHandleTurn
      ;(agent as any).processTurnOutput = originalProcessTurnOutput
    }

    await prisma.$disconnect()

  } catch (error) {
    console.error('❌ Fixed retry test failed:', error)
  }

  console.log('\n═'.repeat(70))
  console.log('🏁 Fixed Retry Test Complete')
}

testFixedRetry().catch(console.error)
