import { config } from 'dotenv'
import { join } from 'path'

// Load production environment
config({ path: join(process.cwd(), '.env.production') })

async function testDatabaseHandler() {
  console.log('🧪 Testing Database-First SMS Handler...')
  console.log('═'.repeat(60))

  try {
    const { databaseSmsHandler } = await import('../modules/ai-agents/channels/sms/database-sms-handler')
    const { PrismaClient } = await import('@prisma/client')
    
    const prisma = new PrismaClient()
    const testPhone = '+447738585850'
    
    console.log('\n📊 Pre-test: Check Processing Stats')
    const initialStats = await databaseSmsHandler.getProcessingStats()
    console.log('  Initial stats:', initialStats)

    console.log('\n🧹 Pre-test: Clean any stuck processing')
    const cleaned = await databaseSmsHandler.cleanStuckProcessing()
    console.log(`  Cleaned ${cleaned} stuck messages`)

    // Test 1: Single message processing
    console.log('\n📱 Test 1: Single Message Processing')
    const singleResult = await databaseSmsHandler.handleMessage(
      {
        messageSid: 'TEST_DB_SINGLE_' + Date.now(),
        phoneNumber: testPhone,
        text: 'Hello, what are the fees?',
        timestamp: Date.now(),
        userId: 2064
      },
      async (messages, attempt) => {
        console.log(`  📝 Database callback: ${messages.length} messages, attempt ${attempt}`)
        await new Promise(resolve => setTimeout(resolve, 100)) // Simulate processing
        return `Database test response: ${messages.map(m => m.text).join(' | ')}`
      }
    )
    
    console.log('  Result:', {
      processed: singleResult.processed,
      reason: singleResult.reason,
      messageId: singleResult.messageId,
      responsePreview: singleResult.response?.substring(0, 50)
    })

    // Test 2: Rapid-fire messages (atomic database test)
    console.log('\n⚡ Test 2: Rapid-Fire Messages (Database Atomicity Test)')
    
    const rapidPromises = []
    const messageSids: string[] = []
    
    for (let i = 0; i < 5; i++) {
      const messageSid = `TEST_DB_RAPID_${i}_${Date.now()}`
      messageSids.push(messageSid)
      
      rapidPromises.push(
        databaseSmsHandler.handleMessage(
          {
            messageSid,
            phoneNumber: testPhone,
            text: `Rapid message ${i + 1}`,
            timestamp: Date.now() + i * 10,
            userId: 2064
          },
          async (messages, attempt) => {
            console.log(`  📝 Batch processing ${i}: ${messages.length} messages, attempt ${attempt}`)
            await new Promise(resolve => setTimeout(resolve, 200 + i * 50))
            return `Batch ${i} processed: ${messages.map(m => m.text).join(', ')}`
          }
        )
      )
    }
    
    const rapidResults = await Promise.all(rapidPromises)
    
    console.log('  Rapid-fire results:')
    rapidResults.forEach((result, i) => {
      console.log(`    Message ${i + 1}: processed=${result.processed}, reason=${result.reason}`)
    })

    const processed = rapidResults.filter(r => r.processed).length
    const deferred = rapidResults.filter(r => !r.processed).length
    
    console.log(`  📊 Database atomicity test: ${processed} processed, ${deferred} deferred`)
    
    if (processed === 1 && deferred === 4) {
      console.log('  ✅ Database atomic operations PASSED - only 1 acquired lock')
    } else {
      console.log('  ⚠️  Unexpected result - database atomicity may have issues')
    }

    // Test 3: Check database state
    console.log('\n🗄️  Test 3: Verify Database State')
    
    const recentMessages = await prisma.smsMessage.findMany({
      where: {
        phoneNumber: testPhone,
        direction: 'inbound',
        messageSid: {
          startsWith: 'TEST_DB_'
        }
      },
      select: {
        messageSid: true,
        processed: true,
        processedAt: true,
        phoneNumber: true,
        userId: true,
        body: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    console.log(`  Found ${recentMessages.length} test messages in database:`)
    recentMessages.forEach(msg => {
      console.log(`    ${msg.messageSid}: processed=${msg.processed}, phone=${msg.phoneNumber}, user=${msg.userId}`)
    })

    // Verify all expected fields are populated
    const missingFields = recentMessages.filter(msg => 
      msg.phoneNumber === null || 
      msg.messageSid === null
    )

    if (missingFields.length === 0) {
      console.log('  ✅ All database fields properly populated')
    } else {
      console.log(`  ❌ ${missingFields.length} messages missing required fields`)
    }

    // Test 4: Final stats
    console.log('\n📊 Test 4: Final Processing Stats')
    const finalStats = await databaseSmsHandler.getProcessingStats()
    console.log('  Final stats:', finalStats)
    console.log('  Stats delta:', {
      unprocessed: finalStats.unprocessed - initialStats.unprocessed,
      processing: finalStats.processing - initialStats.processing,
      processed: finalStats.processed - initialStats.processed,
      stuck: finalStats.stuck - initialStats.stuck
    })

    await prisma.$disconnect()

  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack')
  }

  console.log('\n═'.repeat(60))
  console.log('🏁 Database Handler Tests Complete')
}

testDatabaseHandler().catch(console.error)
