import { config } from 'dotenv'
import { join } from 'path'

// Load production environment
config({ path: join(process.cwd(), '.env.production') })

async function testWebhookAgentFlow() {
  console.log('🔍 Testing Webhook → Agent Flow...')
  console.log('═'.repeat(50))

  try {
    console.log('\n1️⃣ Import and Setup...')
    const { SmsAgentService } = await import('../modules/ai-agents/channels/sms/sms-agent.service')
    const { SMSService, MagicLinkService } = await import('../modules/communications')
    
    // Create agent exactly like webhook does
    const agent = new SmsAgentService(
      new SMSService({
        authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) }
      }),
      new MagicLinkService({
        authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) }
      })
    )
    console.log('  ✅ Agent created')

    console.log('\n2️⃣ Testing Agent handleInbound (Step by Step)...')
    
    const testPhone = '+447738585850'
    const testMessage = 'And the fees'
    const testUserId = 2064
    const testMessageSid = 'SMca409efdb4634991e4be557673f81b94'
    
    console.log(`  Input: phone=${testPhone}, message="${testMessage}", userId=${testUserId}`)
    
    // Add console logs to track progress
    let step = 'starting'
    
    try {
      step = 'calling_handleInbound'
      console.log('  🟡 Calling agent.handleInbound...')
      
      // Create a timeout race condition
      const handleInboundPromise = agent.handleInbound({
        fromPhone: testPhone,
        message: testMessage,
        userId: testUserId,
        replyFromE164: '+447723495560',
        messageSid: testMessageSid
      })
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('handleInbound timeout after 10 seconds')), 10000)
      })
      
      step = 'awaiting_result'
      const result = await Promise.race([handleInboundPromise, timeoutPromise])
      
      step = 'completed'
      console.log('  ✅ handleInbound completed:', {
        hasReply: !!(result as any).reply?.text,
        actionCount: (result as any).actions?.length || 0
      })

    } catch (error) {
      console.error(`  ❌ handleInbound failed at step: ${step}`)
      console.error(`     Error: ${error instanceof Error ? error.message : error}`)
      
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('  🚨 CONFIRMED: handleInbound is hanging!')
        console.log('     This explains why no "Database processing started" logs appear')
        
        // Let's test individual components
        console.log('\n3️⃣ Testing Individual Components...')
        
        console.log('  Testing isAutomationHalted...')
        const { isAutomationHalted } = await import('../modules/ai-agents/core/memory.store')
        const haltResult = await Promise.race([
          isAutomationHalted(testPhone),
          new Promise((_, reject) => setTimeout(() => reject(new Error('halt timeout')), 3000))
        ])
        console.log(`    Result: ${haltResult}`)
        
        console.log('  Testing containsAbuseIntent...')
        const { containsAbuseIntent } = await import('../modules/ai-agents/core/guardrails')
        const abuseResult = containsAbuseIntent(testMessage)
        console.log(`    Result: ${abuseResult}`)
        
        console.log('  Testing databaseSmsHandler directly...')
        const { databaseSmsHandler } = await import('../modules/ai-agents/channels/sms/database-sms-handler')
        const handlerResult = await Promise.race([
          databaseSmsHandler.handleMessage(
            {
              messageSid: testMessageSid,
              phoneNumber: testPhone,
              text: testMessage,
              timestamp: Date.now(),
              userId: testUserId
            },
            async (messages, attempt) => {
              console.log(`      Handler callback: ${messages.length} messages`)
              return 'Test response'
            }
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('handler timeout')), 5000))
        ])
        console.log(`    Handler result: processed=${(handlerResult as any).processed}`)
        
      } else {
        throw error
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  }

  console.log('\n═'.repeat(50))
  console.log('🏁 Webhook Agent Flow Test Complete')
}

testWebhookAgentFlow().catch(console.error)
