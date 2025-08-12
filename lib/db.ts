import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Build database URL with optimized connection pool parameters
function buildDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || ''
  const url = new URL(baseUrl)
  
  // Add connection pool parameters for better performance
  url.searchParams.set('connection_limit', '25') // Increased from default 5
  url.searchParams.set('pool_timeout', '30') // 30 seconds (increased from 10)
  url.searchParams.set('connect_timeout', '20') // 20 seconds for initial connection
  
  return url.toString()
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: buildDatabaseUrl()
    }
  },
  // Additional client options for better performance
  transactionOptions: {
    maxWait: 15000, // 15 seconds for transaction lock wait
    timeout: 30000, // 30 seconds for transaction timeout
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Test database connection on startup and add monitoring
if (process.env.NODE_ENV === 'development') {
  prisma.$connect()
    .then(() => console.log('✅ PostgreSQL connected with optimized connection pool (25 connections, 30s timeout)'))
    .catch((error: any) => console.error('❌ PostgreSQL connection failed:', error))
}

// Add connection pool monitoring for production
let connectionUsageLogged = false
export async function monitorConnectionPool() {
  if (connectionUsageLogged) return
  
  try {
    console.log('📊 Database connection pool initialized', {
      environment: process.env.NODE_ENV,
      connectionLimit: 25,
      poolTimeout: '30s',
      transactionTimeout: '30s'
    })
    connectionUsageLogged = true
  } catch (error) {
    console.error('❌ Connection pool monitoring error:', error)
  }
} 