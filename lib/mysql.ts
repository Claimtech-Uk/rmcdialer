// MySQL Replica Database Client
// Provides read-only access to main Laravel app data
import { PrismaClient } from '@/prisma/generated/mysql-client'

const globalForReplicaDb = globalThis as unknown as {
  replicaDb: PrismaClient | undefined
}

// Build replica database URL with optimized connection pool parameters
function buildReplicaDatabaseUrl(): string {
  const baseUrl = process.env.REPLICA_DATABASE_URL || ''
  const url = new URL(baseUrl)
  
  // Add MySQL-specific connection pool parameters - optimized for high concurrency
  url.searchParams.set('connection_limit', '40') // Increased to handle concurrent load
  url.searchParams.set('pool_timeout', '60') // Increased to 60 seconds for peak load
  url.searchParams.set('connect_timeout', '20') // 20 seconds for initial connection
  url.searchParams.set('mysql_query_timeout', '45') // 45 second query timeout to handle complex queries
  
  return url.toString()
}

export const replicaDb = globalForReplicaDb.replicaDb ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: buildReplicaDatabaseUrl()
    }
  },
  // Additional client options for better performance and stability
  transactionOptions: {
    maxWait: 20000, // 20 seconds for read-only queries (increased)
    timeout: 45000, // 45 seconds for transaction timeout (aligned with query timeout)
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