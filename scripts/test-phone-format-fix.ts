import { config } from 'dotenv'
import { join } from 'path'

// Load production environment
config({ path: join(process.cwd(), '.env.production') })

async function testPhoneFormatFix() {
  console.log('📞 Testing Phone Format Fix...')
  console.log('═'.repeat(50))

  try {
    const { databaseSmsHandler } = await import('../modules/ai-agents/channels/sms/database-sms-handler')
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
    console.log('\n1️⃣ Checking Stuck Messages...')
    
    // Check for messages that might be stuck in processing
    const stuckMessages = await prisma.smsMessage.findMany({
      where: {
        phoneNumber: { in: ['447738585850', '+447738585850'] },
        direction: 'inbound',
        processed: false,
        processedAt: { not: null }
      },
      select: {
        messageSid: true,
        phoneNumber: true,
        processedAt: true,
        body: true
      }
    })
    
    console.log(`  Found ${stuckMessages.length} stuck messages:`)
    stuckMessages.forEach(msg => {
      const stuckMinutes = Math.round((Date.now() - (msg.processedAt?.getTime() || 0)) / 60000)
      console.log(`    ${msg.messageSid}: phone="${msg.phoneNumber}", stuck=${stuckMinutes}min`)
    })

    if (stuckMessages.length > 0) {
      console.log('\n🧹 Cleaning stuck messages...')
      const cleanResult = await databaseSmsHandler.cleanStuckProcessing(1) // Clean messages stuck >1 minute
      console.log(`  Cleaned ${cleanResult} stuck messages`)
    }

    console.log('\n2️⃣ Testing Lock with Different Phone Formats...')
    
    const formats = [
      '+447738585850',  // With + (agent passes this)
      '447738585850'    // Without + (database stores this)
    ]
    
    for (const phoneFormat of formats) {
      console.log(`\n  Testing format: "${phoneFormat}"`)
      
      const result = await databaseSmsHandler.handleMessage(
        {
          messageSid: `FORMAT_TEST_${phoneFormat.replace(/\+/, 'PLUS')}_${Date.now()}`,
          phoneNumber: phoneFormat,
          text: 'Format test',
          timestamp: Date.now(),
          userId: 2064
        },
        async (messages, attempt) => {
          console.log(`    📝 Callback: ${messages.length} messages found`)
          return 'Format test response'
        }
      )
      
      console.log(`    Result: processed=${result.processed}, reason=${result.reason}`)
      if (result.error) {
        console.log(`    Error: ${result.error}`)
      }
    }

    console.log('\n3️⃣ Checking Database State After Tests...')
    const recentMessages = await prisma.smsMessage.findMany({
      where: {
        phoneNumber: { in: ['447738585850', '+447738585850'] },
        direction: 'inbound'
      },
      select: {
        messageSid: true,
        phoneNumber: true,
        processed: true,
        processedAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 8
    })

    console.log(`  Found ${recentMessages.length} recent messages:`)
    recentMessages.forEach(msg => {
      console.log(`    ${msg.messageSid}: phone="${msg.phoneNumber}", processed=${msg.processed}`)
    })

    await prisma.$disconnect()

  } catch (error) {
    console.error('❌ Phone format test failed:', error)
  }

  console.log('\n═'.repeat(50))
  console.log('🏁 Phone Format Test Complete')
}

testPhoneFormatFix().catch(console.error)
