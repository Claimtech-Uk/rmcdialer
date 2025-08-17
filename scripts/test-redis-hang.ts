import { config } from 'dotenv'
import { join } from 'path'

// Load production environment
config({ path: join(process.cwd(), '.env.production') })

async function testRedisHang() {
  console.log('🔍 Testing Redis Hang Theory...')
  console.log('═'.repeat(50))

  try {
    console.log('\n1️⃣ Testing Cache Service...')
    const { cacheService } = await import('../lib/redis')
    console.log('  ✅ Cache service imported')

    console.log('\n2️⃣ Testing Redis Get with Timeout...')
    const testPhone = '+447738585850'
    
    // Test with timeout to see if Redis is hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis timeout')), 5000)
    })
    
    const cachePromise = cacheService.get(`sms:halt:${testPhone}`)
    
    try {
      const result = await Promise.race([cachePromise, timeoutPromise])
      console.log(`  ✅ Redis responded: ${result}`)
    } catch (error) {
      if (error instanceof Error && error.message === 'Redis timeout') {
        console.log('  🚨 REDIS HANGING CONFIRMED!')
        console.log('     Redis get() call taking >5 seconds')
      } else {
        console.log('  ❌ Redis error:', error)
      }
    }

    console.log('\n3️⃣ Testing isAutomationHalted...')
    const { isAutomationHalted } = await import('../modules/ai-agents/core/memory.store')
    
    const haltTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('isAutomationHalted timeout')), 5000)
    })
    
    const haltPromise = isAutomationHalted(testPhone)
    
    try {
      const haltResult = await Promise.race([haltPromise, haltTimeoutPromise])
      console.log(`  ✅ isAutomationHalted responded: ${haltResult}`)
    } catch (error) {
      if (error instanceof Error && error.message === 'isAutomationHalted timeout') {
        console.log('  🚨 isAutomationHalted HANGING CONFIRMED!')
        console.log('     This is blocking SMS processing')
      } else {
        console.log('  ❌ isAutomationHalted error:', error)
      }
    }

  } catch (error) {
    console.error('❌ Redis hang test failed:', error)
  }

  console.log('\n═'.repeat(50))
  console.log('🏁 Redis Hang Test Complete')
}

testRedisHang().catch(console.error)
