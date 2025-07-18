// MySQL Replica Database Client
// Provides read-only access to main Laravel app data
import { PrismaClient } from '@/prisma/generated/mysql-client'

const globalForReplicaDb = globalThis as unknown as {
  replicaDb: PrismaClient | undefined
}

export const replicaDb = globalForReplicaDb.replicaDb ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.REPLICA_DATABASE_URL
    }
  }
})

if (process.env.NODE_ENV !== 'production') {
  globalForReplicaDb.replicaDb = replicaDb
}

// Helper function to test connection
export async function testReplicaConnection() {
  try {
    console.log('🔗 Testing MySQL replica connection...')
    
    // Simple query to test connection
    const userCount = await replicaDb.user.count()
    console.log(`✅ Connected to MySQL replica! Found ${userCount} users.`)
    
    // Test a more complex query
    const sampleUsers = await replicaDb.user.findMany({
      take: 3,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        is_enabled: true
      },
      where: {
        is_enabled: true,
        phone_number: {
          not: null
        }
      }
    })
    
    console.log('📊 Sample users from replica:')
    sampleUsers.forEach((user: any) => {
      console.log(`  - ${user.first_name} ${user.last_name} (ID: ${user.id}) - ${user.phone_number}`)
    })
    
    return true
  } catch (error) {
    console.error('❌ MySQL replica connection failed:', error)
    return false
  }
}

// Helper function to get database info
export async function getReplicaStats() {
  try {
    const [userCount, claimCount, requirementCount] = await Promise.all([
      replicaDb.user.count(),
      replicaDb.claim.count(),
      replicaDb.claimRequirement.count()
    ])
    
    return {
      users: userCount,
      claims: claimCount,
      requirements: requirementCount,
      connected: true
    }
  } catch (error) {
    console.error('Failed to get replica stats:', error)
    return {
      users: 0,
      claims: 0,
      requirements: 0,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
} 