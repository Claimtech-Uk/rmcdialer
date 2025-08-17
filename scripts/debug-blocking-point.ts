import { config } from 'dotenv'
import { join } from 'path'

// Load production environment
config({ path: join(process.cwd(), '.env.production') })

async function debugBlockingPoint() {
  console.log('🔍 Debugging SMS Processing Block...')
  console.log('═'.repeat(50))

  try {
    console.log('\n1️⃣ Testing Agent Import...')
    const { SmsAgentService } = await import('../modules/ai-agents/channels/sms/sms-agent.service')
    console.log('  ✅ SmsAgentService imported successfully')

    console.log('\n2️⃣ Testing Database Handler Import...')
    const { databaseSmsHandler } = await import('../modules/ai-agents/channels/sms/database-sms-handler')
    console.log('  ✅ Database handler imported successfully')

    console.log('\n3️⃣ Testing Guardrails...')
    const { containsAbuseIntent, containsComplaintIntent } = await import('../../modules/ai-agents/core/guardrails')
    console.log('  ✅ Guardrails imported successfully')
    
    const testMessage = 'And the fees'
    console.log(`  Testing: "${testMessage}"`)
    console.log(`    Abuse intent: ${containsAbuseIntent(testMessage)}`)
    console.log(`    Complaint intent: ${containsComplaintIntent(testMessage)}`)

    console.log('\n4️⃣ Testing Automation Halt Check...')
    const { isAutomationHalted } = await import('../../modules/ai-agents/core/memory.store')
    console.log('  ✅ Memory store imported successfully')
    
    const testPhone = '+447738585850'
    console.log(`  Testing automation halt for: ${testPhone}`)
    const isHalted = await isAutomationHalted(testPhone)
    console.log(`    Automation halted: ${isHalted}`)

    console.log('\n5️⃣ Testing Database Handler Call...')
    const testInboundMessage = {
      messageSid: `DEBUG_BLOCK_${Date.now()}`,
      phoneNumber: testPhone,
      text: testMessage,
      timestamp: Date.now(),
      userId: 2064
    }
    
    console.log('  Calling database handler...')
    const result = await databaseSmsHandler.handleMessage(
      testInboundMessage,
      async (messages, attempt) => {
        console.log(`    📝 Callback reached: ${messages.length} messages, attempt ${attempt}`)
        return 'Test response'
      }
    )
    
    console.log('  ✅ Database handler completed:', {
      processed: result.processed,
      reason: result.reason,
      error: result.error
    })

    console.log('\n6️⃣ Testing Full Agent Flow (Step by Step)...')
    
    const { SMSService, MagicLinkService } = await import('../modules/communications')
    const agent = new SmsAgentService(
      new SMSService({ authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) } }),
      new MagicLinkService({ authService: { getCurrentAgent: async () => ({ id: 0, role: 'system' }) } })
    )

    console.log('  Agent created, testing handleInbound...')
    
    // Add detailed logging to track exactly where it hangs
    const logSteps = {
      start: false,
      automation_check: false,
      guardrails_check: false,
      message_created: false,
      handler_called: false,
      handler_completed: false,
      parsing: false,
      completed: false
    }

    try {
      console.log('    🟡 Starting handleInbound...')
      logSteps.start = true

      console.log('    🟡 Checking automation halt...')
      const haltCheck = await isAutomationHalted(testPhone)
      logSteps.automation_check = true
      console.log(`      Result: ${haltCheck}`)

      console.log('    🟡 Checking guardrails...')
      const abuseCheck = containsAbuseIntent(testMessage)
      const complaintCheck = containsComplaintIntent(testMessage)
      logSteps.guardrails_check = true
      console.log(`      Abuse: ${abuseCheck}, Complaint: ${complaintCheck}`)

      console.log('    🟡 Creating inbound message object...')
      const debugInbound = {
        messageSid: `DEBUG_FULL_${Date.now()}`,
        phoneNumber: testPhone,
        text: testMessage,
        timestamp: Date.now(),
        userId: 2064
      }
      logSteps.message_created = true
      console.log('      ✅ Message object created')

      console.log('    🟡 Calling database handler...')
      const debugResult = await databaseSmsHandler.handleMessage(
        debugInbound,
        async (messages, attempt) => {
          console.log(`      📝 Handler callback: ${messages.length} messages`)
          return 'Debug response'
        }
      )
      logSteps.handler_called = true
      logSteps.handler_completed = true
      console.log(`      ✅ Handler result: processed=${debugResult.processed}`)

      console.log('    🟡 Testing JSON parsing...')
      const testJson = JSON.stringify({ reply: 'test', actions: [], idempotencyKey: 'test' })
      const parsed = JSON.parse(testJson)
      logSteps.parsing = true
      console.log('      ✅ JSON parsing works')

      logSteps.completed = true
      console.log('    ✅ Full flow completed without blocking')

    } catch (stepError) {
      console.error('    ❌ Flow blocked at step:', stepError)
      console.log('    📊 Step completion status:', logSteps)
      throw stepError
    }

  } catch (error) {
    console.error('❌ Debug failed:', error)
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack')
  }

  console.log('\n═'.repeat(50))
  console.log('🏁 Block Debug Complete')
}

debugBlockingPoint().catch(console.error)
